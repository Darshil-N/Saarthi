from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from routers import auth, intake, materials, matching, inventory
from config import settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    print(f"NUMM API starting – environment: {settings.ENVIRONMENT}")
    yield
    print("NUMM API shutting down")


app = FastAPI(
    title="NUMM – National Unified Material Master",
    description="Backend API for BharatOil's material master data platform",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,      prefix="/auth",      tags=["Auth"])
app.include_router(intake.router,    prefix="/intake",    tags=["Intake"])
app.include_router(materials.router, prefix="/materials", tags=["Materials"])
app.include_router(matching.router,  prefix="/matching",  tags=["Matching"])
app.include_router(inventory.router, prefix="/inventory", tags=["Inventory"])


@app.get("/health")
async def health():
    return {"status": "ok", "service": "NUMM API"}
