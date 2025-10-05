import os
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, EmailStr
from supabase import create_client, Client
from postgrest import APIResponse

# --- Environment and Supabase Initialization ---
load_dotenv()

# Use the powerful SERVICE_KEY for backend operations
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# --- FastAPI App and Router Initialization ---
app = FastAPI(title="TimeBank API", description="Hyperlocal micro-time exchange platform")
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# --- Pydantic Models ---
class User(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: Optional[str] = None
    picture: Optional[str] = None
    skills: List[str] = []
    location: str = ""
    availability: str = ""
    verified: bool = False
    time_credits: int = 60
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class Task(BaseModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4)
    title: str
    description: str
    duration: int
    credits_offered: int
    task_type: str
    skills_required: List[str] = []
    location: str
    created_by: uuid.UUID
    assigned_to: Optional[uuid.UUID] = None
    status: str = "open"
    before_photo: Optional[str] = None
    after_photo: Optional[str] = None
    validation_result: Optional[Dict[str, Any]] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    completed_at: Optional[datetime] = None

class TaskCreate(BaseModel):
    title: str
    description: str
    duration: int
    credits_offered: int
    task_type: str
    skills_required: List[str] = []
    location: str

class TaskUpdate(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[uuid.UUID] = None
    before_photo: Optional[str] = None
    after_photo: Optional[str] = None

class UserUpdate(BaseModel):
    name: Optional[str] = None
    skills: Optional[List[str]] = None
    location: Optional[str] = None
    availability: Optional[str] = None

# --- Helper function to get user profile ---
def get_user_from_db(user_id: uuid.UUID) -> Optional[User]:
    """Fetches a user profile from the public.users table."""
    try:
        response = supabase.table('users').select("*").eq('id', str(user_id)).single().execute()
        if response.data:
            return User(**response.data)
        return None
    except Exception as e:
        logging.error(f"Database error fetching user {user_id}: {e}")
        return None

# --- Data Processing Helper ---
def process_tasks_from_db(tasks_data: List[Dict]) -> List[Task]:
    """Processes raw task data from Supabase to match the Pydantic model."""
    processed_tasks = []
    for task in tasks_data:
        # Handle the string-like array from postgres for skills_required
        if isinstance(task.get('skills_required'), str):
            # The string looks like "{skill one,"skill two"}"
            skills_str = task['skills_required'].strip('{}')
            if skills_str:
                # Handle quoted and unquoted skills
                task['skills_required'] = [skill.strip().strip('"') for skill in skills_str.split(',')]
            else:
                task['skills_required'] = []
        elif task.get('skills_required') is None:
            task['skills_required'] = []
        
        processed_tasks.append(Task(**task))
    return processed_tasks

# --- Authentication ---
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Validates Supabase JWT and returns the user's profile from the database."""
    token = credentials.credentials
    try:
        user_response = supabase.auth.get_user(token)
        auth_user = user_response.user
        if not auth_user:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")

        user_profile = get_user_from_db(auth_user.id)
        if not user_profile:
            raise HTTPException(status_code=404, detail="User profile not found")

        return user_profile
    except Exception as e:
        logging.error(f"Auth error: {e}")
        raise HTTPException(status_code=401, detail="Could not validate credentials")

@api_router.get("/auth/me", response_model=User)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    return current_user

# --- User Routes ---
@api_router.put("/users/profile", response_model=User)
async def update_profile(user_update: UserUpdate, current_user: User = Depends(get_current_user)):
    update_data = user_update.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")
    
    try:
        response: APIResponse = supabase.table('users').update(update_data, returning="representation").eq('id', str(current_user.id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="User not found to update")
        return User(**response.data[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

# --- Task Routes ---
@api_router.post("/tasks", response_model=Task)
async def create_task(task_data: TaskCreate, current_user: User = Depends(get_current_user)):
    if not (15 <= task_data.duration <= 60):
        raise HTTPException(status_code=400, detail="Duration must be between 15-60 minutes")

    if task_data.task_type == "request" and current_user.time_credits < task_data.credits_offered:
        raise HTTPException(status_code=400, detail="Insufficient time credits")

    try:
        task_dict = task_data.dict()
        task_dict['created_by'] = str(current_user.id)
        
        response: APIResponse = supabase.table('tasks').insert(task_dict, returning="representation").execute()
        
        if not response.data:
             raise Exception("Failed to create task or retrieve data after creation.")

        return Task(**response.data[0])
    except Exception as e:
        logging.error(f"Error in create_task: {e}")
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(location: Optional[str] = None, task_type: Optional[str] = None, status: Optional[str] = "open"):
    try:
        query = supabase.table('tasks').select("*").eq('status', status)
        if location:
            query = query.ilike('location', f'%{location}%')
        if task_type and task_type != 'all':
            query = query.eq('task_type', task_type)
        
        response = query.order('created_at', desc=True).limit(100).execute()
        # FIX: Process tasks before returning
        return process_tasks_from_db(response.data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@api_router.get("/tasks/my", response_model=List[Task])
async def get_my_tasks(current_user: User = Depends(get_current_user)):
    user_id = str(current_user.id)
    try:
        response = supabase.table('tasks').select("*").or_(f'created_by.eq.{user_id},assigned_to.eq.{user_id}').order('created_at', desc=True).execute()
        # FIX: Process tasks before returning
        return process_tasks_from_db(response.data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")


@api_router.post("/tasks/{task_id}/assign", response_model=Task)
async def assign_task(task_id: uuid.UUID, current_user: User = Depends(get_current_user)):
    try:
        task_response = supabase.table('tasks').select("*").eq('id', str(task_id)).single().execute()
        task = task_response.data
        if not task: raise HTTPException(status_code=404, detail="Task not found")
        if task['status'] != 'open': raise HTTPException(status_code=400, detail="Task is not available")
        if str(task['created_by']) == str(current_user.id): raise HTTPException(status_code=400, detail="Cannot assign your own task")
            
        update_response: APIResponse = supabase.table('tasks').update({
            "assigned_to": str(current_user.id), "status": "assigned"
        }, returning="representation").eq('id', str(task_id)).execute()
        
        return Task(**update_response.data[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@api_router.put("/tasks/{task_id}", response_model=Task)
async def update_task(task_id: uuid.UUID, task_update: TaskUpdate, current_user: User = Depends(get_current_user)):
    update_data = task_update.dict(exclude_unset=True)
    if not update_data:
        raise HTTPException(status_code=400, detail="No update data provided")

    try:
        task_response = supabase.table('tasks').select("created_by, assigned_to").eq('id', str(task_id)).single().execute()
        task = task_response.data
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        user_id_str = str(current_user.id)
        if task['created_by'] != user_id_str and task['assigned_to'] != user_id_str:
            raise HTTPException(status_code=403, detail="Not authorized to update this task")
        
        response: APIResponse = supabase.table('tasks').update(update_data, returning="representation").eq('id', str(task_id)).execute()
        if not response.data:
            raise HTTPException(status_code=404, detail="Task not found to update")
        
        return Task(**response.data[0])
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

@api_router.post("/tasks/{task_id}/validate")
async def validate_task(task_id: uuid.UUID, current_user: User = Depends(get_current_user)):
    try:
        task_response = supabase.table('tasks').select("*").eq('id', str(task_id)).single().execute()
        task = task_response.data
        if not task:
            raise HTTPException(status_code=404, detail="Task not found")
        
        if not task.get("before_photo") or not task.get("after_photo"):
            raise HTTPException(status_code=400, detail="Both before and after photos are required for validation.")
        if task.get("status") != "assigned":
             raise HTTPException(status_code=400, detail=f"Task cannot be validated with status '{task.get('status')}'.")

        validation_result = {"valid": True, "confidence": 95, "reason": "Task appears complete (mock response)."}
        
        update_data = {"validation_result": validation_result}

        if validation_result["valid"]:
            sender_id = task['created_by']
            receiver_id = task['assigned_to']
            amount = task['credits_offered']
            
            supabase.rpc('transfer_credits', {'sender_id': sender_id, 'receiver_id': receiver_id, 'amount': amount}).execute()

            update_data["status"] = "validated"
            update_data["completed_at"] = datetime.now(timezone.utc).isoformat()
        else:
            update_data["status"] = "needs_review"

        supabase.table('tasks').update(update_data).eq('id', str(task_id)).execute()
        
        return {"validation_result": validation_result}

    except Exception as e:
        logging.error(f"Validation error for task {task_id}: {e}")
        raise HTTPException(status_code=500, detail=f"An error occurred during validation: {e}")


# --- App Configuration ---
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.environ.get('CORS_ORIGINS', 'http://localhost:3000').split(','),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logging.basicConfig(level=logging.INFO)

