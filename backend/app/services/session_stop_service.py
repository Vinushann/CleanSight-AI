from firebase_admin import firestore

from app.core.firebase import get_db
from app.schemas.iot_collection import SessionStopRequest
from app.services.control_state_service import get_active_session

SESSIONS_COLLECTION = 'sessions'


def stop_session(payload: SessionStopRequest) -> dict:
    db = get_db()
    if not db:
        raise RuntimeError('Database not connected. Please ensure Firebase is setup.')

    doc_ref = db.collection(SESSIONS_COLLECTION).document(payload.session_id)
    session_snapshot = doc_ref.get()
    if not session_snapshot.exists:
        raise ValueError('Session not found.')

    active_session = get_active_session(db=db)
    if not active_session or active_session.get('session_id') != payload.session_id:
        raise ValueError('Session does not match the current active session.')

    session_payload = session_snapshot.to_dict() or {}
    if session_payload.get('status') != 'active':
        raise ValueError('Session is not active.')

    doc_ref.update(
        {
            'status': 'completed',
            'end_time': firestore.SERVER_TIMESTAMP,
            'updated_at': firestore.SERVER_TIMESTAMP,
        }
    )

    return {
        'session_id': payload.session_id,
        'status': 'completed',
    }
