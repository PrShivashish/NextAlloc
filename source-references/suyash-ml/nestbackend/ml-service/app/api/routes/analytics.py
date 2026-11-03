from fastapi import APIRouter, HTTPException
from loguru import logger

from app.models.schemas import AnalyticsRequest, AnalyticsResponse
from app.services.analytics_service import AnalyticsService

router = APIRouter()

@router.post("/generate", response_model=AnalyticsResponse)
def generate_analytics(request: AnalyticsRequest):
    try:
        logger.info(f"Generating analytics for {len(request.match_results)} match results")
        
        analytics = AnalyticsService.generate_analytics(request.match_results)
        
        return analytics
        
    except Exception as e:
        logger.error(f"Error generating analytics: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
