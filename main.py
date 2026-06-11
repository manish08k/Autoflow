"""AutoFlow — FastAPI application entry point."""
from contextlib import asynccontextmanager
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from prometheus_client import make_asgi_app

from core.config import settings
from storage.database import engine
from storage.models import Base
from schedules.manager import start_scheduler, stop_scheduler
from api.routes import oauth, workflows, executions, credentials, webhooks, triggers, schedules
from api.routes.auth import router as auth_router

import integrations.core.nodes
import integrations.slack.handler
import integrations.google.sheets
import integrations.google.gmail
import integrations.google.drive
import integrations.google.calendar
import integrations.whatsapp.handler
import integrations.telegram.handler
import integrations.github.handler
import integrations.notion.handler
import integrations.discord.handler
import integrations.airtable.handler
import integrations.hubspot.handler

log = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await start_scheduler()
    log.info("autoflow_started", env=settings.APP_ENV)
    yield
    await stop_scheduler()
    await engine.dispose()
    log.info("autoflow_stopped")


app = FastAPI(
    title="AutoFlow",
    description="Production-grade workflow automation platform",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.DEBUG else [settings.APP_BASE_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if settings.PROMETHEUS_ENABLED:
    metrics_app = make_asgi_app()
    app.mount("/metrics", metrics_app)

app.include_router(auth_router)
app.include_router(oauth.router,       prefix="/oauth",           tags=["OAuth"])
app.include_router(credentials.router, prefix="/api/credentials", tags=["Credentials"])
app.include_router(workflows.router,   prefix="/api/workflows",   tags=["Workflows"])
app.include_router(executions.router,  prefix="/api/executions",  tags=["Executions"])
app.include_router(triggers.router,    prefix="/api/triggers",    tags=["Triggers"])
app.include_router(schedules.router,   prefix="/api/schedules",   tags=["Schedules"])
app.include_router(webhooks.router,    prefix="/webhooks",        tags=["Webhooks"])


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "env": settings.APP_ENV}


@app.get("/api/providers", tags=["OAuth"])
async def list_providers():
    from oauth.providers import PROVIDERS
    return {"providers": [
        {"name": p.name, "display_name": p.display_name,
         "icon": p.icon, "scopes": p.default_scopes}
        for p in PROVIDERS.values()
    ]}


@app.get("/api/node-types", tags=["Workflows"])
async def list_node_types():
    from core.execution_engine import NODE_HANDLERS
    return {"node_types": sorted(NODE_HANDLERS.keys())}
