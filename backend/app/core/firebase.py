import os
import firebase_admin
from firebase_admin import credentials, firestore

# Global Firestore DB client
db = None

def initialize_firebase():
    global db
    # In production, ensure GOOGLE_APPLICATION_CREDENTIALS points to the service account JSON
    # For local dev without creds, let's setup a placeholder check
    try:
        if not firebase_admin._apps:
            cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
            if cred_path and os.path.exists(cred_path):
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
            else:
                # Attempt default initialization (e.g. if running in Google Cloud or with application default credentials)
                firebase_admin.initialize_app()
        db = firestore.client()
        print("Firebase initialized successfully")
    except Exception as e:
        print(f"Failed to initialize Firebase: {e}")
        # In this educational template, we might want to continue even without Firebase strictly configured
        pass

def get_db():
    global db
    if db is None:
        initialize_firebase()
    return db
