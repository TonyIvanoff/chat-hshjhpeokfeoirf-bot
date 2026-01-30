from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
import uuid
import threading
import time
import re
import os
import sys
import subprocess
import shutil
import shutil
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from app.api import deps
from app.models.user import User
from app.models.system import ModuleLog, TrainingLog
from app.db.session import SessionLocal
from app.schemas.user import UserOut, UserUpdate, UserCreate
from app.core import security
import glob
import datetime

router = APIRouter()

def get_current_admin_user(current_user: User = Depends(deps.get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user does not have enough privileges"
        )
    return current_user

@router.get("/users", response_model=List[UserOut])
async def read_users(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(select(User).offset(skip).limit(limit))
    users = result.scalars().all()
    return users

@router.put("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    user_in: UserUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(
            status_code=404,
            detail="User not found"
        )
    
    if user_in.full_name is not None:
        user.full_name = user_in.full_name
    if user_in.role is not None:
        user.role = user_in.role
    if user_in.is_active is not None:
        user.is_active = user_in.is_active
    if user_in.password is not None:
        user.hashed_password = security.get_password_hash(user_in.password)
        
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/users", response_model=UserOut)
async def create_user(
    user_in: UserCreate, # Reusing UserCreate from schema
    role: str = "client", # Optional role query param or field? Let's use UserCreate but schema might not have role. Check schema.
    # Wait, UserCreate in schema does include role now (I added it).
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_in.email))
    existing_user = result.scalars().first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists"
        )
    
    user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role # Schema has role now
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(deps.get_db)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own admin account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    await db.delete(user)
    await db.commit()

# --- Admin Request Management ---
from app.models.service import ServiceRequest
from app.schemas.service import ServiceRequestOut
from sqlalchemy.orm import selectinload

@router.get("/requests", response_model=List[ServiceRequestOut])
async def read_all_requests(
    search: str = None,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(deps.get_db)
):
    query = select(ServiceRequest).join(User).options(
        selectinload(ServiceRequest.user),
        selectinload(ServiceRequest.items),
        selectinload(ServiceRequest.images)
    )
    
    if search:
        # Search by Request ID and User ID (exact int) OR User Email (partial string)
        if search.isdigit():
            val = int(search)
            query = query.where((ServiceRequest.id == val) | (ServiceRequest.user_id == val))
        else:
            # Assume email search
            query = query.where(User.email.ilike(f"%{search}%"))
    
    result = await db.execute(query.order_by(ServiceRequest.created_at.desc()))
    requests = result.scalars().all()
    return requests

@router.delete("/requests/{request_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_request_admin(
    request_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(deps.get_db)
):
    result = await db.execute(select(ServiceRequest).where(ServiceRequest.id == request_id))
    request = result.scalars().first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
        
    await db.delete(request)
    await db.commit()

# --- Modules Management ---
import subprocess
import sys
import json
import os
from pydantic import BaseModel

from typing import Optional

class ModuleAction(BaseModel):
    type: str # 'backend' or 'frontend'
    name: str
    action: str # 'update', 'install'
    version: Optional[str] = None

