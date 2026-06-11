"""
Workflow Execution Engine.

- Topological sort of nodes
- Sequential + parallel execution (nodes with no dependencies run in parallel)
- Per-node retry with exponential backoff
- Full execution log persisted to DB
- Node types dispatch to integration handlers
"""
import asyncio
import time
import traceback
from collections import defaultdict, deque
from datetime import datetime
from typing import Any

import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type

from storage.models import Execution, ExecutionStatus, Workflow
from storage.database import db_context
from core.config import settings

log = structlog.get_logger(__name__)


# ─── Node dispatcher ──────────────────────────────────────────────────────────
# Maps node_type → async callable(node_config, input_data, credential_id, db)

NODE_HANDLERS: dict = {}

def register_node(node_type: str):
    """Decorator to register a node handler."""
    def decorator(fn):
        NODE_HANDLERS[node_type] = fn
        return fn
    return decorator


# ─── Topological sort ─────────────────────────────────────────────────────────

def topological_sort(nodes: list[dict], edges: list[dict]) -> list[list[str]]:
    """
    Returns execution levels: nodes in the same level can run in parallel.
    edges: [{"source": node_id, "target": node_id}]
    """
    in_degree: dict[str, int] = {n["id"]: 0 for n in nodes}
    adjacency: dict[str, list[str]] = defaultdict(list)

    for edge in edges:
        adjacency[edge["source"]].append(edge["target"])
        in_degree[edge["target"]] += 1

    queue = deque([nid for nid, deg in in_degree.items() if deg == 0])
    levels: list[list[str]] = []

    while queue:
        level = list(queue)
        levels.append(level)
        next_queue = deque()
        for nid in level:
            for neighbor in adjacency[nid]:
                in_degree[neighbor] -= 1
                if in_degree[neighbor] == 0:
                    next_queue.append(neighbor)
        queue = next_queue

    total = sum(len(l) for l in levels)
    if total != len(nodes):
        raise ValueError("Workflow graph has a cycle")

    return levels


# ─── Single node execution (with retry) ───────────────────────────────────────

async def _execute_node(
    node: dict,
    input_data: dict,
    db: AsyncSession,
) -> dict:
    node_type = node.get("type")
    handler = NODE_HANDLERS.get(node_type)
    if not handler:
        raise ValueError(f"No handler registered for node type: {node_type}")

    max_attempts = node.get("retry", {}).get("max_attempts", 1)
    wait_min = node.get("retry", {}).get("wait_min", 1)
    wait_max = node.get("retry", {}).get("wait_max", 60)

    for attempt in range(1, max_attempts + 1):
        try:
            result = await handler(
                config=node.get("config", {}),
                input_data=input_data,
                credential_id=node.get("credential_id"),
                db=db,
            )
            return result
        except Exception as exc:
            if attempt == max_attempts:
                raise
            wait = min(wait_min * (2 ** (attempt - 1)), wait_max)
            log.warning("node_retry", node_id=node["id"], attempt=attempt, wait=wait)
            await asyncio.sleep(wait)


# ─── Full workflow execution ───────────────────────────────────────────────────

async def execute_workflow(
    execution_id: str,
    workflow_definition: dict,
    trigger_data: dict,
) -> None:
    """
    Main execution entry point. Called by Celery worker.
    """
    async with db_context() as db:
        from sqlalchemy import select, update

        # Load execution row
        result = await db.execute(
            select(Execution).where(Execution.id == execution_id)
        )
        execution = result.scalar_one_or_none()
        if not execution:
            log.error("execution_not_found", execution_id=execution_id)
            return

        execution.status = ExecutionStatus.running
        execution.started_at = datetime.utcnow()
        await db.flush()

        nodes_by_id: dict[str, dict] = {
            n["id"]: n for n in workflow_definition.get("nodes", [])
        }
        edges = workflow_definition.get("edges", [])
        node_results: dict[str, Any] = {}
        context: dict[str, Any] = {"trigger": trigger_data}

        try:
            levels = topological_sort(list(nodes_by_id.values()), edges)

            for level in levels:
                # Build input for each node in this level
                tasks = []
                for node_id in level:
                    node = nodes_by_id[node_id]
                    # Collect outputs from all incoming edges as input
                    input_data = _build_node_input(node_id, edges, node_results, trigger_data)
                    tasks.append(_run_node_tracked(node, input_data, db, node_results))

                # Parallel execution within a level
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for node_id, res in zip(level, results):
                    if isinstance(res, Exception):
                        node_results[node_id] = {
                            "status": "error",
                            "error": str(res),
                        }
                        # Check if node is marked required
                        if nodes_by_id[node_id].get("required", True):
                            raise res
                    else:
                        node_results[node_id] = {"status": "success", "output": res}

            execution.status = ExecutionStatus.success

        except Exception as exc:
            execution.status = ExecutionStatus.failed
            execution.error = traceback.format_exc()
            log.error("workflow_failed", execution_id=execution_id, error=str(exc))

        finally:
            execution.node_results = node_results
            execution.finished_at = datetime.utcnow()
            await db.commit()


async def _run_node_tracked(node: dict, input_data: dict, db: AsyncSession, node_results: dict):
    start = time.monotonic()
    try:
        output = await _execute_node(node, input_data, db)
        duration_ms = int((time.monotonic() - start) * 1000)
        log.info("node_success", node_id=node["id"], type=node.get("type"), duration_ms=duration_ms)
        return output
    except Exception as exc:
        duration_ms = int((time.monotonic() - start) * 1000)
        log.error("node_failed", node_id=node["id"], type=node.get("type"),
                  duration_ms=duration_ms, error=str(exc))
        raise


def _build_node_input(node_id: str, edges: list[dict], node_results: dict, trigger_data: dict) -> dict:
    """Merge outputs of all parent nodes as input to this node."""
    parents = [e["source"] for e in edges if e["target"] == node_id]
    if not parents:
        return trigger_data

    merged = {}
    for parent_id in parents:
        if parent_id in node_results:
            result = node_results[parent_id]
            if isinstance(result, dict) and "output" in result:
                merged.update(result["output"] or {})
    return merged
