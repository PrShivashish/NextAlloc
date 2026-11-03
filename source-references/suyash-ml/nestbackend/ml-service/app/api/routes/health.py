from datetime import datetime, timezone

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app.dependencies import model_manager

router = APIRouter()


@router.get("/health")
async def health_check():
    """Liveness: the process is up and serving HTTP."""
    return {
        "status": "healthy",
        "service": "PM Internship Matching ML Service",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.1.0",
    }


@router.get("/ready")
async def readiness_check():
    """Readiness: the embedding model is loaded, so /matching calls will succeed."""
    encoder_loaded = model_manager.skill_encoder is not None
    body = {
        "status": "ready" if encoder_loaded else "loading",
        "encoder_loaded": encoder_loaded,
        "ranker_loaded": model_manager.ranker is not None,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return JSONResponse(status_code=200 if encoder_loaded else 503, content=body)
