import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def add_color_column():
    print(f"Connecting to {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        try:
            print("Adding 'color' column to 'items' table...")
            await conn.execute(text("ALTER TABLE items ADD COLUMN color VARCHAR"))
            print("Column added successfully.")
        except Exception as e:
            print(f"Error (maybe column exists?): {e}")

if __name__ == "__main__":
    asyncio.run(add_color_column())
