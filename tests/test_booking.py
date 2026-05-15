from datetime import datetime, timedelta, timezone

import pytest

from tests.conftest import create_branch, create_car, create_client

pytestmark = pytest.mark.asyncio


async def test_create_booking_success(
    api_client,
    db_connection,
    auth_headers,
    future_dates,
):
    client = await create_client(db_connection)
    branch = await create_branch(db_connection)
    car = await create_car(db_connection, branch["branch_id"])
    start_date, end_date = future_dates

    response = await api_client.post(
        "/booking",
        json={
            "car_id": car["car_id"],
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        headers=auth_headers(client["client_id"]),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "pending"
    assert body["reserved_until"] is not None

    booking = await db_connection.fetchrow(
        """
        SELECT status::text AS status, reserved_until
        FROM booking
        WHERE booking_id = $1
        """,
        body["booking_id"],
    )
    assert booking["status"] == "pending"
    assert booking["reserved_until"] is not None


async def test_booking_requires_completed_profile(
    api_client,
    db_connection,
    auth_headers,
    future_dates,
):
    client = await create_client(db_connection, profile_completed=False)
    branch = await create_branch(db_connection)
    car = await create_car(db_connection, branch["branch_id"])
    start_date, end_date = future_dates

    response = await api_client.post(
        "/booking",
        json={
            "car_id": car["car_id"],
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        headers=auth_headers(client["client_id"]),
    )

    assert response.status_code == 400
    assert response.json() == {
        "error_code": "PROFILE_INCOMPLETE",
        "message": "Complete profile before booking",
    }


async def test_prevent_overlapping_booking(
    api_client,
    db_connection,
    auth_headers,
    future_dates,
):
    first_client = await create_client(db_connection)
    second_client = await create_client(db_connection)
    branch = await create_branch(db_connection)
    car = await create_car(db_connection, branch["branch_id"])
    start_date, end_date = future_dates
    payload = {
        "car_id": car["car_id"],
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
    }

    first_response = await api_client.post(
        "/booking",
        json=payload,
        headers=auth_headers(first_client["client_id"]),
    )
    second_response = await api_client.post(
        "/booking",
        json=payload,
        headers=auth_headers(second_client["client_id"]),
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 400
    assert second_response.json()["error_code"] == "double_booking"


async def test_confirm_booking_success(
    api_client,
    db_connection,
    auth_headers,
    future_dates,
):
    client = await create_client(db_connection)
    branch = await create_branch(db_connection)
    car = await create_car(db_connection, branch["branch_id"])
    start_date, end_date = future_dates
    headers = auth_headers(client["client_id"])

    booking_response = await api_client.post(
        "/booking",
        json={
            "car_id": car["car_id"],
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
        },
        headers=headers,
    )
    booking_id = booking_response.json()["booking_id"]

    confirm_response = await api_client.post(
        "/booking/confirm",
        json={"booking_id": booking_id, "method": "card"},
        headers=headers,
    )

    assert confirm_response.status_code == 200
    body = confirm_response.json()
    assert body["booking_status"] == "confirmed"
    assert body["payment"]["status"] == "paid"
    assert body["agreement"]["status"] == "active"

    persisted = await db_connection.fetchrow(
        """
        SELECT
            b.status::text AS booking_status,
            a.status::text AS agreement_status,
            p.status::text AS payment_status
        FROM booking b
        JOIN agreement a ON a.booking_id = b.booking_id
        JOIN payment p ON p.agreement_id = a.agreement_id
        WHERE b.booking_id = $1
        """,
        booking_id,
    )
    assert persisted["booking_status"] == "confirmed"
    assert persisted["agreement_status"] == "active"
    assert persisted["payment_status"] == "paid"


async def test_confirm_expired_booking_fails(
    api_client,
    db_connection,
    auth_headers,
    future_dates,
):
    client = await create_client(db_connection)
    branch = await create_branch(db_connection)
    car = await create_car(db_connection, branch["branch_id"], status="reserved")
    start_date, end_date = future_dates
    expired_at = datetime.now(timezone.utc) - timedelta(minutes=5)
    booking_id = await db_connection.fetchval(
        """
        INSERT INTO booking (
            client_id,
            car_id,
            start_date,
            end_date,
            status,
            reserved_until,
            total_price,
            created_at,
            updated_at
        )
        VALUES (
            $1,
            $2,
            $3,
            $4,
            'pending'::booking_status,
            $5,
            300,
            NOW(),
            NOW()
        )
        RETURNING booking_id
        """,
        client["client_id"],
        car["car_id"],
        start_date,
        end_date,
        expired_at,
    )

    response = await api_client.post(
        "/booking/confirm",
        json={"booking_id": booking_id, "method": "card"},
        headers=auth_headers(client["client_id"]),
    )

    assert response.status_code == 400
    assert response.json()["error_code"] == "BOOKING_EXPIRED"
