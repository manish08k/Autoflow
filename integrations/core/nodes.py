"""
Core utility nodes available to every workflow:
  - http_request       — make any HTTP call
  - filter             — drop items not matching a condition
  - transform          — reshape data with a mapping
  - set_variables      — inject static values into the pipeline
  - merge              — merge multiple inputs
  - split_in_batches   — iterate over lists
  - delay              — sleep N seconds
  - condition          — branch: true/false paths
  - run_code           — execute arbitrary Python (sandboxed eval)
  - send_email_smtp    — raw SMTP fallback
  - format_date        — date formatting/conversion
  - json_parse         — parse a JSON string
  - xml_parse          — parse XML to dict
  - respond_to_webhook — return a response to an inbound webhook
"""
import asyncio
import json
import re
import smtplib
import xmltodict
from datetime import datetime
from email.mime.text import MIMEText

import arrow
import httpx
import structlog

from core.execution_engine import register_node
from core.config import settings

log = structlog.get_logger(__name__)


@register_node("http.request")
async def http_request(config: dict, input_data: dict, credential_id: str, db) -> dict:
    method = (config.get("method") or input_data.get("method", "GET")).upper()
    url = config.get("url") or input_data.get("url")
    headers = config.get("headers") or input_data.get("headers", {})
    params = config.get("params") or input_data.get("params", {})
    body = config.get("body") or input_data.get("body")
    timeout = config.get("timeout", 30)
    auth = config.get("auth")  # {"type": "bearer", "token": "..."} or {"type": "basic", ...}

    if auth:
        if auth.get("type") == "bearer":
            headers["Authorization"] = f"Bearer {auth['token']}"
        elif auth.get("type") == "basic":
            import base64
            creds = base64.b64encode(f"{auth['username']}:{auth['password']}".encode()).decode()
            headers["Authorization"] = f"Basic {creds}"

    async with httpx.AsyncClient(timeout=timeout) as client:
        r = await client.request(method, url, headers=headers, params=params,
                                  json=body if isinstance(body, dict) else None,
                                  content=body.encode() if isinstance(body, str) else None)

    response_body = None
    try:
        response_body = r.json()
    except Exception:
        response_body = r.text

    return {
        "status_code": r.status_code,
        "headers": dict(r.headers),
        "body": response_body,
        "ok": r.is_success,
    }


@register_node("core.filter")
async def core_filter(config: dict, input_data: dict, credential_id: str, db) -> dict:
    items = config.get("items") or input_data.get("items", [])
    field = config.get("field")
    operator = config.get("operator", "equals")
    value = config.get("value")

    if not isinstance(items, list):
        items = [items]

    def match(item):
        item_val = item.get(field) if isinstance(item, dict) else item
        if operator == "equals":
            return item_val == value
        elif operator == "not_equals":
            return item_val != value
        elif operator == "contains":
            return value in str(item_val)
        elif operator == "not_contains":
            return value not in str(item_val)
        elif operator == "greater_than":
            return float(item_val) > float(value)
        elif operator == "less_than":
            return float(item_val) < float(value)
        elif operator == "is_empty":
            return not item_val
        elif operator == "is_not_empty":
            return bool(item_val)
        elif operator == "regex":
            return bool(re.search(value, str(item_val)))
        return True

    filtered = [i for i in items if match(i)]
    return {"items": filtered, "count": len(filtered)}


@register_node("core.transform")
async def core_transform(config: dict, input_data: dict, credential_id: str, db) -> dict:
    mapping = config.get("mapping") or {}
    source = config.get("source") or input_data

    output = {}
    for out_key, expr in mapping.items():
        if isinstance(expr, str) and expr.startswith("{{") and expr.endswith("}}"):
            field_path = expr[2:-2].strip().split(".")
            val = source
            for part in field_path:
                if isinstance(val, dict):
                    val = val.get(part)
                else:
                    val = None
                    break
            output[out_key] = val
        else:
            output[out_key] = expr

    return output


@register_node("core.set_variables")
async def core_set_variables(config: dict, input_data: dict, credential_id: str, db) -> dict:
    variables = config.get("variables") or {}
    return {**input_data, **variables}


@register_node("core.merge")
async def core_merge(config: dict, input_data: dict, credential_id: str, db) -> dict:
    mode = config.get("mode", "merge")  # merge | append | zip
    inputs = config.get("inputs") or [input_data]

    if mode == "merge":
        result = {}
        for inp in inputs:
            if isinstance(inp, dict):
                result.update(inp)
        return result
    elif mode == "append":
        all_items = []
        for inp in inputs:
            items = inp.get("items", [inp]) if isinstance(inp, dict) else [inp]
            all_items.extend(items)
        return {"items": all_items}
    elif mode == "zip":
        lists = [inp.get("items", []) if isinstance(inp, dict) else [] for inp in inputs]
        zipped = [dict(zip(range(len(row)), row)) for row in zip(*lists)]
        return {"items": zipped}
    return input_data


