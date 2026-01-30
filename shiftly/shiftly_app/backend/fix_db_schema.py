import asyncio
import asyncpg
from app.core.config import settings

# Parse DB URL manually or use a library, but asyncpg needs specific format
# URL: postgresql+asyncpg://postgres:postgres@localhost:5432/boltt_app
# Asyncpg expects: postgresql://postgres:postgres@localhost:5432/boltt_app

DB_URL = settings.DATABASE_URL.replace("postgresql+asyncpg://", "postgresql://")

async def add_role_column():
    print(f"Connecting to {DB_URL}...")
    try:
        conn = await asyncpg.connect(DB_URL)
        
        # Check if column exists
        row = await conn.fetchrow(
            "SELECT column_name FROM information_schema.columns WHERE table_name='users' AND column_name='role'"
        )
        
        if not row:
            print("Adding 'role' column to 'users' table...")
            await conn.execute("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'client'")
            print("Column added successfully.")
        else:
            print("'role' column already exists.")
            
        await conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(add_role_column())
