from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException, status

from app.core.firebase import get_db
from app.schemas.session import (
    StartCollectionSessionRequest,
    StartCollectionSessionResponse,
    StopCollectionSessionRequest,
    StopCollectionSessionResponse,
)

router = APIRouter()


@router.post('/sessions/start', response_model=StartCollectionSessionResponse, status_code=status.HTTP_201_CREATED)
async def start_collection_session(payload: StartCollectionSessionRequest):
    db = get_db()
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Database not connected. Please ensure Firebase is setup.',
        )

    started_at = datetime.now(timezone.utc)
    session_data = {
        'house_id': payload.house_id,
        'room_id': payload.room_id,
        'session_type': payload.session_type,
        'status': 'active',
        'started_at': started_at,
        'stopped_at': None,
    }

    try:
        doc_ref = db.collection('collection_sessions').document()
        doc_ref.set(session_data)

        return StartCollectionSessionResponse(
            status='success',
            message='Collection session started',
            session_id=doc_ref.id,
            house_id=payload.house_id,
            room_id=payload.room_id,
            session_type=payload.session_type,
            started_at=started_at,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to start collection session: {str(exc)}',
        ) from exc


@router.post('/sessions/stop', response_model=StopCollectionSessionResponse)
async def stop_collection_session(payload: StopCollectionSessionRequest):
    db = get_db()
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail='Database not connected. Please ensure Firebase is setup.',
        )

    try:
        doc_ref = db.collection('collection_sessions').document(payload.session_id)
        snapshot = doc_ref.get()

        if not snapshot.exists:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail='Session not found.',
            )

        session_data = snapshot.to_dict() or {}
        if session_data.get('status') == 'stopped':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Session is already stopped.',
            )

        stopped_at = datetime.now(timezone.utc)
        doc_ref.update({'status': 'stopped', 'stopped_at': stopped_at})

        return StopCollectionSessionResponse(
            status='success',
            message='Collection session stopped',
            session_id=payload.session_id,
            stopped_at=stopped_at,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f'Failed to stop collection session: {str(exc)}',
        ) from exc
