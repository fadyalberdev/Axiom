import uuid
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from app.database import supabase_admin
from app.dependencies import get_current_user

router = APIRouter()

ALLOWED_BUCKETS = {"avatars", "listing-images", "attachments"}
# SVG can carry inline scripts and execute as HTML; exe/html are obviously dangerous.
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif", "pdf"}


class SignedUrlRequest(BaseModel):
    bucket: str
    filename: str


@router.post("/signed-url")
async def get_signed_upload_url(
    body: SignedUrlRequest,
    current_user: dict = Depends(get_current_user),
):
    """
    Generate a signed upload URL for direct client-side uploads to Supabase Storage.
    Bucket must be one of: avatars, listing-images, attachments.
    The returned upload_url is used by the client to PUT the file directly.
    """
    if body.bucket not in ALLOWED_BUCKETS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid bucket. Allowed: {', '.join(ALLOWED_BUCKETS)}",
        )

    # Scope uploads to the user's folder to prevent path traversal
    user_id = current_user["id"]
    # Generate a unique filename to avoid collisions
    ext = body.filename.rsplit(".", 1)[-1].lower() if "." in body.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File type not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}")
    unique_name = f"{uuid.uuid4().hex}.{ext}" if ext else uuid.uuid4().hex
    storage_path = f"{user_id}/{unique_name}"

    try:
        # supabase-py >= 2.0 storage API
        response = supabase_admin.storage.from_(body.bucket).create_signed_upload_url(storage_path)
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to generate signed URL")

    # supabase-py returns a dict with 'signedURL' and 'path'
    if isinstance(response, dict):
        signed_url = response.get("signedURL") or response.get("signed_url") or ""
        path = response.get("path") or storage_path
    else:
        # Fallback for different supabase-py versions
        signed_url = getattr(response, "signed_url", "") or getattr(response, "signedURL", "")
        path = getattr(response, "path", storage_path)

    # Build the public URL for displaying the file after upload
    public_url = f"{supabase_admin.storage.from_(body.bucket).get_public_url(path)}"

    return {
        "upload_url": signed_url,
        "path": path,
        "public_url": public_url,
        "bucket": body.bucket,
    }
