import asyncio
from sqlalchemy.future import select
from app.db.session import AsyncSession, engine, Base, SessionLocal
from app.models.user import User
from app.core.security import get_password_hash

async def reset_user():
    async with SessionLocal() as db:
        email = "client@example.com"
        pwd = "password123"
        hashed = get_password_hash(pwd)
        
        # Check if exists
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if user:
            print(f"User {email} found. Updating password...")
            user.hashed_password = hashed
        else:
            print(f"User {email} not found. Creating...")
            user = User(
                email=email,
                hashed_password=hashed,
                full_name="Client User"
            )
            db.add(user)
            
        await db.commit()
        print(f"DONE. User {email} set with password '{pwd}'")

if __name__ == "__main__":
    asyncio.run(reset_user())
