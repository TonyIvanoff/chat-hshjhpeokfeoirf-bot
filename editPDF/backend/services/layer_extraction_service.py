import fitz  # PyMuPDF
import base64
import io

def extract_pdf_layers(pdf_path: str, page_num: int = 0):
    """
    Extracts PDF content as a list of independent layers:
    - Text Layers
    - Image Layers
    - Path/Vector Layers
    
    Returns:
        dict: {
            "width": float,
            "height": float,
            "layers": [ ... ]
        }
    """
    doc = fitz.open(pdf_path)
    if page_num >= len(doc):
        raise ValueError("Page number out of range")
        
    page = doc[page_num]
    
    # Use CropBox effectively (visible area)
    # If rotation is 90 or 270, we must swap width and height for the canvas
    rect = page.rect # cropbox is usually same as rect unless cropped
    
    # Origin offsets (usually 0,0 but can be non-zero in some PDFs)
    ox, oy = rect.x0, rect.y0
    
    if page.rotation in (90, 270):
        width, height = rect.height, rect.width
    else:
        width, height = rect.width, rect.height
    
    layers = []
    
    # 1. Extract Images (Logical Layout: Background)
    images = _extract_images(doc, page, ox, oy)
    layers.extend(images)
    
    # 2. Extract Paths (Logical Layout: Middle)
    paths = _extract_paths(page, ox, oy)
    layers.extend(paths)
    
    # 3. Extract Text (Logical Layout: Top)
    # Pass images to text extraction to prevent merging across images
    text = _extract_text(page, images, ox, oy) 
    layers.extend(text)
    
    # Assign simpler IDs for frontend
    for i, layer in enumerate(layers):
        if not layer.get("id"):
            layer["id"] = f"layer-{i}"
    
    # 4. Build layer hierarchy based on spatial containment
    layers = _build_layer_hierarchy(layers)
            
    return {
        "width": width,
        "height": height,
        "layers": layers
    }

def _extract_images(doc, page, ox=0, oy=0):
    """
    Extracts images as Base64 encoded layers, handling transparency (SMask).
    """
    image_layers = []
    
    # get_image_info(xrefs=True) gives us position
    image_list = page.get_image_info(xrefs=True)
    
    for img_info in image_list:
        xref = img_info['xref']
        bbox = img_info['bbox'] # [x0, y0, x1, y1]
        
        # 1. Create Pixmap from xref (this is the base image)
        try:
            pix = fitz.Pixmap(doc, xref)
        except Exception as e:
            # print(f"Skipping bad image xref {xref}: {e}")
            continue

        # 2. Check for Soft Mask (transparency)
        # base_image dict extraction is needed to check for smask presence easily if not checking pixmap directly?
        # fitz.Pixmap(doc, xref) automatically handles simple alpha, but separate smask needs manual merge.
        # Actually, let's check the smask xref.
        
        # We can try to construct the final transparent pixmap
        # If the image has an smask, pix.alpha is usually 0 initially (it's opaque),
        # but there's a separate smask object.
        
        # Easier way: extract raw image info to find smask xref
        try:
            base_image_info = doc.extract_image(xref)
            smask_xref = base_image_info.get("smask", 0)
        except Exception:
            smask_xref = 0

        if smask_xref > 0:
            try:
                # Load the mask
                mask = fitz.Pixmap(doc, smask_xref)
                
                # Check if we can merge. Base must be RGB (colorspace 1-3?)
                # If CMYK, convert to RGB first
                if pix.colorspace and pix.colorspace.n >= 4: # CMYK
                     temp = fitz.Pixmap(fitz.csRGB, pix)
                     pix = temp
                
                # Merge mask
                # fitz.Pixmap(pix, mask) returns a NEW pixmap with alpha
                # IF the mask is compatible.
                pix = fitz.Pixmap(pix, mask)
            except Exception as e:
                print(f"Failed to merge smask for xref {xref}: {e}")
        
        # 3. Ensure we have a valid PNG format (lossless, supports alpha)
        # If pixmap is CMYK or something else weird, convert to RGB
        if pix.n - pix.alpha >= 4: # CMYK
            pix = fitz.Pixmap(fitz.csRGB, pix)
            
        # Get PNG bytes
        image_bytes = pix.tobytes("png")
        
        # Encode
        b64_str = base64.b64encode(image_bytes).decode("utf-8")
        
        image_layers.append({
            "type": "image",
            "src": f"data:image/png;base64,{b64_str}", # Always PNG
            "x": bbox[0] - ox,
            "y": bbox[1] - oy,
            "width": bbox[2] - bbox[0],
            "height": bbox[3] - bbox[1],
            "rotation": 0
        })
        
    return image_layers

