from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field

SessionType = Literal['before', 'during', 'after']


class StartCollectionSessionRequest(BaseModel):
    house_id: str = Field(..., min_length=1, description='Target house identifier')
    room_id: str = Field(..., min_length=1, description='Target room identifier')
    session_type: SessionType = Field(..., description='Collection stage type')


class StartCollectionSessionResponse(BaseModel):
    status: str
    message: str
    session_id: str
    house_id: str
    room_id: str
    session_type: SessionType
    started_at: datetime


class StopCollectionSessionRequest(BaseModel):
    session_id: str = Field(..., min_length=1, description='Active collection session id')


class StopCollectionSessionResponse(BaseModel):
    status: str
    message: str
    session_id: str
    stopped_at: Optional[datetime] = None
