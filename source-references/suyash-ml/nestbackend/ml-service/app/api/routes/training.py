from fastapi import APIRouter, HTTPException
from loguru import logger

from app.dependencies import model_manager
from app.models.schemas import TrainRequest, TrainResponse
from app.services.training_service import TrainingService

router = APIRouter()


@router.post("/train", response_model=TrainResponse)
def train_ranker(request: TrainRequest):
    """Train the internship-matching ranker on a synthetic dataset."""
    try:
        service = TrainingService(model_manager)
        result = service.train(n_samples=request.n_samples, seed=request.random_seed)
        return TrainResponse(**result)
    except Exception as e:
        logger.error(f"Training failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def ranker_status():
    """Return whether a trained ranker is currently loaded."""
    loaded = model_manager.ranker is not None
    return {
        "ranker_loaded": loaded,
        "features": model_manager.ranker_features,
        "cache": model_manager.cache_stats(),
    }
