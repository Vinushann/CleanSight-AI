from fastapi import APIRouter

router = APIRouter()

@router.get("/temperature")
async def get_temperature_stats(room_id: str):
    """
    Get room temperature stats (before, during, after cleaning).
    """
    return {
        "room_id": room_id,
        "current_temp": 24.5,
        "before_temp": 24.2,
        "during_temp": 25.1,
        "after_temp": 24.5,
        "trend": "stable"
    }

@router.get("/humidity")
async def get_humidity_stats(room_id: str):
    """
    Get room humidity stats and recovery time.
    """
    return {
        "room_id": room_id,
        "current_humidity": 45.0,
        "before_humidity": 45.0,
        "during_humidity": 65.0, # Increased due to mopping
        "after_humidity": 48.0,
        "recovery_time_mins": 15
    }