@router.get("/modules")
async def get_modules(current_user: User = Depends(get_current_admin_user)):
    modules = {"backend": [], "frontend": []}
    
    # 1. Backend (PIP)
    try:
        # Get installed
        result = subprocess.run([sys.executable, "-m", "pip", "list", "--format=json"], capture_output=True, text=True)
        installed = json.loads(result.stdout)
        
        # Get outdated (This is slow! ~2-5s)
        # Optimization: Only run if requested? But UI needs it. 
        # Making it async blocking is bad for concurrency. 
        # For this prototype, we'll accept the delay or run in executor.
        # Let's run plain blocking for now as it's an admin task.
        outdated_res = subprocess.run([sys.executable, "-m", "pip", "list", "--outdated", "--format=json"], capture_output=True, text=True)
        outdated = {}
        if outdated_res.returncode == 0:
            try:
                outdated_list = json.loads(outdated_res.stdout)
                for item in outdated_list:
                    outdated[item['name']] = item['latest_version']
            except:
                pass

        for pkg in installed:
            name = pkg['name']
            ver = pkg['version']
            latest = outdated.get(name, ver)
            modules["backend"].append({
                "name": name,
                "version": ver,
                "latest": latest
            })
            
    except Exception as e:
        print(f"Error fetching pip modules: {e}")

    # 2. Frontend (NPM)
    # Assume we are in backend/, so frontend is ../frontend/web
    frontend_path = os.path.abspath(os.path.join(os.getcwd(), "../frontend/web"))
    if os.path.exists(os.path.join(frontend_path, "package.json")):
        try:
            # Read package.json for direct deps (we don't want all nested deps typically)
            with open(os.path.join(frontend_path, "package.json"), 'r') as f:
                pkg_json = json.load(f)
                deps = {**pkg_json.get('dependencies', {}), **pkg_json.get('devDependencies', {})}
            
            # Get outdated
            # npm outdated --json returns non-zero exit code if things are outdated, so don't check returncode strictly
            npm_res = subprocess.run(["npm", "outdated", "--json"], cwd=frontend_path, capture_output=True, text=True)
            npm_outdated = {}
            try:
                npm_outdated = json.loads(npm_res.stdout)
            except:
                pass # returns empty or error text if nothing outdated sometimes
            
            for name, ver in deps.items():
                # Cleanup version string (remove ^ or ~)
                clean_ver = ver.replace('^', '').replace('~', '')
                latest = clean_ver
                
                if name in npm_outdated:
                    latest = npm_outdated[name].get('latest', clean_ver)
                    clean_ver = npm_outdated[name].get('current', clean_ver)
                
                # Check actual installed version if possible? 
                # 'npm list --depth=0 --json' gives installed tree.
                # Use that for 'version' instead of package.json to be accurate.
                
                modules["frontend"].append({
                    "name": name,
                    "version": clean_ver,
                    "latest": latest
                })

            # Update with actual installed via npm list (more accurate)
            npm_list_res = subprocess.run(["npm", "list", "--depth=0", "--json"], cwd=frontend_path, capture_output=True, text=True)
            if npm_list_res.returncode == 0:
                npm_tree = json.loads(npm_list_res.stdout)
                installed_deps = npm_tree.get('dependencies', {})
                for m in modules["frontend"]:
                    if m['name'] in installed_deps:
                        m['version'] = installed_deps[m['name']].get('version', m['version'])

        except Exception as e:
             print(f"Error fetching npm modules: {e}")
             
    return modules

@router.get("/modules/versions")
async def get_module_versions(type: str, name: str, current_user: User = Depends(get_current_admin_user)):
    versions = []
    from packaging.version import parse
    
    current_version = None

    if type == 'backend':
        # 1. Get Current Version
        try:
            res_ver = subprocess.run([sys.executable, "-m", "pip", "show", name], capture_output=True, text=True)
            for line in res_ver.stdout.split('\n'):
                if line.startswith("Version:"):
                    current_version = line.split(":", 1)[1].strip()
                    break
        except:
            pass
            
        # 2. Get Available Versions (PyPI)
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.get(f"https://pypi.org/pypi/{name}/json")
                if resp.status_code == 200:
                    data = resp.json()
                    all_vers = list(data.get("releases", {}).keys())
                    
                    # Filter and Sort
                    parsed_all = []
                    for v in all_vers:
                        try:
                            parsed_all.append((parse(v), v))
                        except:
                            pass
                    
                    # Sort desc
                    parsed_all.sort(key=lambda x: x[0], reverse=True)
                    
                    # Filter < current
                    valid_versions = []
                    if current_version:
                        curr = parse(current_version)
                        for p_ver, str_ver in parsed_all:
                            if p_ver < curr:
                                valid_versions.append(str_ver)
                    else:
                        valid_versions = [v for _, v in parsed_all]
                        
                    versions = valid_versions[:10]

        except Exception as e:
            print(f"Error checking pypi: {e}")

    elif type == 'frontend':
        # 1. Get Current Version
        frontend_path = os.path.abspath(os.path.join(os.getcwd(), "../frontend/web"))
        try:
            current_res = subprocess.run(["npm", "list", name, "--depth=0", "--json"], cwd=frontend_path, capture_output=True, text=True)
            if current_res.returncode == 0:
                data = json.loads(current_res.stdout)
                current_version = data.get('dependencies', {}).get(name, {}).get('version')
        except:
            pass

        # 2. Get Available Versions (NPM)
        try:
            cmd = ["npm", "view", name, "versions", "--json"]
            res = subprocess.run(cmd, cwd=frontend_path, capture_output=True, text=True)
            if res.returncode == 0:
                all_vers = json.loads(res.stdout)
                if not isinstance(all_vers, list):
                    all_vers = [all_vers]
                
                # Filter and Sort
                # NPM versions are usually sorted asc by default in the array, but let's be safe
                parsed_all = []
                for v in all_vers:
                    try:
                        parsed_all.append((parse(v), v))
                    except:
                        pass
                
                parsed_all.sort(key=lambda x: x[0], reverse=True)

                valid_versions = []
                if current_version:
                    curr = parse(current_version)
                    for p_ver, str_ver in parsed_all:
                        if p_ver < curr:
                            valid_versions.append(str_ver)
                else:
                     valid_versions = [v for _, v in parsed_all]

                versions = valid_versions[:10]
                
        except Exception as e:
            print(f"Error checking npm: {e}")
            
    return versions

