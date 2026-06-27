from pydantic import BaseModel
from typing import Literal, Optional, Any


# ─── Request Bodies ──────────────────────────────────────────────────────────

class CreateListingRequest(BaseModel):
    title: str
    description: Optional[str] = None
    category: Literal["for_rent", "for_sale", "shared_housing"]
    property_type: Literal[
        "apartment", "villa", "studio", "duplex", "penthouse",
        "commercial", "room", "chalet", "townhouse", "twin_house",
        "land", "whole_building", "office",
    ]
    price: float
    currency: str = "EGP"
    price_period: Optional[str] = None
    # Location
    location: str
    full_address: Optional[str] = None
    city: str
    neighborhood_id: Optional[str] = None
    compound_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    # Physical
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    size_sqm: Optional[float] = None
    floor_number: Optional[int] = None
    total_floors: Optional[int] = None
    # Media
    images: list[str] = []
    amenities: list[str] = []
    # Rental fields
    lease_type: Optional[str] = None
    min_stay_months: Optional[int] = None
    available_date: Optional[str] = None
    # Sale fields
    payment_plan: Optional[dict[str, Any]] = None
    delivery_date: Optional[str] = None
    title_deed_status: Optional[str] = None
    # Shared housing fields
    room_type: Optional[str] = None
    lifestyle_preferences: Optional[dict[str, Any]] = None
    total_spots: Optional[int] = None
    filled_spots: Optional[int] = None
    availability: Optional[str] = None
    furnishing: Optional[str] = None
    utilities_included: Optional[bool] = None
    bathroom_type: Optional[str] = None
    private_amenities: list[str] = []
    shared_amenities: list[str] = []
    # Agency association
    agency_id: Optional[str] = None
    project_id: Optional[str] = None


class UpdateListingRequest(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    price_period: Optional[str] = None
    location: Optional[str] = None
    full_address: Optional[str] = None
    city: Optional[str] = None
    neighborhood_id: Optional[str] = None
    compound_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    size_sqm: Optional[float] = None
    floor_number: Optional[int] = None
    total_floors: Optional[int] = None
    images: Optional[list[str]] = None
    amenities: Optional[list[str]] = None
    lease_type: Optional[str] = None
    min_stay_months: Optional[int] = None
    available_date: Optional[str] = None
    payment_plan: Optional[dict[str, Any]] = None
    delivery_date: Optional[str] = None
    title_deed_status: Optional[str] = None
    room_type: Optional[str] = None
    lifestyle_preferences: Optional[dict[str, Any]] = None
    total_spots: Optional[int] = None
    filled_spots: Optional[int] = None
    availability: Optional[str] = None
    furnishing: Optional[str] = None
    utilities_included: Optional[bool] = None
    bathroom_type: Optional[str] = None
    private_amenities: Optional[list[str]] = None
    shared_amenities: Optional[list[str]] = None
    # Agency association — project may be (re)assigned; agency is server-derived
    project_id: Optional[str] = None


# ─── Response Shapes ─────────────────────────────────────────────────────────

class ListingBriefResponse(BaseModel):
    id: str
    title: str
    location: str
    price: float
    currency: str
    price_period: Optional[str] = None
    category: str
    property_type: str
    images: list[str]
    verified: bool
    is_new: bool
    status: str
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    size_sqm: Optional[float] = None
    floor_number: Optional[int] = None
    neighborhood: Optional[str] = None
    compound_name: Optional[str] = None
    room_type: Optional[str] = None
    lifestyle_preferences: Optional[dict[str, Any]] = None
    total_spots: Optional[int] = None
    filled_spots: Optional[int] = None
    utilities_included: Optional[bool] = None
    available_date: Optional[str] = None
    views_count: int
    created_at: str


class ListingDetailResponse(BaseModel):
    id: str
    owner_id: str
    agency_id: Optional[str] = None
    title: str
    location: str
    full_address: Optional[str] = None
    price: float
    currency: str
    price_period: Optional[str] = None
    category: str
    property_type: str
    status: str
    verified: bool
    is_new: bool
    images: list[str]
    description: Optional[str] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[int] = None
    size_sqm: Optional[float] = None
    floor_number: Optional[int] = None
    total_floors: Optional[int] = None
    neighborhood: Optional[str] = None
    neighborhood_id: Optional[str] = None
    compound_name: Optional[str] = None
    amenities: list[str]
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    views_count: int
    similar_listings: list[ListingBriefResponse] = []
    # Rental fields
    lease_type: Optional[str] = None
    min_stay_months: Optional[int] = None
    available_date: Optional[str] = None
    # Sale fields
    payment_plan: Optional[dict[str, Any]] = None
    delivery_date: Optional[str] = None
    title_deed_status: Optional[str] = None
    # Shared housing fields
    room_type: Optional[str] = None
    lifestyle_preferences: Optional[dict[str, Any]] = None
    total_spots: Optional[int] = None
    filled_spots: Optional[int] = None
    availability: Optional[str] = None
    furnishing: Optional[str] = None
    utilities_included: Optional[bool] = None
    bathroom_type: Optional[str] = None
    private_amenities: list[str] = []
    shared_amenities: list[str] = []
    created_at: str
    contact_phone: Optional[str] = None
    contact_name: Optional[str] = None


class ListingsPageResponse(BaseModel):
    listings: list[ListingBriefResponse]
    total: int
    page: int
    per_page: int
