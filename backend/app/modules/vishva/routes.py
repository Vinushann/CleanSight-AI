from fastapi import APIRouter

router = APIRouter()

@router.get("/dust-status")
async def get_dust_status(room_id: str):
    """
    Get dust comparisons (before, during, after cleaning)
    """
    return {
        "room_id": room_id,
        "before_pm25": 45.0,
        "during_pm25": 80.0,
        "after_pm25": 12.0,
        "improvement_percentage": 73.3
    }

@router.get("/air-quality")
async def get_air_quality(room_id: str):
    """
    Get air quality (gas/VOC) comparisons.
    """
    return {
        "room_id": room_id,
        "before_voc": 110,
        "during_voc": 150,
        "after_voc": 50,
        "status": "Good"
    }
