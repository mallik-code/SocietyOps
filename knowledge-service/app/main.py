from contextlib import asynccontextmanager
from fastapi import FastAPI
from app.routers import knowledge
from app.database import init_db
import logging

logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing knowledge database...")
    await init_db()
    logger.info("Knowledge database ready.")
    yield

app = FastAPI(
    title="Knowledge Engine Service",
    lifespan=lifespan
)

# Include Routers
app.include_router(knowledge.router)

@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok", "service": "knowledge-engine"}
