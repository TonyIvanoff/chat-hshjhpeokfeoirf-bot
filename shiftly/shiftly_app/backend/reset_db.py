import asyncio
import os
import sys

# Add backend directory to sys.path to resolve generic 'app' imports
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.session import engine, Base, SessionLocal
from app.models.user import User
from app.models.service import ServiceRequest, Item, RequestImage, StandardItem
from app.core import security
import uuid

async def reset_database():
    print("WARNING: This will delete all data. Starting in 3 seconds...")
    await asyncio.sleep(3)
    
    async with engine.begin() as conn:
        print("Dropping all tables...")
        await conn.run_sync(Base.metadata.drop_all)
        print("Creating all tables...")
        await conn.run_sync(Base.metadata.create_all)
        
    print("Seeding Admin User...")
    async with SessionLocal() as db:
        admin_user = User(
            id=str(uuid.uuid4()),
            email="admin@admin.com",
            hashed_password=security.get_password_hash("password123"),
            full_name="System Admin",
            role="admin",
            is_active=True
        )
        db.add(admin_user)
        await db.commit()
        print(f"Admin created: {admin_user.email} (ID: {admin_user.id})")

if __name__ == "__main__":
    asyncio.run(reset_database())
