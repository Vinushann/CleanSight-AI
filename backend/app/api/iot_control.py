import os

from fastapi import APIRouter, HTTPException, status

from app.core.firebase import get_db, reconnect_firebase
from app.schemas.iot_collection import (
    DeviceControlResponse,
    IoTSystemStatusResponse,
    MarkAllNotificationsResponse,
    MarkNotificationReadRequest,
    NotificationListResponse,
    ReconnectFirebaseResponse,
    SensorDataRequest,
    SensorDataResponse,
    SessionStartRequest,
    SessionStartResponse,
    SessionStopRequest,
    SessionStopResponse,
)
from app.services.control_state_service import get_control_state
from app.services.dashboard_data_service import get_session, get_session_readings
from app.services.iot_notification_service import (
    create_notification,
    list_notifications,
    mark_all_notifications_read,
    mark_notification_read,
)
from app.services.sensor_data_service import write_sensor_reading
from app.services.session_create_service import create_session
from app.services.session_stop_service import stop_session

router = APIRouter()


def _runtime_error_status_code(exc: RuntimeError) -> int:
    message = str(exc).lower()
    if 'quota exceeded' in message or 'firestore request failed' in message:
        return status.HTTP_503_SERVICE_UNAVAILABLE
    return status.HTTP_500_INTERNAL_SERVER_ERROR


@router.post('/api/session/start', response_model=SessionStartResponse, status_code=status.HTTP_201_CREATED)
async def start_session(payload: SessionStartRequest):
    try:
        return create_session(payload)
    except ValueError as exc:
        error_message = str(exc)
        error_status = status.HTTP_409_CONFLICT if 'already active' in error_message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=error_status, detail=error_message) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=_runtime_error_status_code(exc), detail=str(exc)) from exc


@router.post('/api/session/stop', response_model=SessionStopResponse)
async def end_session(payload: SessionStopRequest):
    try:
        return stop_session(payload)
    except ValueError as exc:
        error_message = str(exc)
        error_status = status.HTTP_404_NOT_FOUND if 'not found' in error_message.lower() else status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=error_status, detail=error_message) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=_runtime_error_status_code(exc), detail=str(exc)) from exc


@router.get('/api/device/control', response_model=DeviceControlResponse)
async def device_control_state():
    try:
        return get_control_state()
    except RuntimeError as exc:
        raise HTTPException(status_code=_runtime_error_status_code(exc), detail=str(exc)) from exc


@router.get('/api/session/{session_id}/readings')
async def session_readings(session_id: str):
    try:
        session = get_session(session_id)
        if not session:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Session not found.')
        return {
            'status': 'success',
            'session_id': session_id,
            'session': session,
            'readings': get_session_readings(session_id),
        }
    except HTTPException:
        raise
    except RuntimeError as exc:
        raise HTTPException(status_code=_runtime_error_status_code(exc), detail=str(exc)) from exc


@router.get('/api/iot/notifications', response_model=NotificationListResponse)
async def get_iot_notifications():
    try:
        notifications = list_notifications()
        unread_count = sum(1 for row in notifications if not row.get('read'))
        return {
            'status': 'success',
            'notifications': notifications,
            'unread_count': unread_count,
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=_runtime_error_status_code(exc), detail=str(exc)) from exc


@router.post('/api/iot/notifications/read')
async def read_iot_notification(payload: MarkNotificationReadRequest):
    try:
        mark_notification_read(payload.notification_id)
        return {'success': True}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=_runtime_error_status_code(exc), detail=str(exc)) from exc


@router.post('/api/iot/notifications/read-all', response_model=MarkAllNotificationsResponse)
async def read_all_iot_notifications():
    try:
        updated = mark_all_notifications_read()
        return {'success': True, 'updated_count': updated}
    except RuntimeError as exc:
        raise HTTPException(status_code=_runtime_error_status_code(exc), detail=str(exc)) from exc


@router.get('/api/iot/system-status', response_model=IoTSystemStatusResponse)
async def get_iot_system_status():
    try:
        db = get_db()
        control_state = get_control_state()
        return {
            'success': True,
            'api_status': 'online',
            'backend_base_url': os.getenv('BACKEND_BASE_URL'),
            'firestore_connected': db is not None,
            'active_session_id': control_state.get('session_id'),
            'simulator_command': 'python3 backend/simulate_iot_session.py',
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=_runtime_error_status_code(exc), detail=str(exc)) from exc


@router.post('/api/iot/test-notification')
async def generate_test_iot_notification():
    try:
        payload = create_notification(
            title='Test IoT notification',
            message='This is a generated test notification from the IoT settings page.',
            category='test',
            severity='info',
        )
        return {'success': True, 'notification_id': payload['notification_id']}
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post('/api/iot/reconnect-firebase', response_model=ReconnectFirebaseResponse)
async def reconnect_iot_firebase():
    try:
        connected = reconnect_firebase()
        return {
            'success': connected,
            'firestore_connected': connected,
        }
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc


@router.post('/api/sensor-data', response_model=SensorDataResponse)
async def ingest_sensor_data(payload: SensorDataRequest):
    try:
        return write_sensor_reading(payload)
    except ValueError as exc:
        error_message = str(exc)
        lowered = error_message.lower()
        if 'not found' in lowered:
            error_status = status.HTTP_404_NOT_FOUND
        else:
            error_status = status.HTTP_400_BAD_REQUEST
        raise HTTPException(status_code=error_status, detail=error_message) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
