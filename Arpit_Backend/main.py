import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import settings
from logging_config import configure_logging, request_id_ctx
from routers import audit, auth, dashboard, intake, inventory, matching, materials, users, vendors

configure_logging(settings.LOG_LEVEL)
logger = logging.getLogger("saarthi.api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Saarthi API starting (environment: %s)", settings.ENVIRONMENT)
    yield
    logger.info("Saarthi API shutting down")


app = FastAPI(
    title="Saarthi – Unified Material Master",
    description="Backend API for BharatOil's material master data platform",
    version="1.0.0",
    lifespan=lifespan,
)


# Registered BEFORE the CORS middleware on purpose: Starlette makes the last-added middleware
# the outermost one, so CORS wraps this. Unhandled errors turned into a JSON 500 here therefore
# still carry CORS headers and the browser shows the real error, not a fake network failure.
@app.middleware("http")
async def request_context(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or uuid.uuid4().hex[:12]
    token = request_id_ctx.set(request_id)
    started = time.perf_counter()
    try:
        try:
            response = await call_next(request)
        except Exception:
            logger.exception("Unhandled error on %s %s", request.method, request.url.path)
            response = JSONResponse(
                status_code=500,
                content={"detail": "Internal server error", "request_id": request_id},
            )
        response.headers["X-Request-ID"] = request_id
        logger.info(
            "%s %s -> %s (%.0f ms)",
            request.method,
            request.url.path,
            response.status_code,
            (time.perf_counter() - started) * 1000,
        )
        return response
    finally:
        request_id_ctx.reset(token)


app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.ALLOWED_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Request-ID"],
)

app.include_router(auth.router,      prefix="/auth",      tags=["Auth"])
app.include_router(intake.router,    prefix="/intake",    tags=["Intake"])
app.include_router(materials.router, prefix="/materials", tags=["Materials"])
app.include_router(matching.router,  prefix="/matching",  tags=["Matching"])
app.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])
app.include_router(vendors.router,   prefix="/vendors",   tags=["Vendors"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["Dashboard"])
app.include_router(audit.router,     prefix="/audit",     tags=["Audit"])
app.include_router(users.router,     prefix="/users",     tags=["Users"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "Saarthi API"}
