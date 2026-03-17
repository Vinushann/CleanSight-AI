from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class SensorReadingBase(BaseModel):
    building_id: str = Field(..., description="ID of the building")
    floor_id: str = Field(..., description="ID of the floor")
    room_id: str = Field(..., description="ID of the room")
    session_id: str = Field(..., description="ID of the cleaning session")
    sensor_id: str = Field(..., description="ID of the ESP32 sensor node")
    
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Room context metrics (can be optional if attached to room entity, but good to have)
    room_area: float = Field(..., description="Area of the room in square meters")
    room_volume: float = Field(..., description="Volume of the room in cubic meters")

    # Sensor metrics
    dust_concentration: float = Field(..., description="PM2.5 / PM10 equivalent concentration")
    gas_concentration_level: float = Field(..., description="VOC/Gas concentration level")
    temperature: float = Field(..., description="Temperature in Celsius")
    humidity_per: float = Field(..., description="Relative humidity in percentage")

class SensorReadingCreate(SensorReadingBase):
    pass

class SensorReadingResponse(SensorReadingBase):
    id: str # Assigned by Firestore
