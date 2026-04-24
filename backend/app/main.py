from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from pathlib import Path
from dotenv import load_dotenv
from app.api import esp32_ingestion
from app.api import iot_control
from app.api import chat
from app.core.firebase import initialize_firebase

from app.modules.vinushan.routes import router as vinushan_router
from app.modules.vishva.routes import router as vishva_router
from app.modules.ayathma.routes import router as ayathma_router
from app.modules.nandhika.routes import router as nandhika_router

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=False)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Firebase on startup
    initialize_firebase()
    yield
    # Cleanup on shutdown

app = FastAPI(
    title="CleanSight AI API",
    description="Backend for CleanSight AI platform - Modular implementation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For frontend Vercel deployment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root endpoint
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "CleanSight AI API"}

# Register Shared Routes
app.include_router(esp32_ingestion.router, prefix="/api/v1/ingestion", tags=["Ingestion"])
app.include_router(iot_control.router, tags=["IoT Session Control"])
app.include_router(chat.router, tags=["Chatbot"])

# Register Team Modules
app.include_router(vinushan_router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(vishva_router, prefix="/api/v1/quality", tags=["Dust & Air Quality"])
app.include_router(ayathma_router, prefix="/api/v1/environment", tags=["Temp & Humidity"])
app.include_router(nandhika_router, prefix="/api/v1/auth", tags=["Auth & Users"])

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("BACKEND_HOST", "0.0.0.0")
    port = int(os.getenv("BACKEND_PORT", "8000"))
    reload_enabled = os.getenv("BACKEND_RELOAD", "true").strip().lower() in {"1", "true", "yes", "on"}
    uvicorn.run("app.main:app", host=host, port=port, reload=reload_enabled)
