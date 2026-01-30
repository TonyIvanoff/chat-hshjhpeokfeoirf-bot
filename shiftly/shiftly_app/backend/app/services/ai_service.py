import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from typing import Dict, Any, List
from ultralytics import YOLO

# Load YOLO-World model (Open Vocabulary Detection)
# This allows us to define specific classes like "bookshelf", "lamp" which aren't in standard COCO.
print("Loading YOLO-World AI Model...")
model = YOLO('yolov8s-world.pt') 

# Define Custom Vocabulary (The things we WANT to find)
CUSTOM_CLASSES = [
    "bookshelf", "bookcase", "cabinet", "wardrobe", "cupboard",
    "floor lamp", "table lamp", "ceiling light",
    "painting", "picture frame", "poster", "artwork",
    "cardboard box", "storage box", "plastic box",
    "sofa", "couch", "armchair", "chair", "stool", "bench",
    "dining table", "coffee table", "desk", "nightstand",
    "bed", "mattress",
    "tv", "monitor", "laptop", "computer", "television", "screen", "display",
    "refrigerator", "washing machine", "dishwasher", "microwave", "oven",
    "vase", "plant", "potted plant", "mirror", "rug", "carpet",
    "suitcase", "luggage", "backpack", "bag",
    "piano", "guitar", "bicycle", "scooter", "stroller"
]

# Set the classes for the model to look for
model.set_classes(CUSTOM_CLASSES)
print(f"YOLO-World loaded with {len(CUSTOM_CLASSES)} custom classes.")

