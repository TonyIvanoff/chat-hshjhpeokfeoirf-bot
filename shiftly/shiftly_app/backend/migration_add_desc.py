import asyncio
from sqlalchemy import text
from app.db.session import engine

async def add_column():
    async with engine.begin() as conn:
        try:
            await conn.execute(text("ALTER TABLE items ADD COLUMN description VARCHAR"))
            print("Column 'description' added successfully.")
        except Exception as e:
            print(f"Error (maybe column exists): {e}")

if __name__ == "__main__":
    asyncio.run(add_column())