def _extract_paths(page, ox=0, oy=0):
    """
    Extracts vector drawings and converts to SVG Path layers.
    """
    path_layers = []
    drawings = page.get_drawings()
    
    for shape in drawings:
        rect = shape["rect"]
        
        # Convert items to SVG d string
        # IMPORTANT: _drawings_to_svg needs to know about offsets for path coordinates?
        # My implementation of _drawings_to_svg uses (p1.x - ox, p1.y - oy) where ox/oy passed to it are the rect origin.
        # But here rect is absolute.
        # So inside _drawings_to_svg, we normalize to (0,0) of the layer bounding box.
        # Layer x,y should be absolute space - page origin.
        
        layer_x = rect[0] - ox
        layer_y = rect[1] - oy
        
        svg_d = _drawings_to_svg(shape["items"], shape["rect"])
        
        # Color
        stroke = shape.get("color")
        fill = shape.get("fill")
        
        # Convert RGB tuple to Hex
        stroke_hex = _rgb_to_hex(stroke) if stroke else "transparent"
        fill_hex = _rgb_to_hex(fill) if fill else "transparent"
        
        # If both transparent, skip (invisible clipping path?)
        if stroke_hex == "transparent" and fill_hex == "transparent":
            continue

        # HEURISTIC: Skip "Background Paper" layers
        is_white_fill = fill_hex.lower() in ["#ffffff", "#fefefe", "#fffffe"]
        is_large = (rect[2] - rect[0]) > (page.rect.width * 0.9) and (rect[3] - rect[1]) > (page.rect.height * 0.9)
        
        if is_white_fill and is_large:
            # print(f"Skipping large white background path: {rect}")
            continue

        path_layers.append({
            "type": "path",
            "d": svg_d,
            "x": layer_x,
            "y": layer_y,
            "width": rect[2] - rect[0],
            "height": rect[3] - rect[1],
            "fill": fill_hex,
            "stroke": stroke_hex,
            "strokeWidth": shape.get("width", 1)
        })
        
    return path_layers

def _extract_text(page, images=[], ox=0, oy=0):
    """
    Extracts text as individual text block layers.
    Includes logic to merge separate blocks that act as a single paragraph.
    """
    raw_layers = []
    text_dict = page.get_text("dict")
    
    blocks = text_dict["blocks"]
    for b in blocks:
        if b["type"] == 0: # Text Block
            # Aggregate content for the entire block
            block_text_lines = []
            
            # Reprsentative style
            ref_span = None
            
            for line in b["lines"]:
                line_text = ""
                for span in line["spans"]:
                    # Concatenate spans in a line
                    line_text += span["text"]
                    if not ref_span:
                        ref_span = span
                
                if line_text.strip():
                     block_text_lines.append(line_text)
            
            full_text = "\n".join(block_text_lines)
            if not full_text:
                continue
                
            # Use block bbox
            bbox = b["bbox"]
            
            # Default styles
            font_size = ref_span["size"] if ref_span else 12
            font_family = ref_span["font"] if ref_span else "Arial"
            color_int = ref_span["color"] if ref_span else 0
            
            # Hex color
            r = (color_int >> 16) & 0xFF
            g = (color_int >> 8) & 0xFF
            b_col = color_int & 0xFF
            hex_color = "#{:02x}{:02x}{:02x}".format(r, g, b_col)
            
            # Recalculate height? 
            # DANGEROUS: Extending height artificially causes overlaps with subsequent layers because we don't shift them down.
            # Better to rely on merging to solve fragmentation, and let single layers flow/overflow naturally.
            final_height = bbox[3] - bbox[1]
            
            # Line height as a RATIO (not pixels) - frontend CSS expects a multiplier
            # Using 1.2 as a standard line-height ratio
            render_line_height = 1.2

            raw_layers.append({
                "type": "text",
                "text": full_text,
                "x": bbox[0] - ox,
                "y": bbox[1] - oy,
                "width": (bbox[2] - bbox[0]),
                "height": final_height,
                "fontSize": font_size,
                "fontFamily": font_family,
                "color": hex_color,
                "lineHeight": render_line_height
            })
            
    # Merge Logic
    return _merge_nearby_text_layers(raw_layers, images)