@register_node("core.split_in_batches")
async def core_split_in_batches(config: dict, input_data: dict, credential_id: str, db) -> dict:
    items = config.get("items") or input_data.get("items", [])
    batch_size = config.get("batch_size", 10)

    if not isinstance(items, list):
        items = [items]

    batches = [items[i:i + batch_size] for i in range(0, len(items), batch_size)]
    return {"batches": batches, "total": len(items), "batch_count": len(batches)}


@register_node("core.delay")
async def core_delay(config: dict, input_data: dict, credential_id: str, db) -> dict:
    seconds = config.get("seconds") or input_data.get("seconds", 1)
    await asyncio.sleep(float(seconds))
    return input_data


@register_node("core.condition")
async def core_condition(config: dict, input_data: dict, credential_id: str, db) -> dict:
    field = config.get("field")
    operator = config.get("operator", "equals")
    value = config.get("value")

    item_val = input_data.get(field)
    result = False

    if operator == "equals":
        result = item_val == value
    elif operator == "not_equals":
        result = item_val != value
    elif operator == "contains":
        result = value in str(item_val or "")
    elif operator == "greater_than":
        result = float(item_val or 0) > float(value)
    elif operator == "less_than":
        result = float(item_val or 0) < float(value)
    elif operator == "is_true":
        result = bool(item_val)
    elif operator == "is_false":
        result = not bool(item_val)
    elif operator == "regex":
        result = bool(re.search(value, str(item_val or "")))

    return {"condition_result": result, "branch": "true" if result else "false", **input_data}


@register_node("core.run_code")
async def core_run_code(config: dict, input_data: dict, credential_id: str, db) -> dict:
    code = config.get("code", "")
    # Minimal sandbox — no imports, no builtins except safe ones
    safe_builtins = {
        "len": len, "str": str, "int": int, "float": float, "list": list,
        "dict": dict, "bool": bool, "range": range, "enumerate": enumerate,
        "zip": zip, "map": map, "filter": filter, "sorted": sorted,
        "sum": sum, "min": min, "max": max, "abs": abs, "round": round,
        "isinstance": isinstance, "type": type, "print": print,
        "json": json,
    }
    namespace = {"input": input_data, "__builtins__": safe_builtins}
    exec(code, namespace)
    output = namespace.get("output", input_data)
    return output if isinstance(output, dict) else {"output": output}


@register_node("core.send_email_smtp")
async def core_send_email_smtp(config: dict, input_data: dict, credential_id: str, db) -> dict:
    to = config.get("to") or input_data.get("to")
    subject = config.get("subject") or input_data.get("subject", "")
    body = config.get("body") or input_data.get("body", "")

    msg = MIMEText(body, "html" if config.get("html") else "plain")
    msg["Subject"] = subject
    msg["From"] = settings.SMTP_USERNAME
    msg["To"] = to

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
        if settings.SMTP_TLS if hasattr(settings, "SMTP_TLS") else True:
            server.starttls()
        server.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        server.send_message(msg)

    return {"ok": True, "to": to, "subject": subject}


@register_node("core.format_date")
async def core_format_date(config: dict, input_data: dict, credential_id: str, db) -> dict:
    date_value = config.get("date") or input_data.get("date") or input_data.get("timestamp")
    output_format = config.get("output_format", "YYYY-MM-DD HH:mm:ss")
    input_tz = config.get("input_timezone", "UTC")
    output_tz = config.get("output_timezone", "UTC")

    dt = arrow.get(date_value).to(input_tz)
    converted = dt.to(output_tz)

    return {
        "formatted": converted.format(output_format),
        "iso": converted.isoformat(),
        "timestamp": converted.timestamp(),
    }


@register_node("core.json_parse")
async def core_json_parse(config: dict, input_data: dict, credential_id: str, db) -> dict:
    raw = config.get("json_string") or input_data.get("json_string") or input_data.get("body")
    if isinstance(raw, (dict, list)):
        return {"parsed": raw}
    try:
        return {"parsed": json.loads(raw)}
    except Exception as e:
        return {"parsed": None, "error": str(e)}


@register_node("core.xml_parse")
async def core_xml_parse(config: dict, input_data: dict, credential_id: str, db) -> dict:
    raw = config.get("xml_string") or input_data.get("xml_string") or input_data.get("body", "")
    try:
        return {"parsed": xmltodict.parse(raw)}
    except Exception as e:
        return {"parsed": None, "error": str(e)}


@register_node("core.respond_to_webhook")
async def core_respond_to_webhook(config: dict, input_data: dict, credential_id: str, db) -> dict:
    status_code = config.get("status_code", 200)
    response_body = config.get("body") or input_data.get("response_body", {"ok": True})
    return {"__webhook_response__": True, "status_code": status_code, "body": response_body}
