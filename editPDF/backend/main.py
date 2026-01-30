import os
import shutil
from fastapi import FastAPI, UploadFile, File, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
from pydantic import BaseModel
from typing import List, Optional, Any
from services.pdf_creator import generate_pdf_from_json

app = FastAPI()

# Allow CORS for Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

@app.get("/")
def read_root():
    return {"message": "Live PDF Editor Backend Running"}

@app.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    file_location = UPLOAD_DIR / file.filename
    with open(file_location, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Just save the file, no processing yet
    return {
        "filename": file.filename, 
        "url": f"http://localhost:8000/files/{file.filename}"
    }

@app.get("/files/{filename}")
async def get_file(filename: str):
    file_path = UPLOAD_DIR / filename
    if file_path.exists():
        return FileResponse(file_path)
    return {"error": "File not found"}

class FormElement(BaseModel):
    id: str
    type: str
    label: str
    x: float
    y: float
    value: Optional[str] = None

class GenerateRequest(BaseModel):
    elements: List[Any] # Relaxed type to allow style dict
    width: float
    height: float
    backgroundImage: Optional[str] = None

@app.post("/generate")
async def generate_pdf(req: GenerateRequest):
    pdf_bytes = generate_pdf_from_json(
        [e if isinstance(e, dict) else e.dict() for e in req.elements], 
        req.width, 
        req.height,
        req.backgroundImage
    )
    return Response(content=pdf_bytes, media_type="application/pdf", headers={"Content-Disposition": "attachment; filename=generated.pdf"})

class ProcessRequest(BaseModel):
    filename: str
    page: int = 0

from services.layer_extraction_service import extract_pdf_layers

@app.post("/process-page")
async def process_page(req: ProcessRequest):
    file_path = UPLOAD_DIR / req.filename
    if not file_path.exists():
        return {"error": "File not found"}
    
    # New Native Layer Extraction
    try:
        result = extract_pdf_layers(str(file_path), req.page)
        print(f"DEBUG: process-page returning: {result['width']} x {result['height']}")
        return result
    except Exception as e:
        print(f"Error processing page: {e}")
        return {"error": str(e)}

class ExportAllRequest(BaseModel):
    filename: str
    modifications: dict # { page_num: { layers: [], width, height } }
    pageOrder: Optional[List[int]] = None # New field

from services.pdf_creator import merge_edits_into_pdf

@app.post("/export-all")
async def export_all(req: ExportAllRequest):
    file_path = UPLOAD_DIR / req.filename
    if not file_path.exists():
        return {"error": "File not found"}
        
    try:
        pdf_bytes = merge_edits_into_pdf(str(file_path), req.modifications, req.pageOrder)
        return Response(
            content=pdf_bytes, 
            media_type="application/pdf", 
            headers={"Content-Disposition": "attachment; filename=exported_full.pdf"}
        )
    except Exception as e:
        print(f"Export error: {e}")
        return {"error": str(e)}