@router.post("/modules/manage")
async def manage_module(
    action_in: ModuleAction,
    current_user: User = Depends(get_current_admin_user)
):
    # Determine from_version (Best effort)
    from_ver = "unknown"
    try:
        if action_in.type == 'backend':
            res_ver = subprocess.run([sys.executable, "-m", "pip", "show", action_in.name], capture_output=True, text=True)
            for line in res_ver.stdout.split('\n'):
                if line.startswith("Version:"):
                    from_ver = line.split(":", 1)[1].strip()
                    break
        elif action_in.type == 'frontend':
            res_ver = subprocess.run(["npm", "list", action_in.name, "--depth=0", "--json"], cwd=cwd, capture_output=True, text=True)
            if res_ver.returncode == 0:
                data = json.loads(res_ver.stdout)
                from_ver = data.get('dependencies', {}).get(action_in.name, {}).get('version', 'unknown')
    except:
        pass

    # Execute
    print(f"Executing Module Management Command: {cmd} in {cwd}") # DEBUG LOG
    
    log_status = "failed"
    log_to_ver = action_in.version or "latest" 
    # If update, we might not know the exact version until after. 
    # But let's log the intent for now.
    
    try:
        res = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
        print(f"Command Output: {res.stdout}") # DEBUG LOG
        print(f"Command Error: {res.stderr}") # DEBUG LOG
        
        if res.returncode != 0:
            raise HTTPException(status_code=500, detail=f"Operation failed: {res.stderr}")
        
        log_status = "success"
        return {"message": "Success", "details": res.stdout}
        
    except Exception as e:
        print(f"Exception during module execution: {e}") # DEBUG LOG
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Save Log
        try:
            from app.models.system import ModuleLog
            # Need a DB session here. 
            # We can't use 'db' from dependency inside 'finally' easily if not passed.
            # But manage_module function signature can request db session!
            # I need to add 'db: AsyncSession = Depends(deps.get_db)' to manage_module args first!
            pass # See next edit step to add db dependency
        except:
            pass

# To properly implement logging, I need to update the function signature first. 
# So I will split this into two edits or do a full replace of the function.
# Let's do full replace of manage_module AND add the history endpoint.

