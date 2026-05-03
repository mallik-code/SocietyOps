import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from societyops_dependencies.database.patterns import Base, create_standard_async_engine
from societyops_dependencies.interfaces.ai import EmbeddingProvider

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://evolution:change-me-db-pass@postgres:5432/knowledge"
)

engine = create_standard_async_engine(DATABASE_URL)

AsyncSessionLocal = async_sessionmaker(
    engine,
    expire_on_commit=False,
    class_=AsyncSession
)

async def get_db():
    async with AsyncSessionLocal() as session:
        async with session.begin():
            yield session

async def init_db():
    from app import models

    async with engine.begin() as conn:
        # Only for dev; move to migrations in prod
        await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
        await conn.run_sync(Base.metadata.create_all)
