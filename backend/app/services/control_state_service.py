from typing import Any, Dict, Optional

from google.api_core.exceptions import GoogleAPICallError, ResourceExhausted
from google.cloud.firestore_v1.base_query import FieldFilter

from app.core.firebase import get_db

SESSIONS_COLLECTION = 'sessions'
ACTIVE_STATUS = 'active'


def get_active_session(db=None) -> Optional[Dict[str, Any]]:
    firestore_db = db or get_db()
    if not firestore_db:
        return None

    try:
        docs = (
            firestore_db.collection(SESSIONS_COLLECTION)
            .where(filter=FieldFilter('status', '==', ACTIVE_STATUS))
            .limit(1)
            .stream()
        )

        for doc in docs:
            payload = doc.to_dict() or {}
            payload.setdefault('session_id', doc.id)
            return payload
    except ResourceExhausted as exc:
        raise RuntimeError(
            'Firestore quota exceeded for the configured Firebase project. '
            'Wait for quota reset or switch to a project/service account with available quota.'
        ) from exc
    except GoogleAPICallError as exc:
        raise RuntimeError(f'Firestore request failed: {exc}') from exc

    return None


def get_control_state(db=None) -> Dict[str, Any]:
    active_session = get_active_session(db=db)
    if not active_session:
        return {
            'collecting': False,
            'session_id': None,
            'device_id': None,
            'house_id': None,
            'room_id': None,
            'session_type': None,
        }

    return {
        'collecting': True,
        'session_id': active_session.get('session_id'),
        'device_id': active_session.get('device_id'),
        'house_id': active_session.get('house_id'),
        'room_id': active_session.get('room_id'),
        'session_type': active_session.get('session_type'),
    }
