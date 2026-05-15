import os
import uuid
from datetime import datetime, timedelta, timezone

import asyncpg
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

from app.auth.jwt import create_access_token
from app.config import get_settings
from app.db.database import acquire_connection, get_pool
from app.main import app


class SingleConnectionAcquire:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    async def __aenter__(self) -> asyncpg.Connection:
        return self.connection

    async def __aexit__(self, exc_type, exc, tb) -> bool:
        return False


class SingleConnectionPool:
    def __init__(self, connection: asyncpg.Connection) -> None:
        self.connection = connection

    def acquire(self) -> SingleConnectionAcquire:
        return SingleConnectionAcquire(self.connection)


def _database_url() -> str:
    test_database_url = os.getenv("TEST_DATABASE_URL")
    database_url = test_database_url or get_settings().database_url
    if test_database_url is None and not any(
        host in database_url for host in ("localhost", "127.0.0.1", "::1")
    ):
        pytest.skip("Set TEST_DATABASE_URL to avoid running tests against a remote DB")
    return database_url


@pytest_asyncio.fixture
async def db_connection() -> asyncpg.Connection:
    connection = await asyncpg.connect(dsn=_database_url())
    transaction = connection.transaction()
    await transaction.start()
    try:
        yield connection
    finally:
        await transaction.rollback()
        await connection.close()


@pytest_asyncio.fixture
async def api_client(db_connection: asyncpg.Connection) -> AsyncClient:
    pool = SingleConnectionPool(db_connection)

    async def override_acquire_connection():
        yield db_connection

    async def override_get_pool():
        return pool

    app.dependency_overrides[acquire_connection] = override_acquire_connection
    app.dependency_overrides[get_pool] = override_get_pool

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://testserver") as client:
        yield client

    app.dependency_overrides.clear()


@pytest.fixture
def auth_headers():
    def build(client_id: int) -> dict[str, str]:
        token = create_access_token(client_id, get_settings())
        return {"Authorization": f"Bearer {token}"}

    return build


@pytest.fixture
def future_dates():
    start_date = datetime.now(timezone.utc).date() + timedelta(days=10)
    end_date = start_date + timedelta(days=2)
    return start_date, end_date


def unique_int() -> int:
    return uuid.uuid4().int % 9_000_000_000_000


async def create_client(
    connection: asyncpg.Connection,
    *,
    profile_completed: bool = True,
) -> asyncpg.Record:
    suffix = unique_int()
    full_name = "Test Client" if profile_completed else None
    age = 30 if profile_completed else None
    license_no = f"LIC{suffix}" if profile_completed else None
    return await connection.fetchrow(
        """
        INSERT INTO client (
            full_name,
            age,
            license_no,
            telegram_id,
            username,
            profile_completed,
            created_at,
            updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING client_id
        """,
        full_name,
        age,
        license_no,
        1_000_000_000_000 + suffix,
        f"test_user_{suffix}",
        profile_completed,
    )


async def create_branch(connection: asyncpg.Connection) -> asyncpg.Record:
    suffix = unique_int()
    return await connection.fetchrow(
        """
        INSERT INTO branch (address, capacity, latitude, longitude, created_at)
        VALUES ($1, 10, NULL, NULL, NOW())
        RETURNING branch_id
        """,
        f"Test Branch {suffix}",
    )


async def create_car(
    connection: asyncpg.Connection,
    branch_id: int,
    *,
    status: str = "available",
) -> asyncpg.Record:
    suffix = unique_int()
    return await connection.fetchrow(
        """
        INSERT INTO car (
            model,
            year,
            branch_id,
            price_per_day,
            status,
            image_url,
            created_at,
            updated_at
        )
        VALUES ($1, 2022, $2, 100, $3::car_status, NULL, NOW(), NOW())
        RETURNING car_id
        """,
        f"Test Car {suffix}",
        branch_id,
        status,
    )
