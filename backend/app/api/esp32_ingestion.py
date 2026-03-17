from fastapi import APIRouter, HTTPException, status
from app.schemas.sensor import SensorReadingCreate
from app.core.firebase import get_db

router = APIRouter()

@router.post("/", status_code=status.HTTP_201_CREATED)
async def ingest_sensor_data(data: SensorReadingCreate):
    """
    Ingest environmental sensor data from ESP32.
    Saves the data into the 'sensor_readings' Firestore collection.
    """
    db = get_db()
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database not connected. Please ensure Firebase is setup."
        )

    try:
        # Convert Pydantic model to dictionary
        data_dict = data.model_dump()
        
        # Save to Firestore
        collection_ref = db.collection('sensor_readings')
        _, doc_ref = collection_ref.add(data_dict)
        
        return {
            "status": "success",
            "message": "Data injested successfully",
            "document_id": doc_ref.id
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save sensor data: {str(e)}"
        )
