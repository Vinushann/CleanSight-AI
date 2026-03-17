from fastapi import APIRouter

router = APIRouter()

@router.get("/me")
async def get_current_user():
    """
    Get details for the authenticated user.
    """
    return {
        "user_id": "u_123",
        "email": "supervisor@cleansight.ai",
        "role": "cleaning_supervisor",
        "name": "Jane Supervisor"
    }

@router.get("/buildings")
async def get_buildings():
    """
    Get allowed buildings for the current user.
    """
    return [
        {"id": "b_1", "name": "Main Office Tower"}
    ]
