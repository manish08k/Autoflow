"""
AI / LLM nodes.

  - ai.chat       — send a prompt to an LLM (Anthropic Claude or OpenAI),
                    with optional templating from the upstream node's output
                    and an optional system prompt. Returns the model's text.
  - ai.extract    — ask the LLM to extract structured data matching a JSON
                    schema description, returned as parsed JSON. Useful for
                    classification/routing before a core.condition node.

Both nodes use whichever provider is configured via ANTHROPIC_API_KEY /
OPENAI_API_KEY in the environment — no per-user OAuth credential needed,
since these are server-side API keys shared across the workflow (operator
sets them up once, like SMTP).
"""
import json
import re

import httpx
import structlog

from core.execution_engine import register_node
from core.config import settings

log = structlog.get_logger(__name__)

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-6"
DEFAULT_OPENAI_MODEL = "gpt-4o-mini"


def _render_template(template: str, input_data: dict) -> str:
    """Replace {{field}} or {{a.b.c}} placeholders with values from input_data."""
    if not isinstance(template, str):
        return template

    def repl(match):
        path = match.group(1).strip().split(".")
        val = input_data
        for part in path:
            if isinstance(val, dict):
                val = val.get(part)
            else:
                return ""
        if val is None:
            return ""
        return val if isinstance(val, str) else json.dumps(val)

    return re.sub(r"\{\{\s*([\w\.]+)\s*\}\}", repl, template)


def _pick_provider(config: dict) -> str:
    provider = config.get("provider", "auto")
    if provider == "auto":
        if settings.ANTHROPIC_API_KEY:
            return "anthropic"
        if settings.OPENAI_API_KEY:
            return "openai"
        raise ValueError(
            "No AI provider configured. Set ANTHROPIC_API_KEY or OPENAI_API_KEY "
            "in the environment, or choose a provider explicitly."
        )
    return provider


async def _call_anthropic(model: str, system: str, prompt: str, max_tokens: int, temperature: float) -> str:
    if not settings.ANTHROPIC_API_KEY:
        raise ValueError("ANTHROPIC_API_KEY is not set in the environment.")

    payload = {
        "model": model or DEFAULT_ANTHROPIC_MODEL,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": [{"role": "user", "content": prompt}],
    }
    if system:
        payload["system"] = system

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            ANTHROPIC_API_URL,
            json=payload,
            headers={
                "x-api-key": settings.ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()

    parts = [b["text"] for b in data.get("content", []) if b.get("type") == "text"]
    return "\n".join(parts)


async def _call_openai(model: str, system: str, prompt: str, max_tokens: int, temperature: float) -> str:
    if not settings.OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not set in the environment.")

    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": prompt})

    payload = {
        "model": model or DEFAULT_OPENAI_MODEL,
        "max_tokens": max_tokens,
        "temperature": temperature,
        "messages": messages,
    }

    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            OPENAI_API_URL,
            json=payload,
            headers={
                "Authorization": f"Bearer {settings.OPENAI_API_KEY}",
                "content-type": "application/json",
            },
        )
        r.raise_for_status()
        data = r.json()

    return data["choices"][0]["message"]["content"]


async def _call_llm(provider: str, model: str, system: str, prompt: str, max_tokens: int, temperature: float) -> str:
    if provider == "anthropic":
        return await _call_anthropic(model, system, prompt, max_tokens, temperature)
    elif provider == "openai":
        return await _call_openai(model, system, prompt, max_tokens, temperature)
    raise ValueError(f"Unknown AI provider: {provider}")


@register_node("ai.chat")
async def ai_chat(config: dict, input_data: dict, credential_id: str, db) -> dict:
    provider = _pick_provider(config)
    model = config.get("model", "")
    system_prompt = _render_template(config.get("system_prompt", ""), input_data)
    prompt = _render_template(config.get("prompt", ""), input_data)
    max_tokens = int(config.get("max_tokens", 1024))
    temperature = float(config.get("temperature", 0.7))

    if not prompt:
        raise ValueError("ai.chat requires a non-empty 'prompt'.")

    text = await _call_llm(provider, model, system_prompt, prompt, max_tokens, temperature)

    return {"text": text, "provider": provider, "model": model or (
        DEFAULT_ANTHROPIC_MODEL if provider == "anthropic" else DEFAULT_OPENAI_MODEL
    )}


@register_node("ai.extract")
async def ai_extract(config: dict, input_data: dict, credential_id: str, db) -> dict:
    """
    Ask the LLM to extract/classify data from the input and return strict JSON.

    config:
      - schema_description: plain-English description of the fields wanted,
        e.g. "category: one of 'sales','support','spam'; urgency: 1-5; summary: string"
      - text: the text to analyze (templated from input_data); defaults to
        the whole input_data as JSON if not provided.
    """
    provider = _pick_provider(config)
    model = config.get("model", "")
    max_tokens = int(config.get("max_tokens", 1024))

    schema_description = config.get("schema_description", "")
    if not schema_description:
        raise ValueError("ai.extract requires 'schema_description'.")

    text = config.get("text")
    text = _render_template(text, input_data) if text else json.dumps(input_data)

    system_prompt = (
        "You extract structured data and respond with ONLY a single valid JSON "
        "object — no markdown fences, no commentary, no explanation."
    )
    prompt = (
        f"From the following input, extract fields matching this description:\n"
        f"{schema_description}\n\n"
        f"Input:\n{text}\n\n"
        f"Respond with only the JSON object."
    )

    raw = await _call_llm(provider, model, system_prompt, prompt, max_tokens, 0)

    # Strip accidental markdown fences if the model adds them anyway.
    cleaned = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()

    try:
        parsed = json.loads(cleaned)
    except Exception as e:
        return {"parsed": None, "raw": raw, "error": f"Could not parse JSON: {e}"}

    result = {"raw": raw}
    if isinstance(parsed, dict):
        result.update(parsed)
    else:
        result["parsed"] = parsed
    return result