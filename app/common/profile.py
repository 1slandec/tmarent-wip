from app.common.errors import BusinessError


def is_profile_completed(client) -> bool:
    return bool(
        client
        and client["profile_completed"]
        and client["full_name"] is not None
        and client["age"] is not None
        and client["license_no"] is not None
    )


def ensure_profile_completed(client) -> None:
    if not is_profile_completed(client):
        raise BusinessError(
            "PROFILE_INCOMPLETE",
            "Complete profile before booking",
            status_code=400,
        )
