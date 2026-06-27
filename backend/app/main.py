import asyncio
import logging
import time
import traceback
from collections import defaultdict
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from app.config import settings
from app.observability import (
    RequestIDMiddleware,
    RequestLoggingMiddleware,
    configure_logging,
)
from app.auth.router import router as auth_router
from app.listings.router import router as listings_router
from app.dashboard.router import router as dashboard_router
from app.agencies.router import router as agencies_router
from app.blog.router import router as blog_router
from app.admin.router import router as admin_router
from app.ai.router import router as ai_router
from app.uploads.router import router as uploads_router
from app.subscriptions.lapse import lapse_sweep_loop
from app.stripe_webhooks.router import router as stripe_webhooks_router
from app.projects.router import router as projects_router
from app.leads.router import router as leads_router
from app.universities.router import router as universities_router
from app.subscriptions.router import router as subscriptions_router
from app.contact.router import router as contact_router


_rate_windows: dict[str, list[float]] = defaultdict(list)
_RATE_RULES = [
    ("/api/ai/", 10, 60),       # AI endpoints: 10 req/min per IP (Ollama cost)
    ("/api/auth/login", 5, 60), # Login brute-force protection
    ("/api/auth/signup", 5, 60),
]


class RateLimitMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        ip = request.client.host if request.client else "unknown"
        path = request.url.path
        now = time.time()
        for prefix, max_req, window in _RATE_RULES:
            if path.startswith(prefix):
                key = f"{ip}:{prefix}"
                calls = [t for t in _rate_windows[key] if now - t < window]
                # Prune empty keys to bound dict size
                if not calls:
                    _rate_windows.pop(key, None)
                if len(calls) >= max_req:
                    return JSONResponse(
                        {"detail": "Too many requests"},
                        status_code=429,
                        headers={
                            "Retry-After": str(window),
                            "X-RateLimit-Limit": str(max_req),
                            "X-RateLimit-Remaining": "0",
                        },
                    )
                calls.append(now)
                _rate_windows[key] = calls
                response = await call_next(request)
                response.headers["X-RateLimit-Limit"] = str(max_req)
                response.headers["X-RateLimit-Remaining"] = str(max_req - len(calls))
                return response
        return await call_next(request)


_CSP = "default-src 'self'"

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Content-Security-Policy"] = _CSP
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        if settings.environment != "development":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )
        return response


_startup_logger = logging.getLogger("axiom.startup")


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging(level="DEBUG" if settings.environment == "development" else "INFO")
    _startup_logger.info("AXIOM V2 starting up (env=%s)", settings.environment)
    lapse_task = asyncio.create_task(lapse_sweep_loop())
    try:
        yield
    finally:
        lapse_task.cancel()
        try:
            await lapse_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="AXIOM V2 API",
    version="2.0.0",
    description="AI-powered real estate platform API for Egypt",
    lifespan=lifespan,
)

_dev_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]

app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=(
        _dev_origins if settings.environment == "development" else [settings.frontend_url]
    ),
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(RequestIDMiddleware)  # outermost — runs first on every request


_error_logger = logging.getLogger("axiom.errors")


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    rid = getattr(request.state, "request_id", "-")
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors(), "request_id": rid},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    rid = getattr(request.state, "request_id", "-")
    _error_logger.error(
        "Unhandled exception req=%s: %s\n%s",
        rid,
        exc,
        traceback.format_exc(),
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "request_id": rid},
    )


@app.get("/api/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(listings_router, prefix="/api/listings", tags=["listings"])
app.include_router(dashboard_router, prefix="/api/dashboard", tags=["dashboard"])
app.include_router(agencies_router, prefix="/api/agencies", tags=["agencies"])
app.include_router(blog_router, prefix="/api/blog", tags=["blog"])
app.include_router(admin_router, prefix="/api/admin", tags=["admin"])
app.include_router(ai_router, prefix="/api/ai", tags=["ai"])
app.include_router(uploads_router, prefix="/api/uploads", tags=["uploads"])
app.include_router(stripe_webhooks_router, prefix="/api/stripe", tags=["stripe"])
app.include_router(projects_router, prefix="/api/projects", tags=["projects"])
app.include_router(leads_router, prefix="/api", tags=["leads"])
app.include_router(universities_router, prefix="/api/universities", tags=["universities"])
app.include_router(subscriptions_router, prefix="/api/subscriptions", tags=["subscriptions"])
app.include_router(contact_router, prefix="/api/contact", tags=["contact"])
