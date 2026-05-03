"""
ESP32-CAM Presence Detection API — reads from Firebase Realtime Database.

All data is written by the separate Node.js/MQTT backend.
This module is read-only.
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, HTTPException, Query, status

from app.core.firebase import get_rtdb

router = APIRouter()


def _rtdb_get(path: str) -> Any:
    """Read a single RTDB path, returning None when unavailable."""
    ref = get_rtdb()
    if ref is None:
        return None
    return ref.child(path).get()


def _rtdb_get_ordered(path: str, order_by: str, limit: int = 50) -> list[dict]:
    """Read an RTDB path with ordering, returning a list of dicts."""
    ref = get_rtdb()
    if ref is None:
        return []
    raw = ref.child(path).order_by_child(order_by).limit_to_last(limit).get()
    if not raw or not isinstance(raw, dict):
        return []
    items = []
    for key, val in raw.items():
        if isinstance(val, dict):
            val["_key"] = key
            items.append(val)
    return items


# ---------------------------------------------------------------------------
# GET /sessions — list cleaning sessions from RTDB
# ---------------------------------------------------------------------------

@router.get("/sessions")
async def list_sessions():
    ref = get_rtdb()
    if ref is None:
        raise HTTPException(status_code=503, detail="RTDB not connected")

    raw = ref.child("sessions").get()
    if not raw or not isinstance(raw, dict):
        return {"sessions": []}

    sessions = []
    for sid, val in raw.items():
        if not isinstance(val, dict):
            continue
        sessions.append({
            "sessionId": val.get("sessionId", sid),
            "roomId": val.get("roomId"),
            "sessionName": val.get("sessionName"),
            "startTime": val.get("startTime"),
            "endTime": val.get("endTime"),
            "beforeDuration": val.get("beforeDuration"),
            "duringDuration": val.get("duringDuration"),
            "afterDuration": val.get("afterDuration"),
        })

    sessions.sort(key=lambda s: s.get("startTime") or 0, reverse=True)
    return {"sessions": sessions}


# ---------------------------------------------------------------------------
# GET /live — latest camera frame + inference + activity
# ---------------------------------------------------------------------------

@router.get("/live")
async def get_live_frame(
    device_id: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
):
    ref = get_rtdb()
    if ref is None:
        raise HTTPException(status_code=503, detail="RTDB not connected")

    # Resolve controller state
    controller = ref.child("controller/currentSession").get()

    # Determine which session to scope to
    effective_session = session_id
    if not effective_session and controller and isinstance(controller, dict):
        if controller.get("status") == "running":
            effective_session = controller.get("sessionId")

    # Resolve latest pointer
    pointer = None
    pointer_paths = []
    if effective_session and device_id:
        pointer_paths.append(f"camera_latest/by_session_device/{effective_session}/{device_id}")
    if device_id:
        pointer_paths.append(f"camera_latest/by_device/{device_id}")
    if effective_session:
        pointer_paths.append(f"camera_latest/by_session/{effective_session}")
    pointer_paths.append("camera_latest/all")

    for p in pointer_paths:
        pointer = ref.child(p).get()
        if pointer and isinstance(pointer, dict) and (pointer.get("imageId") or pointer.get("id")):
            break
    else:
        pointer = None

    # Resolve image record
    frame = None
    if pointer:
        image_id = pointer.get("imageId") or pointer.get("id")
        if image_id:
            image_data = ref.child(f"camera_images/{image_id}").get()
            if image_data and isinstance(image_data, dict):
                inference = image_data.get("inference") or {}
                frame = {
                    "id": image_id,
                    "deviceId": image_data.get("deviceId"),
                    "roomId": image_data.get("roomId"),
                    "sessionId": image_data.get("sessionId"),
                    "timestamp": image_data.get("timestamp"),
                    "receivedAt": image_data.get("receivedAt"),
                    "imagePath": image_data.get("imagePath"),
                    "sizeBytes": image_data.get("sizeBytes"),
                    "detections": inference.get("detections", []) if isinstance(inference, dict) else [],
                    "modelVersion": inference.get("modelVersion") if isinstance(inference, dict) else None,
                    "latencyMs": inference.get("latencyMs") if isinstance(inference, dict) else None,
                    "imageWidth": inference.get("imageWidth") if isinstance(inference, dict) else None,
                    "imageHeight": inference.get("imageHeight") if isinstance(inference, dict) else None,
                }

    # Activity status
    activity = None
    if effective_session:
        activity = ref.child(f"cleaning_activity_status/{effective_session}").get()

    return {
        "controller": controller,
        "frame": frame,
        "activity": activity,
    }


# ---------------------------------------------------------------------------
# GET /images — recent camera images
# ---------------------------------------------------------------------------

@router.get("/images")
async def get_recent_images(limit: int = Query(20, ge=1, le=100)):
    items = _rtdb_get_ordered("camera_images", "receivedAt", limit)
    items.sort(key=lambda x: x.get("receivedAt") or 0, reverse=True)

    images = []
    for item in items:
        inference = item.get("inference") or {}
        images.append({
            "id": item.get("_key"),
            "deviceId": item.get("deviceId"),
            "sessionId": item.get("sessionId"),
            "timestamp": item.get("timestamp"),
            "receivedAt": item.get("receivedAt"),
            "imagePath": item.get("imagePath"),
            "sizeBytes": item.get("sizeBytes"),
            "detections": inference.get("detections", []) if isinstance(inference, dict) else [],
            "modelVersion": inference.get("modelVersion") if isinstance(inference, dict) else None,
        })

    return {"count": len(images), "images": images}


# ---------------------------------------------------------------------------
# GET /activity — current cleaning activity state for a session
# ---------------------------------------------------------------------------

@router.get("/activity")
async def get_activity_status(session_id: str = Query(..., min_length=1)):
    data = _rtdb_get(f"cleaning_activity_status/{session_id.strip()}")
    if not data:
        return {"status": "no_data", "session_id": session_id}
    return {"status": "ok", "session_id": session_id, "activity": data}


# ---------------------------------------------------------------------------
# GET /timeline — activity timeline events for a session
# ---------------------------------------------------------------------------

@router.get("/timeline")
async def get_activity_timeline(session_id: str = Query(..., min_length=1)):
    raw = _rtdb_get(f"cleaning_activity_timeline/{session_id.strip()}")
    if not raw or not isinstance(raw, dict):
        return {"session_id": session_id, "events": []}

    events = []
    for key, val in raw.items():
        if isinstance(val, dict):
            events.append({
                "key": key,
                "active": val.get("active"),
                "score": val.get("score"),
                "timestamp": val.get("timestamp"),
                "createdAt": val.get("createdAt"),
            })

    events.sort(key=lambda e: e.get("timestamp") or 0)
    return {"session_id": session_id, "events": events}


# ---------------------------------------------------------------------------
# GET /alerts — presence/absence alert history for a session
# ---------------------------------------------------------------------------

@router.get("/alerts")
async def get_alerts(session_id: str = Query(..., min_length=1)):
    raw = _rtdb_get(f"alerts/{session_id.strip()}")
    if not raw or not isinstance(raw, dict):
        return {"session_id": session_id, "alerts": []}

    alerts = []
    for key, val in raw.items():
        if isinstance(val, dict):
            alerts.append({
                "key": key,
                "event": val.get("event"),
                "status": val.get("status"),
                "deviceId": val.get("deviceId"),
                "roomId": val.get("roomId"),
                "timestamp": val.get("timestamp"),
                "absenceMs": val.get("absenceMs"),
                "source": val.get("source"),
            })

    alerts.sort(key=lambda a: a.get("timestamp") or 0, reverse=True)
    return {"session_id": session_id, "alerts": alerts}


# ---------------------------------------------------------------------------
# GET /rooms — list rooms from RTDB
# ---------------------------------------------------------------------------

@router.get("/rooms")
async def list_rooms():
    raw = _rtdb_get("rooms")
    if not raw or not isinstance(raw, dict):
        return {"rooms": []}

    rooms = []
    for rid, val in raw.items():
        if isinstance(val, dict):
            rooms.append({
                "roomId": val.get("roomId", rid),
                "name": val.get("name"),
                "type": val.get("type"),
                "area": val.get("area"),
            })

    return {"rooms": rooms}