def _merge_nearby_text_layers(layers, images=[]):
    """
    Merges text layers that form paragraphs.
    Two-phase approach:
    1. Horizontal merge: Combine words on the same line
    2. Vertical merge: Combine lines into paragraphs (respecting columns)
    """
    if not layers: return []
    
    # Phase 1: Horizontal Merge - combine words on the same line
    layers.sort(key=lambda l: (round(l["y"]), l["x"]))
    
    h_merged = []
    current = layers[0]
    
    for next_layer in layers[1:]:
        # Same line if Y positions are very close
        y_tolerance = current["fontSize"] * 0.6
        same_line = abs(next_layer["y"] - current["y"]) < y_tolerance
        
        # Horizontally adjacent
        horizontal_gap = next_layer["x"] - (current["x"] + current["width"])
        max_gap = current["fontSize"] * 1.0  # Tighter gap for word spacing
        is_adjacent = horizontal_gap >= -3 and horizontal_gap <= max_gap
        
        if same_line and is_adjacent:
            separator = " " if not current["text"].endswith(" ") else ""
            current["text"] = current["text"] + separator + next_layer["text"]
            new_right = next_layer["x"] + next_layer["width"]
            current["width"] = new_right - current["x"]
            current["height"] = max(current["height"], next_layer["height"])
        else:
            h_merged.append(current)
            current = next_layer
    
    h_merged.append(current)
    
    # Phase 2: Simple Column Detection 
    # Find if there are distinct X position clusters (looking for column separators)
    # Get all X positions and sort them
    x_starts = sorted([l["x"] for l in h_merged])
    
    # Find the page width (max x + width)
    page_right = max(l["x"] + l["width"] for l in h_merged)
    page_left = min(l["x"] for l in h_merged)
    page_width = page_right - page_left
    
    # Detect columns: look for a gap in X positions that's at least 1/4 of page width
    # This would indicate a column gutter
    column_boundaries = [page_left]  # Start with left edge
    
    prev_x = x_starts[0]
    for x in x_starts[1:]:
        if x - prev_x > page_width * 0.15:  # Gap of 15% page width = column break
            column_boundaries.append((prev_x + x) / 2)  # Midpoint as boundary
        prev_x = x
    column_boundaries.append(page_right + 100)  # End boundary
    
    # Assign layers to columns based on their X position
    columns = {i: [] for i in range(len(column_boundaries) - 1)}
    for layer in h_merged:
        layer_x = layer["x"]
        for i in range(len(column_boundaries) - 1):
            if column_boundaries[i] <= layer_x < column_boundaries[i + 1]:
                columns[i].append(layer)
                break
    
    # Phase 3: Merge vertically within each column
    final_merged = []
    
    for col_idx, col_layers in columns.items():
        if not col_layers:
            continue
            
        col_layers.sort(key=lambda l: l["y"])
        
        merged_in_col = []
        current = col_layers[0]
        
        for next_layer in col_layers[1:]:
            vertical_gap = next_layer["y"] - (current["y"] + current["height"])
            
            # Merge if vertical gap is small (tight line spacing)
            max_vertical_gap = current["fontSize"] * 1.3
            is_continuation = vertical_gap >= -2 and vertical_gap <= max_vertical_gap
            
            # Image obstruction check
            is_obstructed = False
            gap_top = current["y"] + current["height"]
            gap_bottom = next_layer["y"]
            if gap_bottom > gap_top:
                for img in images:
                    img_y_start = img["y"]
                    img_y_end = img["y"] + img["height"]
                    overlaps_gap = not (img_y_end < gap_top or img_y_start > gap_bottom)
                    
                    col_x_start = min(current["x"], next_layer["x"])
                    col_x_end = max(current["x"] + current["width"], next_layer["x"] + next_layer["width"])
                    img_x_start = img["x"]
                    img_x_end = img["x"] + img["width"]
                    overlaps_col = not (img_x_end < col_x_start or img_x_start > col_x_end)
                    
                    if overlaps_gap and overlaps_col:
                        is_obstructed = True
                        break

            if is_continuation and not is_obstructed:
                current["text"] = current["text"] + "\n" + next_layer["text"]
                new_bottom = next_layer["y"] + next_layer["height"]
                current["height"] = new_bottom - current["y"]
                current["width"] = max(current["width"], next_layer["width"])
            else:
                merged_in_col.append(current)
                current = next_layer
                
        merged_in_col.append(current)
        final_merged.extend(merged_in_col)
    
    # Post-process: Add width buffer
    for l in final_merged:
        l["width"] *= 1.08
        
    return final_merged

