from typing import Any, Dict, Optional

from app.core.firebase import get_db

SESSIONS_COLLECTION = 'sessions'
ACTIVE_STATUS = 'active'


def get_active_session(db=None) -> Optional[Dict[str, Any]]:
    firestore_db = db or get_db()
    if not firestore_db:
        return None

    docs = (
        firestore_db.collection(SESSIONS_COLLECTION)
        .where('status', '==', ACTIVE_STATUS)
        .limit(1)
        .stream()
    )

    for doc in docs:
        payload = doc.to_dict() or {}
        payload.setdefault('session_id', doc.id)
        return payload

    return None


def get_control_state(db=None) -> Dict[str, Any]:
    active_session = get_active_session(db=db)
    if not active_session:
        return {
            'collecting': False,
            'session_id': None,
            'device_id': None,
        }

    return {
        'collecting': True,
        'session_id': active_session.get('session_id'),
        'device_id': active_session.get('device_id'),
    }
