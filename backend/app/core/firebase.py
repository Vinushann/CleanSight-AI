import os
from pathlib import Path
from typing import Optional

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, delete_app, firestore

# Global Firestore DB client
db = None
_env_loaded = False
_firebase_init_attempted = False


def _load_local_env() -> None:
    global _env_loaded
    if _env_loaded:
        return

    # backend/.env
    backend_root = Path(__file__).resolve().parents[2]
    load_dotenv(backend_root / ".env", override=False)
    _env_loaded = True


def _resolve_credential_path() -> Optional[str]:
    # Primary key expected by Google SDKs
    cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    # Optional project alias for convenience
    if not cred_path:
        cred_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

    if not cred_path:
        return None

    path = Path(cred_path).expanduser()
    if not path.is_absolute():
        backend_root = Path(__file__).resolve().parents[2]
        path = backend_root / path

    return str(path)


def initialize_firebase():
    global db
    global _firebase_init_attempted
    if db is not None or _firebase_init_attempted:
        return

    _firebase_init_attempted = True
    _load_local_env()

    # In production, ensure GOOGLE_APPLICATION_CREDENTIALS points to the service account JSON
    try:
        if not firebase_admin._apps:
            cred_path = _resolve_credential_path()
            if cred_path:
                if not os.path.exists(cred_path):
                    raise FileNotFoundError(
                        f"Credential file not found at '{cred_path}'."
                    )
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            else:
                # Attempt default initialization (e.g. running on Google Cloud with ADC)
                firebase_admin.initialize_app()

        db = firestore.client()
        print("Firebase initialized successfully")
    except Exception as e:
        print(
            f"Failed to initialize Firebase: {e}. "
            "Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_PATH in backend/.env"
        )
        # Keep service running so non-Firebase endpoints can still respond.
        pass


def get_db():
    global db
    if db is None:
        initialize_firebase()
    return db


def reconnect_firebase() -> bool:
    global db
    global _firebase_init_attempted

    db = None
    _firebase_init_attempted = False

    try:
        for app in list(firebase_admin._apps.values()):
            delete_app(app)
    except Exception:
        pass

    initialize_firebase()
    return db is not None


# ---------------------------------------------------------------------------
# Firebase Realtime Database (RTDB) — second app for ESP32-CAM presence data
# ---------------------------------------------------------------------------

_rtdb_ref = None
_rtdb_init_attempted = False

RTDB_APP_NAME = "rtdb_presence"


def _resolve_rtdb_credential_path() -> Optional[str]:
    cred_path = os.getenv("RTDB_SERVICE_ACCOUNT_PATH")
    if not cred_path:
        # Fall back to the same cred used for Firestore
        return _resolve_credential_path()

    path = Path(cred_path).expanduser()
    if not path.is_absolute():
        backend_root = Path(__file__).resolve().parents[2]
        path = backend_root / path

    return str(path)


def initialize_rtdb():
    global _rtdb_ref, _rtdb_init_attempted
    if _rtdb_ref is not None or _rtdb_init_attempted:
        return
    _rtdb_init_attempted = True
    _load_local_env()

    rtdb_url = os.getenv("FIREBASE_DATABASE_URL")
    if not rtdb_url:
        print("RTDB disabled: FIREBASE_DATABASE_URL not set in .env")
        return

    try:
        # Check if the named app already exists
        try:
            rtdb_app = firebase_admin.get_app(RTDB_APP_NAME)
        except ValueError:
            cred_path = _resolve_rtdb_credential_path()
            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
            else:
                cred = credentials.ApplicationDefault()
            rtdb_app = firebase_admin.initialize_app(
                cred,
                {"databaseURL": rtdb_url},
                name=RTDB_APP_NAME,
            )

        from firebase_admin import db as rtdb_module
        _rtdb_ref = rtdb_module.reference("/", app=rtdb_app)
        print(f"Firebase RTDB initialized successfully ({rtdb_url})")
    except Exception as e:
        print(f"Failed to initialize Firebase RTDB: {e}")


def get_rtdb():
    """Return the root RTDB reference, initializing on first call."""
    global _rtdb_ref
    if _rtdb_ref is None:
        initialize_rtdb()
    return _rtdb_ref

