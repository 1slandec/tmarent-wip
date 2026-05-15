import asyncpg
from fastapi import Depends

from app.admin.repository import AdminRepository
from app.common.dependencies import get_current_client_id
from app.common.errors import BusinessError
from app.db.database import acquire_connection


async def require_admin(
    client_id: int = Depends(get_current_client_id),
    connection: asyncpg.Connection = Depends(acquire_connection),
) -> int:
    employee = await AdminRepository().get_employee_by_client_id(connection, client_id)
    if employee is None:
        raise BusinessError(
            "FORBIDDEN",
            "Admin access required",
            status_code=403,
        )
    return employee["employee_id"]
