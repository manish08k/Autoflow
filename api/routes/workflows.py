"""Workflow CRUD + activate/deactivate + manual trigger."""
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from storage.database import get_db
from storage.models import Execution, ExecutionStatus, Workflow, WorkflowStatus
from api.middleware.auth import get_current_user

router = APIRouter()


class WorkflowCreate(BaseModel):
    name: str
    description: Optional[str] = None
    definition: dict = {}
    settings: dict = {}


class WorkflowUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    definition: Optional[dict] = None
    settings: Optional[dict] = None


@router.get("")
async def list_workflows(
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
):
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Workflow)
        .where(Workflow.owner_id == user.id)
        .order_by(Workflow.updated_at.desc())
        .offset(offset)
        .limit(page_size)
    )
    workflows = result.scalars().all()

    total_result = await db.execute(
        select(func.count()).select_from(Workflow).where(Workflow.owner_id == user.id)
    )
    total = total_result.scalar()

    return {
        "workflows": [_serialize_workflow(w) for w in workflows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.post("", status_code=201)
async def create_workflow(
    body: WorkflowCreate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    workflow = Workflow(
        id=str(uuid.uuid4()),
        owner_id=user.id,
        name=body.name,
        description=body.description,
        definition=body.definition,
        settings=body.settings,
        status=WorkflowStatus.inactive,
    )
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return _serialize_workflow(workflow)


@router.get("/{workflow_id}")
async def get_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    workflow = await _get_owned_workflow(workflow_id, user.id, db)
    return _serialize_workflow(workflow)


@router.patch("/{workflow_id}")
async def update_workflow(
    workflow_id: str,
    body: WorkflowUpdate,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    workflow = await _get_owned_workflow(workflow_id, user.id, db)
    if body.name is not None:
        workflow.name = body.name
    if body.description is not None:
        workflow.description = body.description
    if body.definition is not None:
        workflow.definition = body.definition
    if body.settings is not None:
        workflow.settings = body.settings
    await db.commit()
    await db.refresh(workflow)
    return _serialize_workflow(workflow)


@router.delete("/{workflow_id}", status_code=204)
async def delete_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    workflow = await _get_owned_workflow(workflow_id, user.id, db)
    await db.delete(workflow)
    await db.commit()


@router.post("/{workflow_id}/activate")
async def activate_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    workflow = await _get_owned_workflow(workflow_id, user.id, db)
    workflow.status = WorkflowStatus.active
    await db.commit()
    return {"status": "active"}


@router.post("/{workflow_id}/deactivate")
async def deactivate_workflow(
    workflow_id: str,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    workflow = await _get_owned_workflow(workflow_id, user.id, db)
    workflow.status = WorkflowStatus.inactive
    await db.commit()
    return {"status": "inactive"}


@router.post("/{workflow_id}/execute")
async def manual_execute(
    workflow_id: str,
    trigger_data: dict = {},
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    workflow = await _get_owned_workflow(workflow_id, user.id, db)

    execution = Execution(
        id=str(uuid.uuid4()),
        workflow_id=workflow_id,
        status=ExecutionStatus.queued,
        trigger_type="manual",
        trigger_data=trigger_data,
    )
    db.add(execution)
    await db.commit()

    from workers.tasks import run_workflow_task
    run_workflow_task.apply_async(
        args=[execution.id, workflow.definition, trigger_data],
        queue="workflows",
    )
    return {"execution_id": execution.id, "status": "queued"}


async def _get_owned_workflow(workflow_id: str, user_id: str, db: AsyncSession) -> Workflow:
    result = await db.execute(
        select(Workflow).where(Workflow.id == workflow_id, Workflow.owner_id == user_id)
    )
    workflow = result.scalar_one_or_none()
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow


def _serialize_workflow(w: Workflow) -> dict:
    return {
        "id": w.id,
        "name": w.name,
        "description": w.description,
        "status": w.status,
        "definition": w.definition,
        "settings": w.settings,
        "created_at": w.created_at.isoformat(),
        "updated_at": w.updated_at.isoformat(),
    }
