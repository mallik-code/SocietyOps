from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy import create_engine, text
from sqlalchemy.ext.asyncio import create_async_engine
import os

class Base(DeclarativeBase):
    pass

def create_standard_async_engine(url: str):
    return create_async_engine(
        url,
        echo=os.getenv("SQL_ECHO", "false").lower() == "true",
        pool_size=10,
        max_overflow=20,
        pool_timeout=30,
        pool_recycle=1800,
    )

def create_standard_sync_engine(url: str):
    return create_engine(
        url,
        echo=os.getenv("SQL_ECHO", "false").lower() == "true",
        pool_size=10,
        max_overflow=20,
    )