@router.get("/modules/history")
async def get_module_history(
    skip: int = 0,
    limit: int = 10,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(deps.get_db)
):
    from app.models.system import ModuleLog
    # Get Total Count
    count_query = select(func.count()).select_from(ModuleLog)
    count_res = await db.execute(count_query)
    total = count_res.scalar()

    query = select(ModuleLog).join(User).order_by(ModuleLog.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    data = []
    for log in logs:
        data.append({
            "id": log.id,
            "timestamp": log.timestamp,
            "action": log.action,
            "module_type": log.module_type,
            "module_name": log.module_name,
            "from_version": log.from_version,
            "to_version": log.to_version,
            "status": log.status,
            "user": log.user.email if log.user else "Unknown"
        })
    return {"items": data, "total": total}

# --- Job Management ---
# In-memory job store (resets on restart)
jobs: Dict[str, Dict[str, Any]] = {}

async def run_module_job(job_id: str, action: ModuleAction, cwd: str, cmd: List[str], user_id: str):
    jobs[job_id]["status"] = "running"
    jobs[job_id]["progress"] = 0
    jobs[job_id]["log"] = "Starting..."
    
    final_status = "failed"
    
    try:
        # Async Subprocess
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        
        # Read stdout asynchronously
        while True:
            line_bytes = await process.stdout.readline()
            if not line_bytes:
                break
            
            line = line_bytes.decode('utf-8').strip()
            if not line:
                continue
                
            jobs[job_id]["log"] = line
            
            # Progress Heuristics
            if "Downloading" in line or "fetch" in line.lower():
                jobs[job_id]["progress"] = min(90, jobs[job_id]["progress"] + 2)
            elif "Installing" in line:
                jobs[job_id]["progress"] = min(95, jobs[job_id]["progress"] + 5)
            elif "Successfully" in line:
                 jobs[job_id]["progress"] = 99
            
            # Regex Percentage
            match = re.search(r'(\d{1,3})%', line)
            if match:
                try:
                   p = int(match.group(1))
                   if p <= 100: jobs[job_id]["progress"] = p
                except: pass

        return_code = await process.wait()
        
        if return_code == 0:
            jobs[job_id]["status"] = "completed"
            jobs[job_id]["progress"] = 100
            jobs[job_id]["log"] = "Success"
            final_status = "success"
        else:
            jobs[job_id]["status"] = "failed"
            jobs[job_id]["progress"] = 100
            jobs[job_id]["log"] = f"Failed with code {return_code}"
            final_status = "failed"

    except Exception as e:
        jobs[job_id]["status"] = "failed"
        jobs[job_id]["log"] = str(e)
        final_status = "failed"
        
    finally:
        # LOG TO DB
        try:
            async with SessionLocal() as db:
                log_entry = ModuleLog(
                    action=action.action,
                    module_type=action.type,
                    module_name=action.name,
                    to_version=action.version or "latest",
                    status=final_status,
                    user_id=user_id
                )
                db.add(log_entry)
                await db.commit()
        except Exception as e:
            print(f"Failed to save module log: {e}")

@router.post("/modules/jobs/start")
async def start_module_job(
    action_in: ModuleAction,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_admin_user)
):
    job_id = str(uuid.uuid4())
    
    # Determine Command
    cmd = []
    cwd = os.getcwd() # Default
    
    if action_in.type == 'backend':
        cwd = os.getcwd()
        if action_in.action == 'update':
            cmd = [sys.executable, "-m", "pip", "install", "--upgrade", action_in.name]
        elif action_in.action == 'install':
            target = f"{action_in.name}=={action_in.version}" if action_in.version else action_in.name
            cmd = [sys.executable, "-m", "pip", "install", target]
        elif action_in.action == 'downgrade':
             cmd = [sys.executable, "-m", "pip", "install", f"{action_in.name}=={action_in.version}"]
             
    elif action_in.type == 'frontend':
        cwd = os.path.abspath(os.path.join(os.getcwd(), "../frontend/web"))
        if action_in.action == 'update':
            cmd = ["npm", "install", f"{action_in.name}@latest"]
        elif action_in.action == 'install':
            target = f"{action_in.name}@{action_in.version}" if action_in.version else action_in.name
            cmd = ["npm", "install", target]
            
    if not cmd:
        raise HTTPException(status_code=400, detail="Invalid action configuration")

    jobs[job_id] = {
        "id": job_id,
        "type": action_in.type,
        "name": action_in.name,
        "action": action_in.action,
        "status": "pending",
        "progress": 0,
        "log": "Queued"
    }

    # Pass user_id to background task
    background_tasks.add_task(run_module_job, job_id, action_in, cwd, cmd, str(current_user.id))
    
    return {"job_id": job_id, "status": "queued"}

    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    return jobs[job_id]


