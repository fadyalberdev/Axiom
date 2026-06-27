import logging
import logging.config
import time
from uuid import uuid4

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

_LOG_FORMAT = "%(asctime)s %(levelname)-8s %(name)s: %(message)s"
_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

logger = logging.getLogger("axiom.access")


def configure_logging(level: str = "INFO") -> None:
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": _LOG_FORMAT,
                    "datefmt": _DATE_FORMAT,
                }
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                }
            },
            "loggers": {
                # Third-party libraries — always WARNING regardless of app level
                "httpcore": {"level": "WARNING", "propagate": True},
                "httpx": {"level": "WARNING", "propagate": True},
                "hpack": {"level": "WARNING", "propagate": True},
                "uvicorn.access": {"level": "WARNING", "propagate": True},
            },
            "root": {"handlers": ["console"], "level": level},
        }
    )


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get("X-Request-ID") or uuid4().hex
        request.state.request_id = rid
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path == "/api/health":
            return await call_next(request)

        start = time.monotonic()
        response = await call_next(request)
        latency_ms = round((time.monotonic() - start) * 1000)

        rid = getattr(request.state, "request_id", "-")
        ip = request.client.host if request.client else "-"
        logger.info(
            "req=%s %s %s %s %dms ip=%s",
            rid,
            request.method,
            request.url.path,
            response.status_code,
            latency_ms,
            ip,
        )
        return response
