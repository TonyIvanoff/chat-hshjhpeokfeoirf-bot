import shutil
import os
import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload

from app.api import deps
from app.models.user import User
from app.models.service import ServiceRequest, Item, RequestImage
from app.schemas.service import ServiceRequestCreate, ServiceRequestOut, ItemOut, ItemCreate
from app.services.ai_service import ai_service
from app.services.maps_service import maps_service
from app.services.training_service import training_service

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)




@router.post("/", response_model=ServiceRequestOut)
async def create_request(
    request_in: ServiceRequestCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Calculate Route Info
    distance_km, estimated_price = maps_service.calculate_route(
        request_in.pickup_address, 
        request_in.delivery_address
    )

    service_request = ServiceRequest(
        user_id=current_user.id,
        pickup_address=request_in.pickup_address,
        delivery_address=request_in.delivery_address,
        distance_km=distance_km,
        estimated_price=estimated_price,
        status="pending"
    )
    db.add(service_request)
    await db.commit()
    # await db.refresh(service_request) # Refresh acts weird with async relationships sometimes
    
    # Eager load relationships to avoid MissingGreenlet error
    result = await db.execute(
        select(ServiceRequest)
        .where(ServiceRequest.id == service_request.id)
        .options(selectinload(ServiceRequest.items), selectinload(ServiceRequest.images))
    )
    return result.scalars().first()

@router.get("/", response_model=List[ServiceRequestOut])
async def read_requests(
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(
        select(ServiceRequest)
        .where(ServiceRequest.user_id == current_user.id)
        .options(selectinload(ServiceRequest.items), selectinload(ServiceRequest.images))
    )
    return result.scalars().all()

@router.get("/{request_id}", response_model=ServiceRequestOut)
async def read_request(
    request_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    query = select(ServiceRequest).where(ServiceRequest.id == request_id)
    
    # If not admin, enforce ownership
    # Check role case-insensitively
    role = (current_user.role or "").lower()
    if role not in ["admin", "superuser"]:
        query = query.where(ServiceRequest.user_id == current_user.id)
        
    print(f"DEBUG: read_request id={request_id}, user={current_user.email}, role={role}")

    result = await db.execute(
        query.options(
            selectinload(ServiceRequest.items), 
            selectinload(ServiceRequest.images),
            selectinload(ServiceRequest.user)
        )
    )
    service_request = result.scalars().first()
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    return service_request

@router.post("/{request_id}/images", response_model=ServiceRequestOut)
async def upload_image(
    request_id: int,
    file: UploadFile = File(...),
    trigger_analysis: bool = True,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # 1. Verify request ownership
    result = await db.execute(
        select(ServiceRequest)
        .where(ServiceRequest.id == request_id, ServiceRequest.user_id == current_user.id)
        .options(selectinload(ServiceRequest.items), selectinload(ServiceRequest.images))
    )
    service_request = result.scalars().first()
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")

    # 2. Save file locally
    file_path = os.path.join(UPLOAD_DIR, f"{request_id}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # 3. Save Image record
    db_image = RequestImage(request_id=service_request.id, file_path=file_path)
    db.add(db_image)
    
    if trigger_analysis:
        # 4. Process with AI Service
        import traceback
        try:
            print(f"Analyzing image: {file_path}")
            ai_result = await ai_service.analyze_image(file_path)
            print("AI Analysis complete")
        except Exception as e:
            print(f"Error in AI Analysis: {e}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"AI Analysis Failed: {str(e)}")
        
        # 5. Create Item record(s) from AI result
        detected_items = ai_result.get("all_items", [])
        
        if not detected_items:
            # Fallback if list empty but main keys exist (e.g. Unidentified)
            volume = (ai_result["width_cm"] * ai_result["height_cm"] * ai_result["depth_cm"]) / 1_000_000
            new_item = Item(
                request_id=service_request.id,
                name=ai_result["name"],
                width_cm=ai_result["width_cm"],
                height_cm=ai_result["height_cm"],
                depth_cm=ai_result["depth_cm"],
                weight_kg=ai_result["weight_kg"],
                volume_m3=volume,
                quantity=1,
                color=ai_result.get("color"),
                bounding_box=json.dumps([ai_result.get("box")]) if ai_result.get("box") else None,
                image_id=db_image.id
            )
            db.add(new_item)
        else:
            # Group items by name + dimensions
            grouped = {}
            # Simple palette for differentiating groups (vibrant colors)
            palette = [
                "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#00FFFF", "#FF00FF", 
                "#FFA500", "#800080", "#FFC0CB", "#A52A2A", "#808080", "#008080",
                "#FFD700", "#4B0082", "#F0E68C", "#E6E6FA", "#FF4500", "#2E8B57",
                "#D2691E", "#9ACD32"
            ]
            color_idx = 0

            grouped_items = []

            def is_similar(dims1, dims2, threshold=0.2):
                 # Check if dimensions are within threshold % of each other
                 # dims = (w, h, d)
                 for v1, v2 in zip(dims1, dims2):
                     if v1 == 0 or v2 == 0: continue # Avoid div by zero
                     diff = abs(v1 - v2) / max(v1, v2)
                     if diff > threshold:
                         return False
                 return True

            for item_data in detected_items:
                # Rounding to nearest integer
                w = int(round(item_data["width_cm"]))
                h = int(round(item_data["height_cm"]))
                d = int(round(item_data["depth_cm"]))
                current_dims = (w, h, d)
                
                # Try to find a matching group
                match_found = False
                for group in grouped_items:
                     if group["name"] == item_data["name"]:
                         # Check similarity
                         group_dims = (group["width_cm"], group["height_cm"], group["depth_cm"])
                         if is_similar(current_dims, group_dims):
                             # Match found! Add to group
                             group["quantity"] += 1
                             if item_data.get("box"):
                                 group["boxes"].append(item_data["box"])
                             match_found = True
                             break
                
                if not match_found:
                     # New Group
                     assigned_color = palette[color_idx % len(palette)]
                     color_idx += 1
                     
                     grouped_items.append({
                        "name": item_data["name"],
                        "description": item_data.get("description", ""),
                        "width_cm": w,
                        "height_cm": h,
                        "depth_cm": d,
                        "weight_kg": item_data["weight_kg"],
                        "volume_m3": item_data["volume_m3"],
                        "quantity": 1,
                        "color": assigned_color,
                        "boxes": [item_data.get("box")] if item_data.get("box") else [],
                        "image_id": db_image.id
                     })
            
            # Save to DB
            for data in grouped_items:
                new_item = Item(
                    request_id=service_request.id,
                    name=data["name"],
                    description=data.get("description"),
                    width_cm=data["width_cm"],
                    height_cm=data["height_cm"],
                    depth_cm=data["depth_cm"],
                    weight_kg=data["weight_kg"],
                    volume_m3=data["volume_m3"],
                    quantity=data["quantity"],
                    color=data.get("color"),
                    bounding_box=json.dumps(data["boxes"]) if data["boxes"] else None,
                    image_id=data.get("image_id")
                )
                db.add(new_item)
    
    await db.commit()
    await db.refresh(service_request)
    
    # Re-fetch to return complete state with new items
    result = await db.execute(
        select(ServiceRequest)
        .where(ServiceRequest.id == request_id)
        .options(selectinload(ServiceRequest.items), selectinload(ServiceRequest.images))
    )
    return result.scalars().first()

@router.post("/{request_id}/analyze", response_model=ServiceRequestOut)
async def analyze_request_images(
    request_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # 1. Fetch Request with Images
    result = await db.execute(
        select(ServiceRequest)
        .where(ServiceRequest.id == request_id, ServiceRequest.user_id == current_user.id)
        .options(selectinload(ServiceRequest.items), selectinload(ServiceRequest.images))
    )
    service_request = result.scalars().first()
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")

    if not service_request.images:
        return service_request # No images to analyze

    # 2. Iterate and Analyze
    # New Logic: Group and Save Per Image
    import traceback
    
    for img in service_request.images:
        try:
            print(f"Batch Analyzing image: {img.file_path}")
            ai_result = await ai_service.analyze_image(img.file_path)
            
            # Collect items for THIS image
            items_in_img = ai_result.get("all_items", [])
            
            # Grouping Logic PER IMAGE
            grouped_items_for_img = []
            
            if not items_in_img:
                # Fallback for single item result
                 grouped_items_for_img.append({
                    "name": ai_result["name"],
                    "width_cm": ai_result["width_cm"],
                    "height_cm": ai_result["height_cm"],
                    "depth_cm": ai_result["depth_cm"],
                    "weight_kg": ai_result["weight_kg"],
                    "volume_m3": (ai_result["width_cm"] * ai_result["height_cm"] * ai_result["depth_cm"]) / 1_000_000,
                    "quantity": 1,
                    "color": ai_result.get("color"),
                    "boxes": [ai_result.get("box")] if ai_result.get("box") else [],
                    "image_id": img.id
                })
            else:
                 # Group identical items within this image
                grouped = {}
                palette = [
                    "#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#00FFFF", "#FF00FF", 
                    "#FFA500", "#800080", "#FFC0CB", "#A52A2A", "#808080", "#008080",
                    "#FFD700", "#4B0082", "#F0E68C", "#E6E6FA", "#FF4500", "#2E8B57",
                    "#D2691E", "#9ACD32"
                ]
                color_idx = 0
                
                def is_similar(dims1, dims2, threshold=0.2):
                     for v1, v2 in zip(dims1, dims2):
                         if v1 == 0 or v2 == 0: continue
                         diff = abs(v1 - v2) / max(v1, v2)
                         if diff > threshold: return False
                     return True
                
                for item_data in items_in_img:
                    w = int(round(item_data.get("width_cm", 0)))
                    h = int(round(item_data.get("height_cm", 0)))
                    d = int(round(item_data.get("depth_cm", 0)))
                    current_dims = (w, h, d)
                    
                    match_found = False
                    for group in grouped_items_for_img:
                         if group["name"] == item_data["name"]:
                             group_dims = (group["width_cm"], group["height_cm"], group["depth_cm"])
                             if is_similar(current_dims, group_dims):
                                 group["quantity"] += 1
                                 if item_data.get("box"):
                                     group["boxes"].append(item_data["box"])
                                 match_found = True
                                 break
                    
                    if not match_found:
                         assigned_color = palette[color_idx % len(palette)]
                         color_idx += 1
                         grouped_items_for_img.append({
                            "name": item_data["name"],
                            "description": item_data.get("description", ""),
                            "width_cm": w,
                            "height_cm": h,
                            "depth_cm": d,
                            "weight_kg": item_data.get("weight_kg", 0),
                            "volume_m3": item_data.get("volume_m3", 0),
                            "quantity": 1,
                            "color": assigned_color,
                            "boxes": [item_data.get("box")] if item_data.get("box") else [],
                            "image_id": img.id
                         })
            
            # Save Items for this image immediately
            for data in grouped_items_for_img:
                new_item = Item(
                    request_id=service_request.id,
                    name=data["name"],
                    description=data.get("description"),
                    width_cm=data["width_cm"],
                    height_cm=data["height_cm"],
                    depth_cm=data["depth_cm"],
                    weight_kg=data["weight_kg"],
                    volume_m3=data["volume_m3"],
                    quantity=data["quantity"],
                    color=data.get("color"),
                    bounding_box=json.dumps(data["boxes"]) if data["boxes"] else None,
                    image_id=data.get("image_id")
                )
                db.add(new_item)
                
        except Exception as e:
            print(f"Error analyzing {img.file_path}: {e}")
            traceback.print_exc()

    await db.commit()
    
    # Reload and return
    await db.refresh(service_request)
    result = await db.execute(
        select(ServiceRequest)
        .where(ServiceRequest.id == request_id)
        .options(selectinload(ServiceRequest.items), selectinload(ServiceRequest.images))
    )
    return result.scalars().first()

@router.delete("/{request_id}")
async def delete_request(
    request_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    
    # 1. Fetch Request with Images
    result = await db.execute(
        select(ServiceRequest)
        .where(ServiceRequest.id == request_id, ServiceRequest.user_id == current_user.id)
        .options(selectinload(ServiceRequest.images))
    )
    service_request = result.scalars().first()
    if not service_request:
        raise HTTPException(status_code=404, detail="Service request not found")
    
    # 2. Delete Physical Files
    for img in service_request.images:
        if os.path.exists(img.file_path):
            try:
                os.remove(img.file_path)
                # potentially remove annotated version too?
                root, ext = os.path.splitext(img.file_path)
                annotated_path = f"{root}_annotated{ext}"
                if os.path.exists(annotated_path):
                    os.remove(annotated_path)
            except OSError as e:
                print(f"Error deleting file {img.file_path}: {e}")
        
    await db.delete(service_request)
    await db.commit()
    return {"status": "success"}

@router.put("/items/{item_id}", response_model=ItemOut)
async def update_item(
    item_id: int,
    item_in: ItemCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Verify Item belongs to a request owned by user OR user is admin
    stmt = (
        select(Item)
        .join(ServiceRequest)
        .where(Item.id == item_id)
    )
    
    role = (current_user.role or "").lower()
    if role not in ["admin", "superuser"]:
        stmt = stmt.where(ServiceRequest.user_id == current_user.id)

    result = await db.execute(stmt)
    item = result.scalars().first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    previous_name = item.name
    
    # Update fields
    item.name = item_in.name
    item.width_cm = item_in.width_cm
    item.height_cm = item_in.height_cm
    item.depth_cm = item_in.depth_cm
    item.weight_kg = item_in.weight_kg
    item.volume_m3 = item_in.volume_m3
    item.quantity = item_in.quantity
    item.color = item_in.color
    
    # Update Bounding Box if provided
    new_box_val = None
    if item_in.bounding_box is not None:
        # DB expects string (JSON)
        if isinstance(item_in.bounding_box, list):
            new_box_val = json.dumps(item_in.bounding_box)
        else:
            new_box_val = item_in.bounding_box # Already string
        
        # Check if box actually changed
        box_changed = (item.bounding_box != new_box_val)
        item.bounding_box = new_box_val
    else:
        box_changed = False

    # AI Feedback Loop: Capture correction if name changed OR box changed
    name_changed = (previous_name != item_in.name)

    if (name_changed or box_changed) and item.image_id and item.bounding_box:
        # find image path
        img_stmt = select(RequestImage).where(RequestImage.id == item.image_id)
        img_res = await db.execute(img_stmt)
        img_obj = img_res.scalars().first()
        
        if img_obj and os.path.exists(img_obj.file_path):
             print(f"User correction detected: NameChange={name_changed}, BoxChange={box_changed}. Saving sample.")
             print(f"User correction detected: NameChange={name_changed}, BoxChange={box_changed}. Saving sample.")
             training_service.collect_training_sample(img_obj.file_path, item.bounding_box, item_in.name)

    # AUTO-APPEND Logic REMOVED


    # Recalculate volume if dims changed and volume not provided?  
    if (not item.volume_m3 or item.volume_m3 == 0) and item.width_cm and item.height_cm and item.depth_cm:
         item.volume_m3 = (item.width_cm * item.height_cm * item.depth_cm) / 1_000_000
    
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/items/{item_id}")
async def delete_item(
    item_id: int,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    stmt = (
        select(Item)
        .join(ServiceRequest)
        .where(Item.id == item_id)
    )
    
    role = (current_user.role or "").lower()
    if role not in ["admin", "superuser"]:
        stmt = stmt.where(ServiceRequest.user_id == current_user.id)
        
    result = await db.execute(stmt)
    item = result.scalars().first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
        
    await db.delete(item)
    await db.commit()
    return {"status": "success"}

@router.post("/{request_id}/items", response_model=ItemOut)
async def add_manual_item(
    request_id: int,
    item_in: ItemCreate,
    current_user: User = Depends(deps.get_current_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Verify Request ownership
    stmt = select(ServiceRequest).where(ServiceRequest.id == request_id)
    
    role = (current_user.role or "").lower()
    if role not in ["admin", "superuser"]:
        stmt = stmt.where(ServiceRequest.user_id == current_user.id)

    result = await db.execute(stmt)
    request = result.scalars().first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    volume = item_in.volume_m3
    if (not volume or volume == 0) and item_in.width_cm and item_in.height_cm and item_in.depth_cm:
        volume = (item_in.width_cm * item_in.height_cm * item_in.depth_cm) / 1_000_000

    new_item = Item(
        request_id=request_id,
        name=item_in.name,
        width_cm=item_in.width_cm,
        height_cm=item_in.height_cm,
        depth_cm=item_in.depth_cm,
        weight_kg=item_in.weight_kg,
        volume_m3=volume,
        quantity=item_in.quantity,
        color=item_in.color,
        description=item_in.description,
        bounding_box=item_in.bounding_box, # Allow manual bounding box
        image_id=item_in.image_id
    )
    db.add(new_item)
    
    # Training Loop: If manual item comes with a box, save it as a training sample!
    if item_in.bounding_box and item_in.image_id:
         img_stmt = select(RequestImage).where(RequestImage.id == item_in.image_id)
         img_res = await db.execute(img_stmt)
         img_obj = img_res.scalars().first()
         if img_obj and os.path.exists(img_obj.file_path):
             print(f"Manual drawn item added: {item_in.name}. Saving training sample.")
             training_service.collect_training_sample(img_obj.file_path, item_in.bounding_box, item_in.name)

    # AUTO-APPEND Logic REMOVED


    await db.commit()
    await db.refresh(new_item)
    return new_item

@router.get("/items/search", response_model=List[dict])
async def search_standard_items(
    q: str,
    db: AsyncSession = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    from app.models.service import StandardItem
    # Use ILIKE for case-insensitive search
    result = await db.execute(
        select(StandardItem)
        .where(StandardItem.name.ilike(f"%{q}%"))
        .order_by(StandardItem.name)
        .limit(100)
    )
    items = result.scalars().all()
    # Return as dicts or simple schema
    items = result.scalars().all()
    # Return as dicts or simple schema
    return [{
        "id": i.id, "name": i.name, "weight_kg": i.weight_kg, "volume_m3": i.volume_m3,
        "width_cm": i.width_cm, "height_cm": i.height_cm, "depth_cm": i.depth_cm
    } for i in items]

