from uuid import uuid4

from firebase_admin import firestore

from app.core.firebase import get_db
from app.schemas.iot_collection import SensorDataRequest
from app.services.control_state_service import get_active_session

SESSIONS_COLLECTION = 'sessions'
READINGS_SUBCOLLECTION = 'readings'
ACTIVE_STATUS = 'active'


def write_sensor_reading(payload: SensorDataRequest) -> dict:
    db = get_db()
    if not db:
        raise RuntimeError('Database not connected. Please ensure Firebase is setup.')

    session_ref = db.collection(SESSIONS_COLLECTION).document(payload.session_id)
    session_snapshot = session_ref.get()
    if not session_snapshot.exists:
        raise ValueError('Session not found.')

    session_data = session_snapshot.to_dict() or {}
    if session_data.get('status') != ACTIVE_STATUS:
        raise ValueError('Session is not active.')

    active_session = get_active_session(db=db)
    if not active_session or active_session.get('session_id') != payload.session_id:
        raise ValueError('Session ID does not match the current active session.')

    expected_device_id = session_data.get('device_id')
    if expected_device_id and expected_device_id != payload.device_id:
        raise ValueError('Device ID does not match the active session device.')

    reading_id = f"reading_{uuid4().hex[:12]}"

    reading_document = {
        'reading_id': reading_id,
        'timestamp_ms': payload.timestamp_ms,
        'session_id': payload.session_id,
        'device_id': payload.device_id,
        'recorded_at': firestore.SERVER_TIMESTAMP,
        'dust': payload.dust,
        'air_quality': payload.air_quality,
        'temperature': payload.temperature,
        'humidity': payload.humidity,
    }

    if payload.dust_level is not None:
        reading_document['dust_level'] = payload.dust_level
    if payload.sensor_status is not None:
        reading_document['sensor_status'] = payload.sensor_status
    if payload.notes is not None:
        reading_document['notes'] = payload.notes

    reading_ref = session_ref.collection(READINGS_SUBCOLLECTION).document(reading_id)

    batch = db.batch()
    batch.set(reading_ref, reading_document)
    batch.update(
        session_ref,
        {
            'total_readings': firestore.Increment(1),
            'updated_at': firestore.SERVER_TIMESTAMP,
        },
    )
    batch.commit()

    return {
        'success': True,
        'session_id': payload.session_id,
    }
