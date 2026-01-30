from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.api import auth, requests, admin
from app.db.session import engine, Base, SessionLocal
from app.models.user import User
from app.models.system import ModuleLog, TrainingLog
from app.core import security
from sqlalchemy.future import select
import os

from fastapi.responses import JSONResponse

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Backend API for Removal Service Platform",
    version="0.1.0"
)

# CORS Configuration
origins = [
    "http://localhost:5173", # Vite
    "http://127.0.0.1:5173",
    "http://localhost:3000", # Next.js
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def catch_exceptions_middleware(request, call_next):
    try:
        return await call_next(request)
    except Exception as exc:
        print(f"CRITICAL ERROR handling {request.url}: {exc}")
        import traceback
        traceback.print_exc()
        return JSONResponse(
             status_code=500,
             content={"detail": "Internal Server Error"} 
        )


# Create uploads directory if not exists
os.makedirs("uploads", exist_ok=True)
# Mount uploads directory for static access
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

@app.on_event("startup")
async def startup():
    # Initialise database (create tables)
    # In production, use Alembic!
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Seed Admin User
    async with SessionLocal() as db:
        result = await db.execute(select(User).where(User.email == "admin@admin.com"))
        admin_user = result.scalars().first()
        if not admin_user:
            admin_user = User(
                email="admin@admin.com",
                hashed_password=security.get_password_hash("password123"),
                full_name="System Admin",
                role="admin"
            )
            db.add(admin_user)
            await db.commit()
            print("Admin user created: admin@admin.com / password123")

app.include_router(auth.router, prefix="/auth", tags=["auth"])
app.include_router(requests.router, prefix="/requests", tags=["requests"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])

@app.get("/")
async def root():
    return {"message": "Welcome to Shiftly App API"}
