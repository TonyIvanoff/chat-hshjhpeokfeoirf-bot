from ultralytics import YOLO
import os
import glob
import yaml
import json

# Configuration
DATASET_DIR = "dataset"
IMAGES_DIR = os.path.join(DATASET_DIR, "images")
LABELS_DIR = os.path.join(DATASET_DIR, "labels")
YAML_PATH = os.path.join(DATASET_DIR, "custom_data.yaml")

def prepare_dataset_yaml():
    """
    scans the dataset/labels directory to find all unique class names (from .json metadata)
    and generates the dataset.yaml file required by YOLO.
    """
    print("Scanning dataset for classes...")
    json_files = glob.glob(os.path.join(LABELS_DIR, "*.json"))
    
    unique_classes = set()
    
    # 1. Collect all unique class names
    for fpath in json_files:
        try:
            with open(fpath, 'r') as f:
                data = json.load(f)
                for entry in data:
                    label = entry.get("label", "").lower().strip()
                    if label:
                        unique_classes.add(label)
        except Exception:
            pass
            
    if not unique_classes:
        print("No annotated data found in dataset/labels/*.json")
        return None
        
    class_list = sorted(list(unique_classes))
    print(f"Found {len(class_list)} classes: {class_list}")
    
    # 2. Assign IDs and Rewrite .txt files
    # YOLO requires .txt files with <class_id> <x> <y> <w> <h>
    # We update the .txt files based on our current dynamic class map.
    
    class_map = {name: idx for idx, name in enumerate(class_list)}
    
    txt_files_written = 0
    
    for fpath in json_files:
        try:
            with open(fpath, 'r') as f:
                data = json.load(f)
            
            # Base name for txt file
            base_name = os.path.splitext(os.path.basename(fpath))[0]
            txt_path = os.path.join(LABELS_DIR, f"{base_name}.txt")
            
            with open(txt_path, 'w') as txt_f:
                for entry in data:
                    label = entry.get("label", "").lower().strip()
                    yolo_box = entry.get("yolo") # [x, y, w, h]
                    
                    if label in class_map and yolo_box:
                        cid = class_map[label]
                        line = f"{cid} {yolo_box[0]} {yolo_box[1]} {yolo_box[2]} {yolo_box[3]}\n"
                        txt_f.write(line)
            
            txt_files_written += 1
            
        except Exception as e:
            print(f"Error processing {fpath}: {e}")

    # 3. Create YAML
    data_config = {
        'path': os.path.abspath(DATASET_DIR),
        'train': 'images', # We use same folder for train/val for this simple example (overfit is fine for correction)
        'val': 'images',
        'names': {idx: name for idx, name in enumerate(class_list)}
    }
    
    with open(YAML_PATH, 'w') as f:
        yaml.dump(data_config, f)
        
    print(f"Dataset prepared. Config saved to {YAML_PATH}")
    return YAML_PATH

def train_model():
    print("Starting Training Process...")
    
    yaml_file = prepare_dataset_yaml()
    if not yaml_file:
        print("Training aborted: No data.")
        return

    # Load the base model (YOLO-World or a standard YOLOv8 pre-trained)
    # Note: Fine-tuning YOLO-World specifically might require specific config, 
    # but treating it as a standard YOLOv8 detection task works for "teaching new fixed classes".
    # For open-vocab retention, we'd need a different approach, but this standard fine-tuning 
    # is the robust way to "force" it to learn specific items reliably.
    
    model = YOLO('yolov8s.pt') # Start from standard pre-trained weights to learn new concepts or refine
    # OR use 'yolov8s-world.pt' if supported for transfer learning (it often is treated as v8 structure)
    
    print("Fine-tuning model on collected dataset...")
    
    # Train
    results = model.train(
        data=yaml_file, 
        epochs=50, 
        imgsz=640, 
        batch=4,
        project="shiftly_training",
        name="fine_tuned_model"
    )
    
    print("Training Complete!")
    print(f"New model saved at: {results.save_dir}/weights/best.pt")
    print("To use this new model, update 'ai_service.py' to load this specific .pt file.")

if __name__ == "__main__":
    train_model()
