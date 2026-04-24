import os
from pathlib import Path
from typing import Optional

import firebase_admin
from dotenv import load_dotenv
from firebase_admin import credentials, firestore

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
