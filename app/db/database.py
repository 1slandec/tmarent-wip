from collections.abc import AsyncIterator

import asyncpg
from fastapi import Request

from app.config import Settings


async def create_pool(settings: Settings) -> asyncpg.Pool:
    return await asyncpg.create_pool(dsn=settings.database_url, min_size=0, max_size=10)


async def get_pool(request: Request) -> asyncpg.Pool:
    return request.app.state.db_pool


async def acquire_connection(request: Request) -> AsyncIterator[asyncpg.Connection]:
    pool: asyncpg.Pool = request.app.state.db_pool
    async with pool.acquire() as connection:
        yield connection
