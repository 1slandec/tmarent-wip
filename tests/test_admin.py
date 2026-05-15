import pytest

from tests.conftest import create_client

pytestmark = pytest.mark.asyncio


async def test_admin_endpoint_requires_employee(
    api_client,
    db_connection,
    auth_headers,
):
    regular_client = await create_client(db_connection)
    admin_client = await create_client(db_connection)
    await db_connection.execute(
        """
        INSERT INTO employee (full_name, role, client_id)
        VALUES ('Test Admin', 'admin', $1)
        """,
        admin_client["client_id"],
    )
    payload = {
        "address": "Test Admin Branch",
        "capacity": 5,
        "latitude": None,
        "longitude": None,
    }

    forbidden_response = await api_client.post(
        "/admin/branches",
        json=payload,
        headers=auth_headers(regular_client["client_id"]),
    )
    allowed_response = await api_client.post(
        "/admin/branches",
        json=payload,
        headers=auth_headers(admin_client["client_id"]),
    )

    assert forbidden_response.status_code == 403
    assert forbidden_response.json() == {
        "error_code": "FORBIDDEN",
        "message": "Admin access required",
    }
    assert allowed_response.status_code == 200
    assert allowed_response.json()["branch_id"] > 0
