import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db
from app.routers import webhooks, tickets, supervisor, reports, openclaw

logging.basicConfig(
    level=os.getenv("LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initialising database …")
    init_db()
    logger.info("Database ready.")
    yield
    logger.info("Shutting down.")


app = FastAPI(
    title="WhatsApp Complaint Management API",
    description=(
        "AI-powered backend for receiving, classifying, and tracking "
        "citizen complaints forwarded via WhatsApp through OpenClaw."
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks.router)
app.include_router(tickets.router)
app.include_router(supervisor.router)
app.include_router(reports.router)
app.include_router(openclaw.router)


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "complaint-management"}
