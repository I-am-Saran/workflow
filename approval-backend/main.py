from fastapi import FastAPI, HTTPException, Depends, Header, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from supabase import create_client, Client
from datetime import datetime
import os
import json

app = FastAPI()

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://workflow-lake-xi.vercel.app"],  # update with your prod domain(s) if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Supabase Configuration
SUPABASE_URL = "https://uxhmfriecraetlrpjrep.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV4aG1mcmllY3JhZXRscnBqcmVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MTkxMDMxMywiZXhwIjoyMDc3NDg2MzEzfQ.LMSMPnBZ6TOO3o3HjbZ8hEi6O2QfmALQwu6_i3D_HtY"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Models
class ApprovalRequest(BaseModel):
    title: str
    description: str
    requester_email: str

class ApprovalAction(BaseModel):
    action: str  # "approve" or "reject"
    comment: Optional[str] = None

class WorkflowConfig(BaseModel):
    workflow_order: List[str]

# Auth Helper
def get_current_user(authorization: str = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    # Expect "Bearer mock-token-email"
    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(status_code=401, detail="Invalid Authorization header format")

    token = parts[1]
    if not token.startswith("mock-token-"):
        raise HTTPException(status_code=401, detail="Invalid token")

    email = token.replace("mock-token-", "")

    # Lookup the user in DB
    response = supabase.table("users").select("*").eq("email", email).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")

    return response.data[0]

@app.get("/")
async def root():
    return {"message": "Approval Workflow API", "status": "running"}

@app.post("/api/requests")
async def create_request(request: ApprovalRequest, user=Depends(get_current_user)):
    if user["role"] != "L1":
        raise HTTPException(status_code=403, detail="Only L1 users can create requests")
    
    # Get current workflow
    config = supabase.table("workflow_config").select("*").eq("id", 1).execute()
    workflow_order = config.data[0]["workflow_order"] if config.data else ["L1", "L2", "L3"]

    # If the first stage is L1, start approvals at the next stage so L2 sees it.
    initial_stage = 1 if workflow_order and workflow_order[0].upper() == "L1" else 0
    
    new_request = {
        "title": request.title,
        "description": request.description,
        "requester_email": request.requester_email,
        "status": "pending",
        "current_stage": initial_stage,
        "workflow_snapshot": workflow_order,
        "created_at": datetime.utcnow().isoformat(),
        "updated_at": datetime.utcnow().isoformat(),
    }
    
    result = supabase.table("approval_requests").insert(new_request).execute()
    
    history = {
        "request_id": result.data[0]["id"],
        "stage": 0,
        "role": "L1",
        "action": "created",
        "actor_email": user["email"],
        "timestamp": datetime.utcnow().isoformat()
    }
    supabase.table("approval_history").insert(history).execute()
    
    return result.data[0]

@app.get("/api/requests/my-requests")
async def get_my_requests(user=Depends(get_current_user)):
    if user["role"] != "L1":
        raise HTTPException(status_code=403, detail="Only L1 users can view their requests")
    
    result = supabase.table("approval_requests")\
        .select("*")\
        .eq("requester_email", user["email"])\
        .order("created_at", desc=True)\
        .execute()
    
    return result.data

@app.get("/api/requests/pending/{role}")
async def get_pending_requests(role: str, user=Depends(get_current_user)):
    if user["role"] != role:
        raise HTTPException(status_code=403, detail="Access denied for this role")

    result = supabase.table("approval_requests")\
        .select("*")\
        .eq("status", "pending")\
        .order("created_at", desc=True)\
        .execute()

    filtered = []
    for r in result.data or []:
        snap = r.get("workflow_snapshot", [])
        idx = r.get("current_stage", 0)
        if 0 <= idx < len(snap) and str(snap[idx]).upper() == role.upper():
            filtered.append(r)

    return filtered

@app.get("/api/requests/{request_id}")
async def get_request(request_id: int, user=Depends(get_current_user)):
    result = supabase.table("approval_requests").select("*").eq("id", request_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Request not found")
    
    request = result.data[0]
    if user["role"] == "L1" and request["requester_email"] != user["email"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    history = supabase.table("approval_history")\
        .select("*")\
        .eq("request_id", request_id)\
        .order("timestamp", desc=False)\
        .execute()
    
    request["history"] = history.data
    return request

@app.post("/api/requests/{request_id}/action")
async def perform_action(request_id: int, action: ApprovalAction, user=Depends(get_current_user)):
    if user["role"] not in ["L2", "L3"]:
        raise HTTPException(status_code=403, detail="Only L2/L3 can approve/reject")
    
    result = supabase.table("approval_requests").select("*").eq("id", request_id).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Request not found")
    
    request = result.data[0]
    workflow = request["workflow_snapshot"]
    current_stage = request["current_stage"]
    
    if current_stage >= len(workflow) or workflow[current_stage] != user["role"]:
        raise HTTPException(status_code=403, detail="Not your turn to approve")
    
    history = {
        "request_id": request_id,
        "stage": current_stage,
        "role": user["role"],
        "action": action.action,
        "comment": action.comment,
        "actor_email": user["email"],
        "timestamp": datetime.utcnow().isoformat()
    }
    supabase.table("approval_history").insert(history).execute()
    
    if action.action == "approve":
        next_stage = current_stage + 1
        if next_stage >= len(workflow):
            supabase.table("approval_requests").update({
                "status": "approved",
                "current_stage": current_stage,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", request_id).execute()
        else:
            supabase.table("approval_requests").update({
                "current_stage": next_stage,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", request_id).execute()
    else:  # reject
        if current_stage > 0:
            supabase.table("approval_requests").update({
                "current_stage": current_stage - 1,
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", request_id).execute()
        else:
            supabase.table("approval_requests").update({
                "status": "rejected",
                "updated_at": datetime.utcnow().isoformat()
            }).eq("id", request_id).execute()
    
    return {"message": f"Request {action.action}ed successfully"}

@app.get("/api/workflow")
async def get_workflow(user=Depends(get_current_user)):
    result = supabase.table("workflow_config").select("*").eq("id", 1).execute()
    if result.data:
        return result.data[0]
    return {"workflow_order": ["L1", "L2", "L3"]}

@app.put("/api/workflow")
async def update_workflow(config: WorkflowConfig, user=Depends(get_current_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="Only admin can update workflow")
    
    existing = supabase.table("workflow_config").select("*").eq("id", 1).execute()
    if existing.data:
        result = supabase.table("workflow_config").update({
            "workflow_order": config.workflow_order,
            "updated_at": datetime.utcnow().isoformat()
        }).eq("id", 1).execute()
    else:
        result = supabase.table("workflow_config").insert({
            "id": 1,
            "workflow_order": config.workflow_order,
            "updated_at": datetime.utcnow().isoformat()
        }).execute()
    return result.data[0]

@app.get("/api/dashboard")
async def get_dashboard(user=Depends(get_current_user)):
    if user["role"] not in ["L0", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    all_requests = supabase.table("approval_requests")\
        .select("*")\
        .order("created_at", desc=True)\
        .execute()
    
    summary = {
        "total": len(all_requests.data),
        "pending": len([r for r in all_requests.data if r["status"] == "pending"]),
        "approved": len([r for r in all_requests.data if r["status"] == "approved"]),
        "rejected": len([r for r in all_requests.data if r["status"] == "rejected"]),
        "requests": all_requests.data
    }
    return summary

@app.post("/login")
async def login(email: str = Form(...), password: str = Form(...)):
    response = supabase.table("users").select("*").eq("email", email).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="User not found")

    user = response.data[0]
    if password != user['password']:
        raise HTTPException(status_code=401, detail="Invalid password")

    token = f"mock-token-{email}"
    return {"user": user, "token": token}
