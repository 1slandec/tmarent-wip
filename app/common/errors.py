from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class BusinessError(Exception):
    def __init__(self, error_code: str, message: str, status_code: int = 400) -> None:
        self.error_code = error_code
        self.message = message
        self.status_code = status_code


def business_error_response(error: BusinessError) -> JSONResponse:
    return JSONResponse(
        status_code=error.status_code,
        content={"error_code": error.error_code, "message": error.message},
    )


def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(BusinessError)
    async def handle_business_error(_: Request, exc: BusinessError) -> JSONResponse:
        return business_error_response(exc)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(
        _: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "error_code": "validation_error",
                "message": str(exc.errors()[0]["msg"]) if exc.errors() else "Validation error",
            },
        )

    @app.exception_handler(Exception)
    async def handle_unexpected_error(_: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(
            status_code=500,
            content={"error_code": "internal_error", "message": "Internal server error"},
        )
