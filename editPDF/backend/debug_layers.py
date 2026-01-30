from services.layer_extraction_service import extract_pdf_layers
import json

path = "uploads/page10.pdf"
try:
    data = extract_pdf_layers(path, 0)
    print(f"Page Width: {data['width']}")
    print(f"Page Height: {data['height']}")
    
    # Find text layers
    text_layers = [l for l in data['layers'] if l['type'] == 'text']
    for i, l in enumerate(text_layers[:5]):
        print(f"Text Layer {i}:")
        print(f"  Text: {l['text'][:20]}...")
        print(f"  Font Size: {l['fontSize']}")
        print(f"  Pos: ({l['x']}, {l['y']})")
        print(f"  Size: {l['width']} x {l['height']}")
        
except Exception as e:
    print(e)
