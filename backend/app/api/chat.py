from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.ai.chat_agent import run_chat
from app.schemas.chat import ChatRequest

router = APIRouter()


def _chunk_text(text: str, chunk_size: int = 48):
    for index in range(0, len(text), chunk_size):
        yield text[index:index + chunk_size]


@router.post("/api/chat")
async def chat(payload: ChatRequest):
    try:
        response_text = run_chat(
            messages=[message.model_dump() for message in payload.messages],
            dashboard_context=payload.dashboard_context.model_dump(by_alias=True) if payload.dashboard_context else None,
        )
        return StreamingResponse(_chunk_text(response_text), media_type="text/plain")
    except RuntimeError as exc:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Chat request failed: {str(exc)}",
        ) from exc
