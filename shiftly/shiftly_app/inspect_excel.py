import pandas as pd
import os

file_path = "/Users/antonasivanovas/Desktop/dev_proj/elpMovers/boltt_app/Item dimensions.xlsx"

try:
    df = pd.read_excel(file_path)
    print("Columns:", df.columns.tolist())
    print("First 3 rows:")
    print(df.head(3))
except Exception as e:
    print(f"Error: {e}")
