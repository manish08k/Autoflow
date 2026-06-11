"""
Database models.
Every table is defined here — workflows, executions, credentials, triggers,
schedules, webhook registrations, OAuth state, audit log.
"""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, ForeignKey, Index,
    Integer, String, Text, JSON, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, relationship
import enum


class Base(DeclarativeBase):
    pass


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.utcnow()


# ─────────────────────────────────────────────────────────────────────────────
#  Users
# ─────────────────────────────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    email = Column(String(255), unique=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    credentials = relationship("OAuthCredential", back_populates="user", cascade="all, delete-orphan")
    workflows = relationship("Workflow", back_populates="owner", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
#  OAuth Credentials  (one row per connected account per user)
# ─────────────────────────────────────────────────────────────────────────────
class OAuthCredential(Base):
    __tablename__ = "oauth_credentials"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    provider = Column(String(64), nullable=False)          # "google", "slack", …
    label = Column(String(255), nullable=False)            # human name user gives it
    scope = Column(Text, nullable=True)                    # space-separated granted scopes
    encrypted_token = Column(Text, nullable=False)         # AES-256-GCM blob
    external_account_id = Column(String(255), nullable=True)   # e.g. Slack workspace ID
    external_account_name = Column(String(255), nullable=True) # e.g. "My Workspace"
    is_valid = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    user = relationship("User", back_populates="credentials")

    __table_args__ = (
        Index("ix_cred_user_provider", "user_id", "provider"),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  OAuth State  (CSRF protection during OAuth dance)
# ─────────────────────────────────────────────────────────────────────────────
class OAuthState(Base):
    __tablename__ = "oauth_states"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    state = Column(String(128), unique=True, nullable=False)  # random nonce
    user_id = Column(UUID(as_uuid=False), nullable=False)
    provider = Column(String(64), nullable=False)
    label = Column(String(255), nullable=True)
    extra = Column(JSON, default=dict)                        # pkce_verifier, etc.
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)


# ─────────────────────────────────────────────────────────────────────────────
#  Workflows
# ─────────────────────────────────────────────────────────────────────────────
class WorkflowStatus(str, enum.Enum):
    active = "active"
    inactive = "inactive"
    error = "error"


class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    owner_id = Column(UUID(as_uuid=False), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(Enum(WorkflowStatus), default=WorkflowStatus.inactive)
    definition = Column(JSON, nullable=False, default=dict)   # nodes + edges
    settings = Column(JSON, default=dict)                     # timeout, retries, etc.
    created_at = Column(DateTime, default=_now)
    updated_at = Column(DateTime, default=_now, onupdate=_now)

    owner = relationship("User", back_populates="workflows")
    executions = relationship("Execution", back_populates="workflow", cascade="all, delete-orphan")
    triggers = relationship("Trigger", back_populates="workflow", cascade="all, delete-orphan")
    schedules = relationship("Schedule", back_populates="workflow", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
#  Executions
# ─────────────────────────────────────────────────────────────────────────────
class ExecutionStatus(str, enum.Enum):
    queued = "queued"
    running = "running"
    success = "success"
    failed = "failed"
    cancelled = "cancelled"


class Execution(Base):
    __tablename__ = "executions"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    workflow_id = Column(UUID(as_uuid=False), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    status = Column(Enum(ExecutionStatus), default=ExecutionStatus.queued)
    trigger_type = Column(String(64), nullable=True)   # "schedule", "webhook", "manual", …
    trigger_data = Column(JSON, default=dict)
    node_results = Column(JSON, default=dict)           # {node_id: {output, error, duration_ms}}
    error = Column(Text, nullable=True)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    workflow = relationship("Workflow", back_populates="executions")

    __table_args__ = (
        Index("ix_exec_workflow_status", "workflow_id", "status"),
        Index("ix_exec_created", "created_at"),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Triggers  (webhook, polling, event-based)
# ─────────────────────────────────────────────────────────────────────────────
class TriggerType(str, enum.Enum):
    webhook = "webhook"
    polling = "polling"
    event = "event"


class Trigger(Base):
    __tablename__ = "triggers"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    workflow_id = Column(UUID(as_uuid=False), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    trigger_type = Column(Enum(TriggerType), nullable=False)
    provider = Column(String(64), nullable=False)      # "slack", "github", "whatsapp", …
    event = Column(String(128), nullable=False)        # "message", "push", "new_row", …
    config = Column(JSON, default=dict)                # provider-specific config
    credential_id = Column(UUID(as_uuid=False), ForeignKey("oauth_credentials.id", ondelete="SET NULL"), nullable=True)
    webhook_id = Column(String(255), nullable=True)    # remote webhook ID after registration
    is_active = Column(Boolean, default=True)
    last_triggered_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    workflow = relationship("Workflow", back_populates="triggers")

    __table_args__ = (
        Index("ix_trigger_workflow", "workflow_id"),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Schedules  (cron / interval)
# ─────────────────────────────────────────────────────────────────────────────
class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    workflow_id = Column(UUID(as_uuid=False), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    cron_expression = Column(String(128), nullable=True)   # "0 9 * * 1-5"
    interval_seconds = Column(Integer, nullable=True)
    timezone = Column(String(64), default="UTC")
    is_active = Column(Boolean, default=True)
    next_run_at = Column(DateTime, nullable=True)
    last_run_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=_now)

    workflow = relationship("Workflow", back_populates="schedules")


# ─────────────────────────────────────────────────────────────────────────────
#  Webhook Endpoints  (inbound URLs AutoFlow exposes)
# ─────────────────────────────────────────────────────────────────────────────
class WebhookEndpoint(Base):
    __tablename__ = "webhook_endpoints"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    path_token = Column(String(128), unique=True, nullable=False)   # random slug in URL
    workflow_id = Column(UUID(as_uuid=False), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    trigger_id = Column(UUID(as_uuid=False), ForeignKey("triggers.id", ondelete="CASCADE"), nullable=True)
    secret = Column(String(255), nullable=True)     # HMAC secret for signature validation
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_webhook_path", "path_token"),
    )


# ─────────────────────────────────────────────────────────────────────────────
#  Audit Log
# ─────────────────────────────────────────────────────────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(UUID(as_uuid=False), primary_key=True, default=_uuid)
    user_id = Column(UUID(as_uuid=False), nullable=True)
    action = Column(String(128), nullable=False)
    resource_type = Column(String(64), nullable=True)
    resource_id = Column(String(128), nullable=True)
    meta = Column(JSON, default=dict)
    ip_address = Column(String(64), nullable=True)
    created_at = Column(DateTime, default=_now)

    __table_args__ = (
        Index("ix_audit_user", "user_id"),
        Index("ix_audit_created", "created_at"),
    )
