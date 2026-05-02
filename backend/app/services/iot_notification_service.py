from __future__ import annotations

from typing import Any
from uuid import uuid4

from firebase_admin import firestore

from app.core.firebase import get_db

NOTIFICATIONS_COLLECTION = "iot_notifications"


def create_notification(
    *,
    title: str,
    message: str,
    category: str,
    severity: str = "warning",
    device_id: str | None = None,
    session_id: str | None = None,
    reading_key: str | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict[str, Any]:
    db = get_db()
    if not db:
        raise RuntimeError("Database not connected. Please ensure Firebase is setup.")

    notification_id = f"notif_{uuid4().hex[:12]}"
    payload: dict[str, Any] = {
        "notification_id": notification_id,
        "title": title,
        "message": message,
        "category": category,
        "severity": severity,
        "device_id": device_id,
        "session_id": session_id,
        "reading_key": reading_key,
        "metadata": metadata or {},
        "read": False,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }

    db.collection(NOTIFICATIONS_COLLECTION).document(notification_id).set(payload)
    return payload


def list_notifications(limit: int = 50) -> list[dict[str, Any]]:
    db = get_db()
    if not db:
        raise RuntimeError("Database not connected. Please ensure Firebase is setup.")

    docs = (
        db.collection(NOTIFICATIONS_COLLECTION)
        .order_by("created_at", direction=firestore.Query.DESCENDING)
        .limit(limit)
        .stream()
    )

    rows: list[dict[str, Any]] = []
    for doc in docs:
        payload = doc.to_dict() or {}
        created_at = payload.get("created_at")
        updated_at = payload.get("updated_at")
        rows.append(
            {
                "notification_id": str(payload.get("notification_id") or doc.id),
                "title": str(payload.get("title") or ""),
                "message": str(payload.get("message") or ""),
                "category": str(payload.get("category") or "general"),
                "severity": str(payload.get("severity") or "info"),
                "device_id": payload.get("device_id"),
                "session_id": payload.get("session_id"),
                "reading_key": payload.get("reading_key"),
                "metadata": payload.get("metadata") or {},
                "read": bool(payload.get("read")),
                "created_at": created_at.isoformat() if hasattr(created_at, "isoformat") else None,
                "updated_at": updated_at.isoformat() if hasattr(updated_at, "isoformat") else None,
            }
        )
    return rows


def mark_notification_read(notification_id: str) -> None:
    db = get_db()
    if not db:
        raise RuntimeError("Database not connected. Please ensure Firebase is setup.")

    normalized_id = notification_id.strip()
    if not normalized_id:
        raise ValueError("Notification ID is required.")

    notification_ref = db.collection(NOTIFICATIONS_COLLECTION).document(normalized_id)
    snapshot = notification_ref.get()
    if not snapshot.exists:
        raise ValueError("Notification not found.")

    notification_ref.update(
        {
            "read": True,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
    )


def mark_all_notifications_read() -> int:
    db = get_db()
    if not db:
        raise RuntimeError("Database not connected. Please ensure Firebase is setup.")

    docs = db.collection(NOTIFICATIONS_COLLECTION).where("read", "==", False).stream()
    batch = db.batch()
    updated = 0
    for doc in docs:
        batch.update(
            doc.reference,
            {
                "read": True,
                "updated_at": firestore.SERVER_TIMESTAMP,
            },
        )
        updated += 1

    if updated:
        batch.commit()
    return updated
