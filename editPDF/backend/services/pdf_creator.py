from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
import io
import base64
import logging
from PIL import Image

logger = logging.getLogger(__name__)

def generate_pdf_from_json(elements: list, page_width: float = None, page_height: float = None, background_image: str = None) -> bytes:
    """
    Generates a PDF file from a list of form elements (JSON).
    Elements: [{type, label, x, y, width, height, value, style ...}]
    """
    buffer = io.BytesIO()
    
    # Default to A4 if not specified
    if not page_width or not page_height:
        page_width, page_height = A4
        
    c = canvas.Canvas(buffer, pagesize=(page_width, page_height))
    width, height = page_width, page_height
    
    # 1. Draw Background Image (if provided)
    if background_image:
        try:
            # Check if it's a data URL
            if background_image.startswith('data:image'):
                header, encoded = background_image.split(",", 1)
                img_bytes = base64.b64decode(encoded)
                from reportlab.lib.utils import ImageReader
                img = ImageReader(io.BytesIO(img_bytes))
                # Draw image to fill the page
                c.drawImage(img, 0, 0, width=width, height=height)
        except Exception as e:
            print(f"Error drawing background: {e}")

    # 2. Draw Layers (Z-order preserved by list order)
    for el in elements:
        el_type = el.get('type')
        start_x = el.get('x', 0)
        # Frontend coordinates are Top-Left. ReportLab is Bottom-Left.
        # We need to flip Y.
        # y_top is the visual top Y coordinate in ReportLab system
        y_visual_top = height - el.get('y', 0)
        
        if el_type == 'image':
            img_data = el.get('src')
            w = el.get('width', 0)
            h = el.get('height', 0)
            if img_data and img_data.startswith('data:image'):
                try:
                    header, encoded = img_data.split(",", 1)
                    img_bytes = base64.b64decode(encoded)
                    from reportlab.lib.utils import ImageReader
                    img = ImageReader(io.BytesIO(img_bytes))
                    # drawImage(image, x, y, width=None, height=None)
                    # y is bottom-left of image
                    c.drawImage(img, start_x, y_visual_top - h, width=w, height=h, mask='auto')
                except Exception as e:
                    print(f"Error drawing image: {e}")
                    
        elif el_type == 'path':
            # Use svglib to render path
            from svglib.svglib import svg2rlg
            from reportlab.graphics import renderPDF
            import tempfile
            
            d = el.get('d')
            fill = el.get('fill', '#000000')
            stroke = el.get('stroke', 'none')
            stroke_width = el.get('strokeWidth', 1)
            
            # Simple SVG wrapper
            svg_content = f'<svg xmlns="http://www.w3.org/2000/svg"><path d="{d}" fill="{fill}" stroke="{stroke}" stroke-width="{stroke_width}"/></svg>'
            
            try:
                # svglib reads files usually, but can read stringIO?
                # svg2rlg takes a path usually.
                with tempfile.NamedTemporaryFile(mode='w+', suffix='.svg') as tf:
                    tf.write(svg_content)
                    tf.flush()
                    drawing = svg2rlg(tf.name)
                    
                # Drawing is at 0,0 internally
                # We need to translate it to start_x, y_visual_top - h
                # Actually, the path 'd' is relative to the element's bounding box top-left?
                # In layer_extraction: "d" was created relative to rect (x0, y0).
                # So "M 0 0" means Top-Left of the bounding box.
                
                # Render Drawing
                # renderPDF.draw(drawing, c, x, y)
                # Note: renderPDF.draw positions the drawing's (0,0) at (x,y)
                # Our SVG (0,0) corresponds to Top-Left of the element.
                # ReportLab (x,y) is Bottom-Left.
                # So if we draw at x, y_top, the SVG will be drawn UPWARDS?
                # No, ReportLab Drawing coordinates are usually Cartesian +Y Up.
                # SVGLib converts SVG (Y Down) to ReportLab (Y Up) automatically?
                # Usually svglib preserves the visual layout so (0,0) top-left in SVG becomes (0, height) in ReportLab drawing?
                # Let's assume svglib produces a Drawing object where content is correctly oriented but might need shifting.
                
                # Verified behavior: svglib drawing usually has Y pointing down visually relative to its origin?
                # Let's try drawing it at (start_x, y_visual_top - el_height).
                # Or simply:
                renderPDF.draw(drawing, c, start_x, y_visual_top - el.get('height', 0))
                
            except Exception as e:
                print(f"Error drawing path: {e}")

        elif el_type == 'text':
            # Handle Rich Text using Paragraph
            from reportlab.platypus import Paragraph
            from reportlab.lib.styles import ParagraphStyle
            from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
            
            # Legacy style object fallback (if element has nested style dict)
            style = el.get('style', {})
            
            # Helper to Convert HTML to ReportLab XML
            def clean_html(html_content):
                if not html_content: return ""
                # Replace Tiptap/HTML tags with ReportLab tags
                # <strong> -> <b>, <em> -> <i>, <span style="text-decoration: underline"> -> <u>
                # <span style="color: ..."> -> <font color="...">
                
                # Basic replacements
                txt = html_content.replace("<strong>", "<b>").replace("</strong>", "</b>")
                txt = txt.replace("<em>", "<i>").replace("</em>", "</i>")
                txt = txt.replace("<u>", "<u>").replace("</u>", "</u>") # Tiptap might send <u>
                
                # Handle alignment div/p? ParagraphStyle handles alignment.
                # But if alignment varies per line? Tiptap does <p style="text-align: right">
                # We might need to split by blocks if alignment changes. 
                # For now, simplistic: one style for the whole block? 
                # No, user wants character level. Alignment is usually block level.
                
                # Handle Color spans
                # Tiptap: <span style="color: #RRGGBB">text</span>
                # ReportLab: <font color="#RRGGBB">text</font>
                import re
                # Regex for color
                txt = re.sub(r'<span style="color:\s?(#[0-9a-fA-F]{6})[^"]*">', r'<font color="\1">', txt)
                txt = txt.replace("</span>", "</font>") 
                
                # Handle Highlight
                # Tiptap: <mark ...>
                # ReportLab: <font backColor="..."> ?
                txt = re.sub(r'<mark[^>]*style="background-color:\s?(#[0-9a-fA-F]{6})[^"]*"[^>]*>', r'<font backColor="\1">', txt)
                txt = txt.replace("</mark>", "</font>")
                
                # Remove <p> wrappers since we use them to split blocks manually or just treat as breaks
                txt = txt.replace("<p>", "").replace("</p>", "<br/>")
                
                return txt

            # --- Font Config ---
            font_size = el.get('fontSize', style.get('fontSize', 12))
            font_family = el.get('fontFamily', style.get('fontFamily', 'Arial'))
            
            # Map frontend font names
            pdf_font = "Helvetica"
            if "Roboto" in font_family: pdf_font = "Roboto"
            elif "Lato" in font_family: pdf_font = "Lato"
            elif "Montserrat" in font_family: pdf_font = "Montserrat"
            elif "Times" in font_family: pdf_font = "Times-Roman"
            elif "Courier" in font_family: pdf_font = "Courier"
            
            # Create a Paragraph Style
            # Alignment mapping
            align_map = { 'left': TA_LEFT, 'center': TA_CENTER, 'right': TA_RIGHT, 'justify': TA_JUSTIFY }
            text_align = el.get('textAlign', style.get('textAlign', 'left'))
            
            para_style = ParagraphStyle(
                'CustomStyle',
                fontName=pdf_font,
                fontSize=font_size,
                leading=font_size * 1.2, # Line height
                textColor=el.get('color', style.get('color', '#000000')),
                alignment=align_map.get(text_align, TA_LEFT)
            )
            
            # Prepare Content
            raw_text = el.get('text', '') or el.get('value', '')
            
            # If it looks like HTML (contains tags), treat as rich text
            # Otherwise, just escape it
            if "<" in raw_text and ">" in raw_text:
                xml_text = clean_html(raw_text)
            else:
                from xml.sax.saxutils import escape
                xml_text = escape(raw_text).replace("\n", "<br/>")
            
            # Rendering
            # Paragraph needs a width to wrap.
            w = el.get('width', 100) # Default width?
            h = el.get('height', 100)
            
            p = Paragraph(xml_text, para_style)
            
            # Wrap and Draw
            # available width = w
            # wrapOn returns (actual_w, actual_h)
            p.wrapOn(c, w, h)
            
            # Draw
            # y_visual_top is the top of the box.
            # Paragraph draws from bottom-up relative to its specific draw position y?
            # Standard: p.drawOn(c, x, y) where y is the BOTTOM of the paragraph box.
            # We want the paragraph TOP to be at y_visual_top.
            # So we need to calculate height of the paragraph.
            # But we only know height after wrap.
            # p.height is updated after wrap.
            
            # However, we are in a fixed box system.
            # If the user defined a box of Height H, we usually align top.
            # So y_bottom = y_visual_top - p.height ?? No.
            # p.drawOn draws at the anchor point. For Paragraphs, it's usually bottom-left of the first line?
            # Actually p.drawOn(c, x, y) puts the bottom-left of the paragraph bounding box at (x,y).
            
            # So: y_draw = y_visual_top - p.height
            p.drawOn(c, start_x, y_visual_top - p.height)

        elif el_type == 'line':
            # Draw a simple line (horizontal or vertical)
            from reportlab.lib.colors import HexColor
            
            stroke_color = el.get('strokeColor', '#000000')
            stroke_width = el.get('strokeWidth', 2)
            line_rotation = el.get('lineRotation', 0)  # 0 = horizontal, 90 = vertical
            w = el.get('width', 100)
            h = el.get('height', 100)
            
            c.saveState()
            try:
                c.setStrokeColor(HexColor(stroke_color))
            except ValueError:
                c.setStrokeColor(HexColor('#000000'))
            c.setLineWidth(stroke_width)
            
            if line_rotation == 0:
                # Horizontal line
                y_pos = y_visual_top - stroke_width / 2
                c.line(start_x, y_pos, start_x + w, y_pos)
            else:
                # Vertical line (90 degrees)
                x_pos = start_x + stroke_width / 2
                c.line(x_pos, y_visual_top, x_pos, y_visual_top - h)
            
            c.restoreState()

    c.save()
    buffer.seek(0)
    return buffer.getvalue()

