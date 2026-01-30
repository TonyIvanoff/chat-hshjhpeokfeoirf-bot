import asyncio
import pandas as pd
from sqlalchemy import text
from app.db.session import engine
from app.models.service import StandardItem, Base

# Adjust path to your excel file
EXCEL_PATH = "/Users/antonasivanovas/Desktop/dev_proj/elpMovers/boltt_app/Item dimensions.xlsx"

async def load_data():
    # 1. Create table if not exists (raw sql or reliance on alembic, but here we do raw for speed)
    async with engine.begin() as conn:
        await conn.execute(text("""
            CREATE TABLE IF NOT EXISTS standard_items (
                id SERIAL PRIMARY KEY,
                name VARCHAR,
                weight_kg FLOAT,
                volume_m3 FLOAT
            )
        """))
        # Clear existing?
        await conn.execute(text("DELETE FROM standard_items"))
        print("Table cleared/created.")

    # 2. Read Excel
    df = pd.read_excel(EXCEL_PATH)
    print(f"Loaded {len(df)} rows from Excel.")

    # 3. Insert Data
    # We will use bulk insert via SQLAlchemy core or just loop for simplicity (dataset small?)
    # df columns: ['Item', 'Weight(kg)', 'Volume (m3)']
    
    values = []
    for _, row in df.iterrows():
        # Clean data
        name = str(row['Item']).strip()
        try:
            w = float(row['Weight(kg)'])
        except: w = 0.0
        try:
            v = float(row['Volume (m3)'])
        except: v = 0.0
        
        values.append({'name': name, 'weight_kg': w, 'volume_m3': v})

    from sqlalchemy import insert
    
    async with engine.begin() as conn:
        # Batch insert
        await conn.execute(insert(StandardItem), values)
    
    print("Data imported successfully.")

if __name__ == "__main__":
    asyncio.run(load_data())
