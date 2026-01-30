import os
import shutil
import json
from PIL import Image

DATASET_DIR = "dataset"
IMAGES_DIR = os.path.join(DATASET_DIR, "images")
LABELS_DIR = os.path.join(DATASET_DIR, "labels")

# Ensure directories exist
os.makedirs(IMAGES_DIR, exist_ok=True)
os.makedirs(LABELS_DIR, exist_ok=True)

class TrainingService:
    @staticmethod
    def collect_training_sample(image_path: str, box_json: str, label: str):
        """
        Saves a training sample when a user corrects an item label.
        YOLO format requires:
        1. Image file
        2. Text file with same base name containing: <class_id> <x_center> <y_center> <width> <height>
        
        Since we don't have a fixed class ID map for open vocabulary yet, we will:
        - Save the image to dataset/images/
        - Append to a CSV or JSON manifest that maps 'filename' -> 'detected_box' -> 'corrected_label'
        - OR, strictly for fine-tuning, we need a class map.
        
        Strategy for now: Save Raw Correction Data + Image Crop?
        Better: Save full image + standard YOLO label file. We will generate class IDs dynamically during training preparation.
        For now, let's use a temporary class ID '0' and save the class name in a separate metadata file.
        """
        if not box_json or not label:
            return

        try:
            boxes = json.loads(box_json)
            if not isinstance(boxes, list) or not boxes:
                return
            
            # Use the first box (assuming single item correction context)
            box = boxes[0] # [x1, y1, x2, y2]
            
            # Generate a unique filename
            base_name = os.path.basename(image_path)
            name_root, ext = os.path.splitext(base_name)
            # Add timestamp or hash to avoid collision if same image used multiple times?
            # Actually, reusing the same image is fine, we just update the label file.
            
            target_image_path = os.path.join(IMAGES_DIR, base_name)
            target_label_path = os.path.join(LABELS_DIR, f"{name_root}.txt")
            
            # 1. Copy Image if not exists
            if not os.path.exists(target_image_path):
                shutil.copy(image_path, target_image_path)
            
            # 2. Calculate YOLO Coordinates (Normalized Center-Center-Width-Height)
            with Image.open(target_image_path) as img:
                img_w, img_h = img.size
            
            y1, x1, y2, x2 = box
            
            # Normalize
            dw = 1.0 / img_w
            dh = 1.0 / img_h
            
            x_center = (x1 + x2) / 2.0
            y_center = (y1 + y2) / 2.0
            w = x2 - x1
            h = y2 - y1
            
            x = x_center * dw
            y = y_center * dh
            w = w * dw
            h = h * dh
            
            # 3. Save Label
            # We need a system to map arbitrary text labels to IDs.
            # Let's save a "manifest.json" that tracks: filename -> list of {class_name, box_yolo}
            # Actually, standard YOLO txt is best.
            # Problem: We don't know the ID for "TV" vs "Mirror" if they change dynamically.
            # Solution: We will save a "metadata.json" for each file that stores the CLASS NAME.
            # `dataset/labels/filename.json` -> [{"label": "TV", "yolo": [x,y,w,h]}]
            # The training script will then load this and generate integer IDs.
            
            metadata_path = os.path.join(LABELS_DIR, f"{name_root}.json")
            
            existing_data = []
            if os.path.exists(metadata_path):
                with open(metadata_path, 'r') as f:
                    try:
                        existing_data = json.load(f)
                    except: pass
            
            # Update or Append?
            # If we are correcting a specific box, we should find specific box overlap?
            # Simple approach: Append and let training script handle overlap/duplicates (or just overwrite if simple).
            
            # Let's just append for now.
            new_entry = {
                "label": label,
                "yolo": [x, y, w, h]
            }
            existing_data.append(new_entry)
            
            with open(metadata_path, 'w') as f:
                json.dump(existing_data, f, indent=2)
                
            print(f"Saved training sample for {label} in {base_name}")

        except Exception as e:
            print(f"Error saving training sample: {e}")

training_service = TrainingService()
