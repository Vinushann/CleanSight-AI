from fastapi import APIRouter
from typing import Dict, Any

router = APIRouter()

@router.get("/summary", response_model=Dict[str, Any])
async def get_dashboard_summary():
    """
    Get aggregated dashboard statistics including overall cleaning score, 
    anomalies, and system-wide metrics.
    """
    return {
        "status": "success",
        "cleaning_score": 92,
        "cleanliness_status": "Excellent",
        "dust_trend": "Improving",
        "iaq_status": "Good",
        "critical_alerts": 0
    }
