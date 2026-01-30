import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.core.config import settings

async def add_box_column():
    print(f"Connecting to {settings.DATABASE_URL}")
    engine = create_async_engine(settings.DATABASE_URL)
    
    async with engine.begin() as conn:
        try:
            print("Adding 'bounding_box' column to 'items' table...")
            # Storing as string "y1,x1,y2,x2" or JSON. JSON is better.
            # But let's stick to VARCHAR for simplicity if SQLite is ever used, though we confirmed Postgres.
            # JSONB is best for Postgres.
            await conn.execute(text("ALTER TABLE items ADD COLUMN bounding_box VARCHAR"))
            print("Column added successfully.")
        except Exception as e:
            print(f"Error (maybe column exists?): {e}")

if __name__ == "__main__":
    asyncio.run(add_box_column())
