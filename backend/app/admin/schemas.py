from pydantic import BaseModel
from typing import Optional


class AdminLoginRequest(BaseModel):
    username: str
    password: str


class AdminLoginResponse(BaseModel):
    token: str


class RejectListingRequest(BaseModel):
    reason: str


class VerifyUserRequest(BaseModel):
    is_verified_seller: bool