def _drawings_to_svg(items, rect):
    """
    Converts PyMuPDF drawing items to SVG path data 'd' string.
    Note: Coordinates in 'd' will be relative to the page, but the rendered SVG
    container will likely be absolute.
    To make it easier for frontend, we can leave coordinates Absolute (relative to 0,0 of page)
    and just position the SVG at 0,0, OR relative to the rect.
    
    Decision: Use absolute coordinates in the Path 'd' for simplicity, 
    and frontend renders an SVG covering the whole drawing area, OR
    frontend renders small SVG at 'rect'.
    
    If we render small SVG at 'rect', we need to offset points by -rect.x, -rect.y.
    """
    d_commands = []
    
    # Helper to offset
    ox, oy = rect[0], rect[1]
    
    start_point = None
    
    for item in items:
        cmd = item[0]
        if cmd == "l": # line
            p1, p2 = item[1], item[2]
            # If start_point is different from p1, move there?
            # PyMuPDF "l" implies a segment from p1 to p2.
            # SVG path needs M first if not continuous.
            if start_point != p1:
                d_commands.append(f"M {p1.x - ox} {p1.y - oy}")
            d_commands.append(f"L {p2.x - ox} {p2.y - oy}")
            start_point = p2
            
        elif cmd == "c": # curve
            p1, p2, p3, p4 = item[1], item[2], item[3], item[4]
            # p1 is start anchor (current point), p2, p3 are controls, p4 is end
            if start_point != p1:
                d_commands.append(f"M {p1.x - ox} {p1.y - oy}")
            d_commands.append(f"C {p2.x - ox} {p2.y - oy}, {p3.x - ox} {p3.y - oy}, {p4.x - ox} {p4.y - oy}")
            start_point = p4
            
        elif cmd == "re": # rect
            r = item[1]
            # M x y H x+w V y+h H x Z
            # Rect is (x0, y0, x1, y1)
            x, y, w, h = r.x0 - ox, r.y0 - oy, r.width, r.height
            d_commands.append(f"M {x} {y} L {x+w} {y} L {x+w} {y+h} L {x} {y+h} Z")
            start_point = fitz.Point(r.x0, r.y0) # Resets roughly
            
    return " ".join(d_commands)

def _rgb_to_hex(rgb):
    if not rgb: return "transparent"
    # rgb is 0-1 float tuple for stroke/fill in drawings usually
    if isinstance(rgb, (list, tuple)):
        r = int(rgb[0] * 255)
        g = int(rgb[1] * 255)
        b = int(rgb[2] * 255)
        return "#{:02x}{:02x}{:02x}".format(r, g, b)
    return "#000000"


def _build_layer_hierarchy(layers: list) -> list:
    """
    Detect parent-child relationships based on spatial containment.
    A layer becomes a child of another if it is fully contained within it.
    """
    if not layers:
        return layers
    
    # Initialize parentId for all layers
    for layer in layers:
        layer['parentId'] = None
    
    # Sort by area descending (largest first) - candidates for parents
    sorted_by_area = sorted(
        enumerate(layers), 
        key=lambda x: x[1].get('width', 0) * x[1].get('height', 0), 
        reverse=True
    )
    
    # For each layer, find its smallest containing parent
    for i, layer in enumerate(layers):
        lx = layer.get('x', 0)
        ly = layer.get('y', 0)
        lw = layer.get('width', 0)
        lh = layer.get('height', 0)
        
        best_parent_id = None
        best_parent_area = float('inf')
        
        for _, potential_parent in sorted_by_area:
            # Skip self
            if potential_parent['id'] == layer['id']:
                continue
                
            px = potential_parent.get('x', 0)
            py = potential_parent.get('y', 0)
            pw = potential_parent.get('width', 0)
            ph = potential_parent.get('height', 0)
            
            parent_area = pw * ph
            layer_area = lw * lh
            
            # Skip if potential parent is smaller than layer
            if parent_area <= layer_area:
                continue
            
            # Check if layer is fully inside potential parent (with 2px tolerance)
            tolerance = 2
            if (lx >= px - tolerance and 
                ly >= py - tolerance and 
                lx + lw <= px + pw + tolerance and 
                ly + lh <= py + ph + tolerance):
                
                # Found a container, check if it's smaller than current best
                if parent_area < best_parent_area:
                    best_parent_area = parent_area
                    best_parent_id = potential_parent['id']
        
        layer['parentId'] = best_parent_id
    
    return layers
