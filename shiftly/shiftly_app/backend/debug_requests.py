import asyncio
from sqlalchemy import select
from app.db.session import SessionLocal
from app.models.service import ServiceRequest
from app.models.user import User

async def list_requests():
    async with SessionLocal() as db:
        result = await db.execute(select(ServiceRequest))
        requests = result.scalars().all()
        
        print(f"Total Requests: {len(requests)}")
        for req in requests:
            # Load user
            u_res = await db.execute(select(User).where(User.id == req.user_id))
            user = u_res.scalars().first()
            user_str = f"{user.email} (ID: {user.id})" if user else f"Unknown (ID: {req.user_id})"
            print(f"Request {req.id}: Owner {user_str}, Status {req.status}")

if __name__ == "__main__":
    asyncio.run(list_requests())
