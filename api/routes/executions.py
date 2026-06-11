"""Executions router."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from storage.database import get_db
from storage.models import Execution, ExecutionStatus, Workflow
from api.middleware.auth import get_current_user

router = APIRouter()


@router.get("")
async def list_executions(
    workflow_id: str = Query(default=None),
    status: str = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    # Verify workflow ownership if filtering by workflow
    q = select(Execution).join(Workflow, Execution.workflow_id == Workflow.id).where(
        Workflow.owner_id == user.id
    )
    if workflow_id:
        q = q.where(Execution.workflow_id == workflow_id)
    if status:
        q = q.where(Execution.status == status)

    offset = (page - 1) * page_size
    result = await db.execute(q.order_by(Execution.created_at.desc()).offset(offset).limit(page_size))
    executions = result.scalars().all()
    return {"executions": [_serialize(e) for e in executions]}


@router.get("/{execution_id}")
async def get_execution(
    execution_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(Execution).join(Workflow, Execution.workflow_id == Workflow.id).where(
            Execution.id == execution_id,
            Workflow.owner_id == user.id,
        )
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    return _serialize(execution)


@router.post("/{execution_id}/cancel")
async def cancel_execution(
    execution_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    result = await db.execute(
        select(Execution).join(Workflow).where(
            Execution.id == execution_id,
            Workflow.owner_id == user.id,
            Execution.status.in_([ExecutionStatus.queued, ExecutionStatus.running]),
        )
    )
    execution = result.scalar_one_or_none()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found or not cancellable")
    execution.status = ExecutionStatus.cancelled
    await db.commit()
    return {"status": "cancelled"}


def _serialize(e: Execution) -> dict:
    return {
        "id": e.id,
        "workflow_id": e.workflow_id,
        "status": e.status,
        "trigger_type": e.trigger_type,
        "trigger_data": e.trigger_data,
        "node_results": e.node_results,
        "error": e.error,
        "started_at": e.started_at.isoformat() if e.started_at else None,
        "finished_at": e.finished_at.isoformat() if e.finished_at else None,
        "created_at": e.created_at.isoformat(),
    }
