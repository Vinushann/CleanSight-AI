from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from app.api import esp32_ingestion
from app.core.firebase import initialize_firebase

from app.modules.vinushan.routes import router as vinushan_router
from app.modules.vishva.routes import router as vishva_router
from app.modules.ayathma.routes import router as ayathma_router
from app.modules.nandhika.routes import router as nandhika_router

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

# Register Team Modules
app.include_router(vinushan_router, prefix="/api/v1/dashboard", tags=["Dashboard"])
app.include_router(vishva_router, prefix="/api/v1/quality", tags=["Dust & Air Quality"])
app.include_router(ayathma_router, prefix="/api/v1/environment", tags=["Temp & Humidity"])
app.include_router(nandhika_router, prefix="/api/v1/auth", tags=["Auth & Users"])

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
