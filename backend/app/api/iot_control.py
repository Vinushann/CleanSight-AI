from fastapi import APIRouter, HTTPException, status

from app.schemas.iot_collection import (
    DeviceControlResponse,
    SensorDataRequest,
    SensorDataResponse,
    SessionStartRequest,
    SessionStartResponse,
    SessionStopRequest,
    SessionStopResponse,
)
from app.services.control_state_service import get_control_state
from app.services.sensor_data_service import write_sensor_reading
from app.services.session_create_service import create_session
from app.services.session_stop_service import stop_session

router = APIRouter()


@router.post('/api/session/start', response_model=SessionStartResponse, status_code=status.HTTP_201_CREATED)
async def start_session(payload: SessionStartRequest):
    try:
        return create_session(payload)
    except ValueError as exc:
        error_message = str(exc)
        error_status = status.HTTP_409_CONFLICT if 'already active' in error_message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=error_status, detail=error_message) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post('/api/session/stop', response_model=SessionStopResponse)
async def end_session(payload: SessionStopRequest):
    try:
        return stop_session(payload)
    except ValueError as exc:
        error_message = str(exc)
        error_status = status.HTTP_404_NOT_FOUND if 'not found' in error_message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=error_status, detail=error_message) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.get('/api/device/control', response_model=DeviceControlResponse)
async def device_control_state():
    try:
        return get_control_state()
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post('/api/sensor-data', response_model=SensorDataResponse)
async def ingest_sensor_data(payload: SensorDataRequest):
    try:
        return write_sensor_reading(payload)
    except ValueError as exc:
        error_message = str(exc)
        error_status = status.HTTP_404_NOT_FOUND if 'not found' in error_message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=error_status, detail=error_message) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
