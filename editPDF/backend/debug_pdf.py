import fitz
import sys

def inspect(path):
    doc = fitz.open(path)
    page = doc[0]
    print(f"File: {path}")
    print(f"Page Count: {len(doc)}")
    print(f"Rotation: {page.rotation}")
    print(f"Rect: {page.rect}")
    print(f"MediaBox: {page.mediabox}")
    print(f"CropBox: {page.cropbox}")
    
    # Check text
    text = page.get_text("dict")
    if text["blocks"]:
        print(f"First Block: {text['blocks'][0]['bbox']}")

inspect("uploads/page10.pdf")