# --- AI Training Management ---

@router.get("/training/stats")
async def get_training_stats(current_user: User = Depends(get_current_admin_user)):
    """
    Scans the dataset directory to return validation on readily available training data.
    """
    dataset_dir = "dataset"
    images_dir = os.path.join(dataset_dir, "images")
    labels_dir = os.path.join(dataset_dir, "labels")

    stats = {
        "images_count": 0,
        "labels_count": 0,
        "classes": []
    }

    if os.path.exists(images_dir):
        # Count images
        formats = ['*.jpg', '*.jpeg', '*.png', '*.bmp']
        count = 0
        for f in formats:
            count += len(glob.glob(os.path.join(images_dir, f)))
        stats["images_count"] = count

    if os.path.exists(labels_dir):
        # Count JSON metadata files (these are our "source of truth" for dynamic classes)
        json_files = glob.glob(os.path.join(labels_dir, "*.json"))
        stats["labels_count"] = len(json_files)
        
        unique_classes = set()
        for fpath in json_files:
            try:
                with open(fpath, 'r') as f:
                    data = json.load(f)
                    for entry in data:
                        lbl = entry.get("label")
                        if lbl: unique_classes.add(lbl)
            except: pass
        stats["classes"] = sorted(list(unique_classes))

    return stats


async def run_training_job(log_id: int, start_time: float, cwd: str, cmd: List[str]):
    # Runs the training script via subprocess
    output_log = []
    status_str = "failed"
    
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=cwd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )
        
        while True:
            line_bytes = await process.stdout.readline()
            if not line_bytes:
                break
            line = line_bytes.decode('utf-8').strip()
            if line:
                output_log.append(line)
                # We could stream to a websocket or jobs dict if we wanted live progress in UI 
                # For now we just capture full log for DB

        return_code = await process.wait()
        status_str = "success" if return_code == 0 else "failed"

    except Exception as e:
        status_str = "failed"
        output_log.append(f"EXCEPTION: {str(e)}")
    
    # Calculate duration
    end_time = time.time()
    duration = int(end_time - start_time)
    
    # Parse epochs from log? (Optional, but nice)
    epochs = 0
    # Simple heuristic: count lines with "Epoch" or similar if YOLO output is standard
    for l in output_log:
        if "Epoch" in l and "/" in l:
            epochs += 1 # Rough estimate

    # Save to DB
    full_log_text = "\n".join(output_log)
    
    try:
        async with SessionLocal() as db:
            result = await db.execute(select(TrainingLog).where(TrainingLog.id == log_id))
            log_entry = result.scalars().first()
            if log_entry:
                log_entry.status = status_str
                log_entry.duration_seconds = duration
                log_entry.epoch_count = epochs
                log_entry.log_output = full_log_text
                
                db.add(log_entry)
                await db.commit()
    except Exception as e:
        print(f"Failed to update training log {log_id}: {e}")


@router.post("/training/train")
async def start_training(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # 1. Create Initial DB Log
    new_log = TrainingLog(
        status="running",
        user_id=current_user.id
    )
    db.add(new_log)
    await db.commit()
    await db.refresh(new_log)
    
    # 2. Prepare Command
    # script is in backend/train_model.py
    # backend is cwd normally
    script_path = "train_model.py"
    if not os.path.exists(script_path):
        # Fallback absolute path check
        script_path = os.path.join(os.getcwd(), "train_model.py")
    
    cmd = [sys.executable, script_path]
    
    # 3. Start Background Task
    start_time = time.time()
    background_tasks.add_task(run_training_job, new_log.id, start_time, os.getcwd(), cmd)
    
    return {"message": "Training started", "log_id": new_log.id}


@router.get("/training/history")
async def get_training_history(
    skip: int = 0,
    limit: int = 10,
    current_user: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(deps.get_db)
):
    # Get Total
    count_query = select(func.count()).select_from(TrainingLog)
    count_res = await db.execute(count_query)
    total = count_res.scalar()

    # Get Logs
    query = select(TrainingLog).join(User).order_by(TrainingLog.timestamp.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return {
        "items": logs,
        "total": total
    }