# --- Font Registration ---
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import os

FONTS_DIR = os.path.join(os.path.dirname(__file__), "../fonts")

def register_fonts():
    # Attempt to register standard fonts if they exist
    font_map = {
        "Roboto": "Roboto-Regular.ttf",
        "Roboto-Bold": "Roboto-Bold.ttf",
        "Lato": "Lato-Regular.ttf",
        "Montserrat": "Montserrat-Regular.ttf"
    }
    
    for name, filename in font_map.items():
        path = os.path.join(FONTS_DIR, filename)
        if os.path.exists(path):
            try:
                pdfmetrics.registerFont(TTFont(name, path))
                print(f"Registered font: {name}")
            except Exception as e:
                print(f"Failed to register font {name}: {e}")

# Register on module import (or lazy load)
register_fonts()

import fitz

def merge_edits_into_pdf(original_pdf_path: str, modifications: dict, page_order: list = None) -> bytes:
    """
    Merges single-page edits into the original PDF.
    modifications: { 
        page_index (int/str): { 
            'layers': [...], 
            'width': float, 
            'height': float 
        } 
    }
    page_order: list of int (0-based indices) representing the desired output order.
    """
    try:
        doc = fitz.open(original_pdf_path)
        out_doc = fitz.open()

        # Determine the sequence of pages to process
        # If no order provided, use natural order 0..N-1
        if not page_order:
            page_order = list(range(len(doc)))

        for page_idx in page_order:
            # check bounds
            if page_idx < 0 or page_idx >= len(doc):
                continue
                
            # Check if this page has edits
            page_mod = modifications.get(page_idx) or modifications.get(str(page_idx))
            
            if page_mod:
                print(f"Processing page {page_idx+1} (edited)...")
                # Generate new page PDF
                new_pdf_bytes = generate_pdf_from_json(
                    page_mod.get('layers', []), 
                    page_mod.get('width'), 
                    page_mod.get('height')
                )
                
                # Insert the generated page
                with fitz.open("pdf", new_pdf_bytes) as temp_doc:
                    out_doc.insert_pdf(temp_doc)
            else:
                # Keep original page
                # copy page_idx from source to out_doc
                out_doc.insert_pdf(doc, from_page=page_idx, to_page=page_idx)
                
        return out_doc.tobytes()
        
    except Exception as e:
        print(f"Merge error: {e}")
        raise e
