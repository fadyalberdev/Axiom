import re
from datetime import date

from fastapi import APIRouter, HTTPException, Depends, status
from app.auth.schemas import SignUpRequest, LoginRequest, UpdateProfileRequest, ProfileResponse, SendPhoneOTPRequest, VerifyPhoneOTPRequest
from app.database import supabase_client, supabase_admin
from app.dependencies import get_current_user
from app.config import settings

router = APIRouter()


def _age_from_birth_date(value: str | None) -> int | None:
    if not value:
        return None
    try:
        born = date.fromisoformat(value[:10])
    except ValueError:
        return None
    today = date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def _with_calculated_age(profile: dict) -> dict:
    return {
        **profile,
        "age": _age_from_birth_date(profile.get("birth_date")) or profile.get("age"),
    }


def _payload_with_calculated_age(update_data: dict) -> dict:
    if "birth_date" not in update_data:
        return update_data
    return {
        **update_data,
        "age": _age_from_birth_date(update_data.get("birth_date")),
    }


def _missing_schema_columns(error_msg: str) -> set[str]:
    missing = set()
    for column in ("birth_date", "whatsapp_number"):
        if "PGRST204" in error_msg and column in error_msg:
            missing.add(column)
    return missing


def _is_e164_phone(value: str | None) -> bool:
    return bool(value and re.match(r"^\+[1-9]\d{7,14}$", value))


def _sync_auth_phone(user_id: str, phone: str | None) -> None:
    """
    Best-effort sync so Supabase Auth owns phone OTP delivery/verification.
    Phone recovery still requires Supabase to verify the code before a session exists.
    """
    try:
        if phone is None:
            supabase_admin.auth.admin.update_user_by_id(user_id, {"phone": None})
        elif _is_e164_phone(phone):
            supabase_admin.auth.admin.update_user_by_id(user_id, {"phone": phone})
    except Exception:
        pass


@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(body: SignUpRequest):
    """
    Create a new user account.
    Uses admin client to create the Supabase auth user (skips email confirmation).
    The DB trigger `on_auth_user_created` auto-creates the profiles row.
    """
    user_metadata: dict = {"full_name": body.full_name}
    if body.phone:
        user_metadata["phone"] = body.phone
    if body.country_code:
        user_metadata["country_code"] = body.country_code
    if body.gender:
        user_metadata["gender"] = body.gender

    try:
        create_payload = {
                "email": body.email,
                "password": body.password,
                "user_metadata": user_metadata,
                "email_confirm": True,  # auto-confirm so user can log in immediately
        }
        if _is_e164_phone(body.phone):
            create_payload["phone"] = body.phone

        auth_resp = supabase_admin.auth.admin.create_user(create_payload)
    except Exception as e:
        error_msg = str(e)
        if "already registered" in error_msg or "already been registered" in error_msg:
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=400, detail=f"Signup failed: {error_msg}")

    if not auth_resp.user:
        raise HTTPException(status_code=400, detail="Signup failed: no user returned")

    user_id = auth_resp.user.id

    # The trigger should have created the profile, but update extra fields if needed
    update_data: dict = {}
    if body.phone:
        update_data["phone"] = body.phone
    if body.country_code:
        update_data["country_code"] = body.country_code
    if body.gender:
        update_data["gender"] = body.gender

    if update_data:
        try:
            supabase_admin.table("profiles").update(update_data).eq("id", user_id).execute()
            if "phone" in update_data:
                _sync_auth_phone(user_id, update_data["phone"])
        except Exception:
            pass  # Profile update is best-effort; trigger already created the row

    return {"message": "Account created successfully", "user_id": user_id}


@router.post("/login")
async def login(body: LoginRequest):
    """
    Validate credentials via Supabase auth.
    Returns 200 if valid — the frontend manages the session directly with Supabase JS.
    """
    try:
        auth_resp = supabase_client.auth.sign_in_with_password(
            {"email": body.email, "password": body.password}
        )
    except Exception as e:
        error_msg = str(e)
        if "Invalid login credentials" in error_msg or "invalid_grant" in error_msg:
            raise HTTPException(status_code=401, detail="Invalid email or password")
        raise HTTPException(status_code=400, detail=f"Login failed: {error_msg}")

    if not auth_resp.user:
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return {"message": "ok"}


@router.get("/me", response_model=ProfileResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    """Return the authenticated user's full profile."""
    return _with_calculated_age(current_user)


@router.put("/me", response_model=ProfileResponse)
async def update_me(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    """Update the authenticated user's profile."""
    user_id = current_user["id"]

    update_data = _payload_with_calculated_age(body.model_dump(exclude_unset=True))
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    try:
        result = (
            supabase_admin.table("profiles")
            .update(update_data)
            .eq("id", user_id)
            .execute()
        )
    except Exception as e:
        error_msg = str(e)
        missing_columns = _missing_schema_columns(error_msg)
        if missing_columns:
            fallback_data = {
                key: value for key, value in update_data.items() if key not in missing_columns
            }
            try:
                result = (
                    supabase_admin.table("profiles")
                    .update(fallback_data)
                    .eq("id", user_id)
                    .execute()
                )
            except Exception as retry_error:
                raise HTTPException(status_code=500, detail=f"Failed to update profile: {retry_error}")
        else:
            raise HTTPException(status_code=500, detail=f"Failed to update profile: {e}")

    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")

    if "phone" in update_data:
        _sync_auth_phone(user_id, update_data["phone"])

    return _with_calculated_age(result.data[0])


@router.post("/send-phone-otp")
async def send_phone_otp(body: SendPhoneOTPRequest):
    """
    Send a 6-digit SMS OTP to the given phone number via Twilio Verify.
    Phone must be in E.164 format: +201234567890
    """
    if not settings.twilio_account_sid:
        raise HTTPException(status_code=503, detail="Phone verification not configured")

    # Basic E.164 validation
    if not re.match(r"^\+[1-9]\d{7,14}$", body.phone):
        raise HTTPException(status_code=422, detail="Phone must be in E.164 format, e.g. +201234567890")

    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        verification = client.verify.v2.services(
            settings.twilio_verify_service_sid
        ).verifications.create(to=body.phone, channel="sms")
        return {"status": verification.status, "phone": body.phone}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to send OTP: {str(e)}")


@router.post("/verify-phone-otp")
async def verify_phone_otp(body: VerifyPhoneOTPRequest):
    """
    Check the 6-digit OTP code for the given phone number.
    Returns {"verified": true} on success or raises 400 on wrong code.
    """
    if not settings.twilio_account_sid:
        raise HTTPException(status_code=503, detail="Phone verification not configured")

    if not re.match(r"^\+[1-9]\d{7,14}$", body.phone):
        raise HTTPException(status_code=422, detail="Phone must be in E.164 format, e.g. +201234567890")

    try:
        from twilio.rest import Client
        client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
        check = client.verify.v2.services(
            settings.twilio_verify_service_sid
        ).verification_checks.create(to=body.phone, code=body.code)
        if check.status == "approved":
            return {"verified": True}
        raise HTTPException(status_code=400, detail="Invalid or expired code")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Verification failed: {str(e)}")
