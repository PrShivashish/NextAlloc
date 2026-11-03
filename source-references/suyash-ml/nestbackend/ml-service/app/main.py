import sys
import time
import uuid
from contextlib import asynccontextmanager

import uvicorn
from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from loguru import logger

from app.api.routes import analytics, health, matching, training
from app.core.config import DEFAULT_API_KEY, settings
from app.dependencies import model_manager
from app.middleware.auth import verify_api_key

logger.remove()
logger.add(sys.stdout, level=settings.LOG_LEVEL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting ML Service...")
    if settings.API_KEY == DEFAULT_API_KEY:
        logger.warning("API_KEY is the default placeholder — set a real secret outside local dev")
    await model_manager.load_models()
    logger.info("Models loaded successfully")
    yield
    logger.info("Shutting down ML Service...")
    await model_manager.cleanup()


app = FastAPI(
    title="PM Internship Matching ML Service",
    description="AI/ML-based internship matching engine for PM Internship Scheme",
    version="1.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def correlation_id_middleware(request: Request, call_next):
    """Tag every log line for a request with the caller's X-Correlation-ID.

    The NestJS backend sends the batch job's correlation id, so one id can be
    grepped across both services' logs.
    """
    correlation_id = request.headers.get("x-correlation-id") or uuid.uuid4().hex[:12]
    start = time.perf_counter()
    with logger.contextualize(correlation_id=correlation_id):
        response = await call_next(request)
        if request.url.path not in ("/api/v1/health", "/api/v1/ready"):
            logger.info(
                f"[{correlation_id}] {request.method} {request.url.path} -> "
                f"{response.status_code} in {(time.perf_counter() - start) * 1000:.0f}ms"
            )
    response.headers["X-Correlation-ID"] = correlation_id
    return response


app.include_router(health.router, prefix="/api/v1", tags=["Health"])
app.include_router(
    matching.router,
    prefix="/api/v1/matching",
    tags=["Matching"],
    dependencies=[Depends(verify_api_key)],
)
app.include_router(
    analytics.router,
    prefix="/api/v1/analytics",
    tags=["Analytics"],
    dependencies=[Depends(verify_api_key)],
)
app.include_router(
    training.router,
    prefix="/api/v1/training",
    tags=["Training"],
    dependencies=[Depends(verify_api_key)],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.exception(f"Unhandled error on {request.method} {request.url.path}: {exc}")
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host=settings.ML_SERVICE_HOST,
        port=settings.ML_SERVICE_PORT,
        reload=True,
    )
