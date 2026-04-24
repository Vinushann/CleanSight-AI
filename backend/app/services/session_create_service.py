from uuid import uuid4

from firebase_admin import firestore

from app.core.firebase import get_db
from app.schemas.iot_collection import SessionStartRequest
from app.services.control_state_service import get_active_session

READING_INTERVAL_SECONDS = 4
DEFAULT_DEVICE_ID = 'esp32_all_sensors_01'
SESSIONS_COLLECTION = 'sessions'


def _generate_session_id() -> str:
    return f"session_{uuid4().hex[:12]}"


def create_session(payload: SessionStartRequest) -> dict:
    db = get_db()
    if not db:
        raise RuntimeError('Database not connected. Please ensure Firebase is setup.')

    active_session = get_active_session(db=db)
    if active_session:
        raise ValueError('Another collection session is already active.')

    session_id = _generate_session_id()
    session_document = {
        'session_id': session_id,
        'house_id': payload.house_id,
        'room_id': payload.room_id,
        'session_type': payload.session_type,
        'device_id': DEFAULT_DEVICE_ID,
        'start_time': firestore.SERVER_TIMESTAMP,
        'end_time': None,
        'status': 'active',
        'reading_interval_seconds': READING_INTERVAL_SECONDS,
        'total_readings': 0,
        'created_at': firestore.SERVER_TIMESTAMP,
        'updated_at': firestore.SERVER_TIMESTAMP,
    }

    db.collection(SESSIONS_COLLECTION).document(session_id).set(session_document)

    return {
        'session_id': session_id,
        'status': 'active',
    }