class AIService:
    def analyze_image(self, image_path: str) -> Dict[str, Any]:
        """
        Analyzes an image using YOLO-World with custom furniture vocabulary.
        """
        
        # 1. Run Inference (Increased confidence to reduce noise)
        results = model(image_path, conf=0.15, iou=0.5, agnostic_nms=True)
        
        result = results[0] # First image result
        
        detected_items = []
        original_img = Image.open(image_path)
        draw = ImageDraw.Draw(original_img)
        
        # Color Palette (Hex for color picker)
        COLORS = [
            "#ff0000", "#00ff00", "#0000ff", "#ffff00", "#00ffff", "#ff00ff", 
            "#ffa500", "#800080", "#00ff00", "#ffc0cb"
        ]
        
        main_item_vol = 0
        main_item_name = "Unknown"
        main_item_weight = 0
        
        # 2. Process Detections
        # result.boxes contains: xyxy, conf, cls
        temp_items = []
        for i, box in enumerate(result.boxes):
            class_id = int(box.cls[0])
            class_name = result.names[class_id]
            confidence = float(box.conf[0])
            
            # Additional logic to skip "wall" if it appears in custom classes
            if class_name.lower() in ["wall", "floor", "ceiling"]:
                 continue

            x1, y1, x2, y2 = box.xyxy[0].tolist()
            
            temp_items.append({
                "class_id": class_id,
                "class_name": class_name,
                "confidence": confidence,
                "box": [x1, y1, x2, y2]
            })

        # 3. Apply Custom NMS (Aggressive De-duplication)
        # Filter temp_items before generating full item data
        filtered_indices = self._apply_custom_nms(temp_items, iou_threshold=0.3)
        
        # 4. Filter Reflected Items (Items inside TVs/Mirrors)
        # We need to pass the actual items (temp_items) and the indices we are keeping so far
        final_indices = self._filter_reflections(temp_items, filtered_indices)

        for i in final_indices:
            item = temp_items[i]

            class_name = item["class_name"]
            confidence = item["confidence"]
            x1, y1, x2, y2 = item["box"]
            class_id = item["class_id"]
            
            # Select color based on class ID
            color = COLORS[class_id % len(COLORS)]
            
            # Estimates
            w_cm, h_cm, d_cm, vol, weight = self._estimate_dimensions(
                class_name, 
                box=[y1, x1, y2, x2], 
                img_w=original_img.width, 
                img_h=original_img.height
            )

            # Generate description
            description = self._generate_description(class_name.title(), color, w_cm, h_cm, d_cm)

            # Add to list
            item_data = {
                "name": class_name.title(),
                "description": description,
                "width_cm": w_cm,
                "height_cm": h_cm,
                "depth_cm": d_cm,
                "weight_kg": weight,
                "volume_m3": round(vol, 3),
                "confidence": confidence,
                "color": color, # Bounding box color
                "box": [y1, x1, y2, x2] # TF used ymin, xmin... YOLO uses x1, y1. 
            }
            detected_items.append(item_data)
            
            # Update Main Item logic (largest volume)
            if vol >= main_item_vol:
                main_item_vol = vol
                main_item_name = class_name.title()
                main_item_weight = weight
                
            # Draw Box
            draw.rectangle([(x1, y1), (x2, y2)], outline=color, width=3)
            
            # Draw Text
            text = f"{class_name} {confidence:.2f}"
            self._draw_text(draw, x1, y1, text, color)

        # Save Annotated Image
        root, ext = os.path.splitext(image_path)
        annotated_path = f"{root}_annotated{ext}"
        original_img.save(annotated_path)
        
        # Fallback if empty
        if not detected_items:
             return {
                "name": "Unidentified Item",
                "width_cm": 100, "height_cm": 100, "depth_cm": 100,
                "weight_kg": 20, "volume_m3": 1.0, 
                "confidence": 0.0,
                "annotated_path": annotated_path,
                "all_items": []
            }

        return {
            "name": main_item_name,
            "width_cm": 100,
            "height_cm": 100,
            "depth_cm": round(main_item_vol * 100, 1),
            "weight_kg": main_item_weight,
            "confidence": 1.0, # Aggregate?
            "volume_m3": main_item_vol,
            "annotated_path": annotated_path,
            "all_items": detected_items
        }

    @staticmethod
    def _draw_text(draw, x, y, text, color):
        try:
            font = ImageFont.truetype("arial.ttf", 16)
        except IOError:
            font = ImageFont.load_default()
        
        # Estimate size
        # Pillow 9.2+ has getbbox, old has getsize. Fallback.
        try:
            left, top, right, bottom = font.getbbox(text)
            w, h = right - left, bottom - top
        except AttributeError:
             w, h = len(text)*8, 16

        draw.rectangle([(x, y - h - 4), (x + w + 4, y)], fill=color)
        draw.text((x + 2, y - h - 4), text, fill="black", font=font)

    @staticmethod
    def _estimate_dimensions(class_name: str, box=None, img_w=1, img_h=1):
        # Improved Heuristic: Use Box Size for W/H, Basic Estimate for Depth
        
        FOV_WIDTH_CM = 300 
        cm_per_pixel = FOV_WIDTH_CM / img_w if img_w > 0 else 0.1
        
        w_cm = 50 # Default
        h_cm = 50
        
        if box:
             x1, y1, x2, y2 = box[1], box[0], box[3], box[2]
             pixel_w = abs(x2 - x1)
             pixel_h = abs(y2 - y1)
             w_cm = round(pixel_w * cm_per_pixel)
             h_cm = round(pixel_h * cm_per_pixel)

        # Lookup depth/weight based on name heuristics (No DB)
        c = class_name.lower()
        d_cm = 50
        weight = 10
        
        if "sofa" in c or "couch" in c: d_cm, weight = 90, 80
        elif "chair" in c: d_cm, weight = 50, 10
        elif "table" in c: d_cm, weight = 90, 40
        elif "bed" in c: d_cm, weight = 200, 60
        elif "mattress" in c: d_cm, weight = 200, 30
        elif "wardrobe" in c: d_cm, weight = 60, 70
        elif "tv" in c or "monitor" in c: d_cm, weight = 10, 15
        elif "box" in c: d_cm, weight = 40, 5
        elif "lamp" in c: d_cm, weight = 20, 3
        else:
             # Generic
             d_cm, weight = 30, 10

        # Ensure minimums
        w_cm = max(10, w_cm)
        h_cm = max(10, h_cm)
        
        vol = (w_cm * h_cm * d_cm) / 1000000.0 # m3
        return w_cm, h_cm, d_cm, vol, weight

    @staticmethod
    def _apply_custom_nms(items, iou_threshold=0.3):
        """
        Apply Non-Maximum Suppression to filter separate Overlapping boxes of SAME class.
        """
        if not items:
            return []
            
        # Sort by confidence descending
        sorted_indices = sorted(range(len(items)), key=lambda i: items[i]["confidence"], reverse=True)
        keep = []
        
        while sorted_indices:
            current_i = sorted_indices.pop(0)
            keep.append(current_i)
            
            box_a = items[current_i]["box"]
            cls_a = items[current_i]["class_name"]
            
            remaining = []
            for other_i in sorted_indices:
                box_b = items[other_i]["box"]
                cls_b = items[other_i]["class_name"]
                
                # Only suppress if SAME class
                if cls_a != cls_b:
                    remaining.append(other_i)
                    continue
                
                # Calculate IoU
                x1 = max(box_a[0], box_b[0])
                y1 = max(box_a[1], box_b[1])
                x2 = min(box_a[2], box_b[2])
                y2 = min(box_a[3], box_b[3])
                
                inter_w = max(0, x2 - x1)
                inter_h = max(0, y2 - y1)
                intersection = inter_w * inter_h
                
                area_a = (box_a[2] - box_a[0]) * (box_a[3] - box_a[1])
                area_b = (box_b[2] - box_b[0]) * (box_b[3] - box_b[1])
                union = area_a + area_b - intersection
                
                iou = intersection / union if union > 0 else 0
                b_inside_a = (intersection / area_b) > 0.8 if area_b > 0 else False
                
                if iou > iou_threshold or b_inside_a:
                    pass # Drop it
                else:
                    remaining.append(other_i)
            
            sorted_indices = remaining
            
        return keep

    @staticmethod
    def _filter_reflections(items, indices_to_keep):
        """
        Filters out items that are likely reflections.
        """
        reflective_classes = ["tv", "monitor", "screen", "television", "display", "mirror"]
        
        container_indices = []
        for i in indices_to_keep:
            cls_name = items[i]["class_name"].lower()
            if any(r in cls_name for r in reflective_classes):
                container_indices.append(i)
        
        if not container_indices:
            return indices_to_keep
            
        final_keep = []
        
        for i in indices_to_keep:
            if i in container_indices:
                final_keep.append(i)
                continue
                
            is_reflection = False
            box_item = items[i]["box"] 
            area_item = (box_item[2] - box_item[0]) * (box_item[3] - box_item[1])
            
            for c_idx in container_indices:
                box_container = items[c_idx]["box"]
                x1 = max(box_item[0], box_container[0])
                y1 = max(box_item[1], box_container[1])
                x2 = min(box_item[2], box_container[2])
                y2 = min(box_item[3], box_container[3])
                inter_w = max(0, x2 - x1)
                inter_h = max(0, y2 - y1)
                intersection = inter_w * inter_h
                
                if area_item > 0:
                    coverage = intersection / area_item
                    if coverage > 0.80:
                        is_reflection = True
                        break
            
            if not is_reflection:
                final_keep.append(i)
                
        return final_keep

    @staticmethod
    def _generate_description(name, color_hex, w, h, d):
        context = "living area"
        if "bed" in name.lower(): context = "bedroom"
        if "table" in name.lower(): context = "dining or living area"
        return f"Standard {name} identified by AI. Estimated dimensions {w}x{h}x{d} cm. Suitable for {context}."

ai_service = AIService()
