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
    house_id: Optional[str] = None
    room_id: Optional[str] = None
    session_type: Optional[SessionType] = None


class IoTNotification(BaseModel):
    notification_id: str
    title: str
    message: str
    category: str
    severity: str
    device_id: Optional[str] = None
    session_id: Optional[str] = None
    reading_key: Optional[str] = None
    metadata: dict = Field(default_factory=dict)
    read: bool
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class NotificationListResponse(BaseModel):
    status: str
    notifications: list[IoTNotification]
    unread_count: int


class MarkNotificationReadRequest(BaseModel):
    notification_id: str = Field(..., min_length=1)


class MarkAllNotificationsResponse(BaseModel):
    success: bool
    updated_count: int


class IoTSystemStatusResponse(BaseModel):
    success: bool
    api_status: str
    backend_base_url: Optional[str] = None
    firestore_connected: bool
    active_session_id: Optional[str] = None
    simulator_command: str


class ReconnectFirebaseResponse(BaseModel):
    success: bool
    firestore_connected: bool


class SensorDataRequest(BaseModel):
    device_id: str = Field(..., min_length=1)
    session_id: str = Field(..., min_length=1)
    timestamp_ms: int = Field(..., ge=0)
    dust_voltage: Optional[float] = None
    dust_raw_adc: Optional[int] = None
    dust: float
    air_quality: float
    temperature: float
    humidity: float
    dust_level: Optional[str] = None
    sensor_status: Optional[str] = None
    notes: Optional[str] = None
    cleanliness_status: Optional[str] = None
    anomaly_status: Optional[str] = None
    cleanliness_score: Optional[float] = None
    cleaning_urgency: Optional[str] = None
    cleanliness_prediction: Optional[str] = None
    anomaly_prediction: Optional[str] = None
    prediction_reason: Optional[str] = None
    anomaly_reason: Optional[str] = None
    next_dust_prediction: Optional[float] = None
    predicted_next_cleanliness: Optional[float] = None
    actual_cleanliness: Optional[float] = None
    model_source: Optional[str] = None
    model_version: Optional[str] = None


class SensorDataResponse(BaseModel):
    success: bool
    session_id: str
