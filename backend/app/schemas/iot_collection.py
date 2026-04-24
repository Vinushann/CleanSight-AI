from typing import Literal, Optional

from pydantic import BaseModel, Field

SessionType = Literal['before', 'during', 'after']
SessionStatus = Literal['active', 'completed']


class SessionStartRequest(BaseModel):
    house_id: str = Field(..., min_length=1)
    room_id: str = Field(..., min_length=1)
    session_type: SessionType


class SessionStartResponse(BaseModel):
    session_id: str
    status: SessionStatus


class SessionStopRequest(BaseModel):
    session_id: str = Field(..., min_length=1)


class SessionStopResponse(BaseModel):
    session_id: str
    status: SessionStatus


class DeviceControlResponse(BaseModel):
    collecting: bool
    session_id: Optional[str]
    device_id: Optional[str]


class SensorDataRequest(BaseModel):
    device_id: str = Field(..., min_length=1)
    session_id: str = Field(..., min_length=1)
    timestamp_ms: int = Field(..., ge=0)
    dust: float
    air_quality: float
    temperature: float
    humidity: float
    dust_level: Optional[str] = None
    sensor_status: Optional[str] = None
    notes: Optional[str] = None


class SensorDataResponse(BaseModel):
    success: bool
    session_id: str
