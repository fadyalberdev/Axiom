# Partner Universities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full Partner Universities system — DB table, backend API, admin CRUD, and public pages — mirroring agencies but without projects.

**Architecture:** New `universities` table + `university_id` FK on listings. Public FastAPI router at `/api/universities`. Admin CRUD in the existing admin router. Frontend public pages at `/universities` and `/universities/[slug]`. Admin dashboard section + EntityPicker support. Existing `UniversitiesSection` wired to real data.

**Tech Stack:** FastAPI + Supabase (backend), Next.js 16 App Router + TanStack Query + Supabase JS (frontend), TypeScript strict, Tailwind CSS.

---

## File Map

**New files:**
- `backend/app/universities/__init__.py`
- `backend/app/universities/schemas.py`
- `backend/app/universities/router.py`
- `frontend/src/app/universities/page.tsx`
- `frontend/src/app/universities/[slug]/page.tsx`
- `frontend/src/components/universities/UniversityHero.tsx`
- `frontend/src/components/universities/UniversitySidebar.tsx`

**Modified files:**
- `backend/app/main.py` — register universities router
- `backend/app/admin/router.py` — add POST/PUT/DELETE /universities + fix listing create for university_id
- `frontend/src/types/api.ts` — add ApiUniversity, PaginatedUniversities
- `frontend/src/types/index.ts` — replace mock University with UniversityDetail
- `frontend/src/lib/constants.ts` — remove University import + UNIVERSITIES mock
- `frontend/src/lib/supabase-queries.ts` — add getUniversities, getUniversity
- `frontend/src/components/agencies/UniversitiesSection.tsx` — wire to real API
- `frontend/src/components/agencies/UniversityCard.tsx` — use ApiUniversity shape
- `frontend/src/components/admin/AdminSidebar.tsx` — add Universities nav item
- `frontend/src/components/admin/EntityPicker.tsx` — add "universities" section
- `frontend/src/app/admin/dashboard/page.tsx` — universities SECTIONS + listing pickers

---

## Task 1: DB Migration

**Files:**
- Supabase migration via MCP tool

- [ ] **Step 1: Apply migration**

Run via Supabase MCP `apply_migration` with name `add_universities`:

```sql
CREATE TABLE universities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  logo_url TEXT,
  banner_url TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  city TEXT,
  verified BOOLEAN DEFAULT false,
  founded_year INTEGER,
  type TEXT CHECK (type IN ('public', 'private')),
  student_count INTEGER,
  accreditation TEXT,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE listings ADD COLUMN university_id UUID REFERENCES universities(id);

ALTER TABLE universities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "universities_public_read" ON universities FOR SELECT USING (true);
CREATE POLICY "universities_service_all" ON universities USING (auth.role() = 'service_role');
```

- [ ] **Step 2: Verify**

Run via MCP `execute_sql`:
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'universities' ORDER BY ordinal_position;
SELECT column_name FROM information_schema.columns WHERE table_name = 'listings' AND column_name = 'university_id';
```
Expected: universities has 16 columns, listings has university_id.

---

## Task 2: Backend — universities module

**Files:**
- Create: `backend/app/universities/__init__.py`
- Create: `backend/app/universities/schemas.py`
- Create: `backend/app/universities/router.py`

- [ ] **Step 1: Create `__init__.py`**

```python
```
(empty file)

- [ ] **Step 2: Create `schemas.py`**

```python
from pydantic import BaseModel
from typing import Optional


class CreateUniversityRequest(BaseModel):
    name: str
    slug: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    founded_year: Optional[int] = None
    type: Optional[str] = None
    student_count: Optional[int] = None
    accreditation: Optional[str] = None


class UpdateUniversityRequest(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    logo_url: Optional[str] = None
    banner_url: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    founded_year: Optional[int] = None
    type: Optional[str] = None
    student_count: Optional[int] = None
    accreditation: Optional[str] = None
    verified: Optional[bool] = None
```

- [ ] **Step 3: Create `router.py`**

```python
from fastapi import APIRouter, HTTPException, Query
from app.database import supabase_admin

router = APIRouter()


def _compute_trust_score(
    verified: bool,
    listings_count: int,
    student_count: int | None,
    founded_year: int | None,
) -> int:
    pts = 40 if verified else 0
    pts += min(listings_count * 2, 30)
    if student_count:
        pts += min(student_count // 1000, 20)
    if founded_year:
        age = max(0, 2026 - founded_year)
        pts += min(age // 5, 10)
    return min(pts, 100)


def _build_university_brief(row: dict, listings_count: int = 0) -> dict:
    return {
        "id": row["id"],
        "slug": row["slug"],
        "name": row["name"],
        "subtitle": (row.get("description") or "")[:100] or None,
        "logo_url": row.get("logo_url"),
        "banner_url": row.get("banner_url"),
        "verified": bool(row.get("verified", False)),
        "listings_count": listings_count,
        "city": row.get("city"),
        "type": row.get("type"),
        "student_count": row.get("student_count"),
        "accreditation": row.get("accreditation"),
        "founded_year": row.get("founded_year"),
        "website": row.get("website"),
        "phone": row.get("phone"),
        "email": row.get("email"),
        "description": row.get("description"),
        "trust_score": 0,
        "created_at": row.get("created_at"),
    }


@router.get("")
async def list_universities(
    page: int = Query(1, ge=1),
    per_page: int = Query(12, ge=1, le=100),
    city: str | None = Query(None),
):
    offset = (page - 1) * per_page
    query = supabase_admin.table("universities").select("*", count="exact")
    if city:
        query = query.ilike("city", f"%{city}%")
    query = query.order("created_at", desc=True).range(offset, offset + per_page - 1)

    try:
        result = query.execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    enriched = []
    for uni in (result.data or []):
        try:
            count_result = (
                supabase_admin.table("listings")
                .select("id", count="exact")
                .eq("university_id", uni["id"])
                .eq("status", "active")
                .is_("deleted_at", "null")
                .execute()
            )
            listings_count = count_result.count or 0
        except Exception:
            listings_count = 0
        brief = _build_university_brief(uni, listings_count)
        brief["trust_score"] = _compute_trust_score(
            brief["verified"], listings_count, uni.get("student_count"), uni.get("founded_year")
        )
        enriched.append(brief)

    return {"universities": enriched, "total": result.count or 0, "page": page, "per_page": per_page}


@router.get("/{slug}/listings")
async def get_university_listings(
    slug: str,
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1, le=50),
):
    try:
        uni_result = (
            supabase_admin.table("universities").select("id").eq("slug", slug).single().execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="University not found")

    if not uni_result.data:
        raise HTTPException(status_code=404, detail="University not found")

    university_id = uni_result.data["id"]
    offset = (page - 1) * per_page
    from app.listings.router import _build_listing_brief

    try:
        result = (
            supabase_admin.table("listings")
            .select("*, neighborhoods(name)", count="exact")
            .eq("university_id", university_id)
            .eq("status", "active")
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .range(offset, offset + per_page - 1)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")

    return {
        "listings": [_build_listing_brief(l) for l in (result.data or [])],
        "total": result.count or 0,
        "page": page,
        "per_page": per_page,
    }


@router.get("/{slug}")
async def get_university(slug: str):
    try:
        result = (
            supabase_admin.table("universities").select("*").eq("slug", slug).single().execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="University not found")

    if not result.data:
        raise HTTPException(status_code=404, detail="University not found")

    uni = result.data
    from app.listings.router import _build_listing_brief

    try:
        listings_result = (
            supabase_admin.table("listings")
            .select("*, neighborhoods(name)")
            .eq("university_id", uni["id"])
            .eq("status", "active")
            .is_("deleted_at", "null")
            .order("created_at", desc=True)
            .limit(20)
            .execute()
        )
        uni_listings = listings_result.data or []
    except Exception:
        uni_listings = []

    listings_count = len(uni_listings)
    trust_score = _compute_trust_score(
        bool(uni.get("verified", False)),
        listings_count,
        uni.get("student_count"),
        uni.get("founded_year"),
    )

    return {
        "id": uni["id"],
        "slug": uni["slug"],
        "name": uni["name"],
        "subtitle": (uni.get("description") or "")[:100] or None,
        "description": uni.get("description"),
        "logo_url": uni.get("logo_url"),
        "banner_url": uni.get("banner_url"),
        "verified": bool(uni.get("verified", False)),
        "listings_count": listings_count,
        "city": uni.get("city"),
        "type": uni.get("type"),
        "student_count": uni.get("student_count"),
        "accreditation": uni.get("accreditation"),
        "founded_year": uni.get("founded_year"),
        "website": uni.get("website"),
        "phone": uni.get("phone"),
        "email": uni.get("email"),
        "trust_score": trust_score,
        "created_at": uni.get("created_at"),
        "listings": [_build_listing_brief(l) for l in uni_listings],
    }
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/universities/
git commit -m "feat(backend): add universities module with public API endpoints"
```

---

## Task 3: Register router + admin CRUD

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/app/admin/router.py`

- [ ] **Step 1: Register router in `main.py`**

After line 20 (`from app.leads.router import router as leads_router`), add:
```python
from app.universities.router import router as universities_router
```

After line 81 (`app.include_router(leads_router, prefix="/api", tags=["leads"])`), add:
```python
app.include_router(universities_router, prefix="/api/universities", tags=["universities"])
```

- [ ] **Step 2: Add admin CRUD to `backend/app/admin/router.py`**

Append after the `admin_delete_agency` function (after line 700):

```python
# ─── Universities ──────────────────────────────────────────────────────────────

@router.get("/universities")
async def admin_list_universities(
    search: str | None = Query(None),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    _admin: str = Depends(get_admin),
):
    """List all universities (admin)."""
    offset = (page - 1) * per_page
    query = supabase_admin.table("universities").select("*", count="exact")
    if search:
        query = query.ilike("name", f"%{search}%")
    try:
        result = query.order("created_at", desc=True).range(offset, offset + per_page - 1).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {e}")
    return _paged(result.data or [], result.count or 0, page, per_page)


@router.post("/universities", status_code=201)
async def admin_create_university(
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-create a university."""
    import re
    if not body.get("slug") and body.get("name"):
        body["slug"] = re.sub(r"[^a-z0-9]+", "-", body["name"].lower()).strip("-")
    _UNIVERSITY_FIELDS = {
        "owner_id", "name", "slug", "description", "logo_url", "banner_url",
        "website", "phone", "email", "city", "verified", "founded_year",
        "type", "student_count", "accreditation",
    }
    body = {k: v for k, v in body.items() if k in _UNIVERSITY_FIELDS}
    try:
        result = supabase_admin.table("universities").insert(body).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create university: {e}")
    return result.data[0]


@router.put("/universities/{university_id}")
async def admin_update_university(
    university_id: str,
    body: dict = Body(...),
    _admin: str = Depends(get_admin),
):
    """Admin-update a university."""
    body.pop("id", None)
    _UNIVERSITY_FIELDS = {
        "name", "slug", "description", "logo_url", "banner_url",
        "website", "phone", "email", "city", "verified", "founded_year",
        "type", "student_count", "accreditation",
    }
    body = {k: v for k, v in body.items() if k in _UNIVERSITY_FIELDS}
    if not body:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    try:
        result = (
            supabase_admin.table("universities")
            .update(body)
            .eq("id", university_id)
            .execute()
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update university: {e}")
    if not result.data:
        raise HTTPException(status_code=404, detail="University not found")
    return result.data[0]


@router.delete("/universities/{university_id}")
async def admin_delete_university(
    university_id: str,
    _admin: str = Depends(get_admin),
):
    """Delete a university."""
    try:
        supabase_admin.table("universities").delete().eq("id", university_id).execute()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete university: {e}")
    return {"message": "University deleted"}
```

- [ ] **Step 3: Fix `admin_create_listing` for university_id**

In `admin_create_listing` (around line 264), find:
```python
    for optional_uuid in ("agency_id", "project_id", "neighborhood_id"):
```
Change to:
```python
    for optional_uuid in ("agency_id", "project_id", "neighborhood_id", "university_id"):
```

- [ ] **Step 4: Verify backend starts**

```bash
cd backend && uvicorn app.main:app --reload
```
Expected: no import errors, server starts on port 8000.

- [ ] **Step 5: Commit**

```bash
git add backend/app/main.py backend/app/admin/router.py
git commit -m "feat(backend): register universities router and add admin CRUD"
```

---

## Task 4: Frontend types

**Files:**
- Modify: `frontend/src/types/api.ts`
- Modify: `frontend/src/types/index.ts`
- Modify: `frontend/src/lib/constants.ts`

- [ ] **Step 1: Add `ApiUniversity` to `frontend/src/types/api.ts`**

Append at the end of the file:

```typescript
// ── Universities ──

export interface ApiUniversity {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  logo_url: string | null;
  banner_url: string | null;
  verified: boolean;
  listings_count: number;
  city: string | null;
  type: "public" | "private" | null;
  student_count: number | null;
  accreditation: string | null;
  founded_year: number | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  description: string | null;
  trust_score: number;
  created_at: string | null;
  listings?: ListingBrief[];
}

export interface PaginatedUniversities {
  universities: ApiUniversity[];
  total: number;
  page: number;
  per_page: number;
}
```

- [ ] **Step 2: Replace mock `University` with `UniversityDetail` in `frontend/src/types/index.ts`**

Find and replace the entire block (lines 170–178):
```typescript
export interface University {
  name: string;
  shortName: string;
  location: string;
  image: string;
  availability: "available" | "limited";
  details: { label: string; value: string }[];
  avgPrice: string;
}
```

Replace with:
```typescript
export interface UniversityDetail {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  banner_url: string | null;
  verified: boolean;
  listings_count: number;
  trust_score: number;
  city: string | null;
  type: "public" | "private" | null;
  student_count: number | null;
  accreditation: string | null;
  founded_year: number | null;
  website: string | null;
  phone: string | null;
  email: string | null;
  created_at: string | null;
}
```

- [ ] **Step 3: Clean up `frontend/src/lib/constants.ts`**

Remove the `University` import from the top of the file (find `University,` in the import from `"@/types"` and delete it).

Find and delete the entire `UNIVERSITIES` export block (approximately lines 527–570, starting with `export const UNIVERSITIES: University[] = [`).

- [ ] **Step 4: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```
Expected: only errors related to `UniversityCard` (which uses the old `University` type) — fixed in Task 6.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/api.ts frontend/src/types/index.ts frontend/src/lib/constants.ts
git commit -m "feat(types): add ApiUniversity and UniversityDetail, remove mock University"
```

---

## Task 5: Frontend supabase queries

**Files:**
- Modify: `frontend/src/lib/supabase-queries.ts`

- [ ] **Step 1: Add import at top of supabase-queries.ts**

Find the existing type imports at the top of the file. Add `ApiUniversity` and `UniversityDetail` to the import from `"@/types/api"` and `"@/types"` respectively:

After the existing imports, add:
```typescript
import type { ApiUniversity } from "@/types/api";
import type { UniversityDetail } from "@/types";
```

- [ ] **Step 2: Add `getUniversities` function**

Append to the end of `frontend/src/lib/supabase-queries.ts`:

```typescript
// ── Universities ──────────────────────────────────────────────────────────────

export async function getUniversities(search?: string, limit = 12) {
  let query = supabase
    .from("universities")
    .select(
      "id, slug, name, logo_url, banner_url, verified, city, type, student_count, accreditation, founded_year, description"
    )
    .order("name", { ascending: true })
    .limit(limit);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const universities: ApiUniversity[] = ((data ?? []) as any[]).map((u) => ({
    id: u.id,
    slug: u.slug,
    name: u.name,
    subtitle: u.description ? String(u.description).slice(0, 100) : null,
    logo_url: u.logo_url ?? null,
    banner_url: u.banner_url ?? null,
    verified: u.verified ?? false,
    listings_count: 0,
    city: u.city ?? null,
    type: u.type ?? null,
    student_count: u.student_count ?? null,
    accreditation: u.accreditation ?? null,
    founded_year: u.founded_year ?? null,
    website: null,
    phone: null,
    email: null,
    description: u.description ?? null,
    trust_score: 0,
    created_at: null,
  }));
  return { universities, error };
}

export async function getUniversity(slug: string): Promise<{
  university: UniversityDetail | null;
  listings: Record<string, unknown>[];
  error: unknown;
}> {
  const { data: uni, error } = await supabase
    .from("universities")
    .select(
      "id, slug, name, description, logo_url, banner_url, verified, created_at, phone, email, city, website, founded_year, type, student_count, accreditation"
    )
    .eq("slug", slug)
    .single();

  if (error || !uni) return { university: null, listings: [], error };

  const listingsRes = await supabase
    .from("listings")
    .select("id, title, location, price, price_period, images, bedrooms, size_sqm, status")
    .eq("university_id", uni.id)
    .eq("status", "active")
    .is("deleted_at", null)
    .limit(6);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const uniAny = uni as any;
  const listingCount = listingsRes.data?.length ?? 0;
  const isVerified = uni.verified ?? false;
  const studentCount = (uniAny.student_count as number | null) ?? null;
  const foundedYear = (uniAny.founded_year as number | null) ?? null;

  const pts =
    (isVerified ? 40 : 0) +
    Math.min(listingCount * 2, 30) +
    (studentCount ? Math.min(Math.floor(studentCount / 1000), 20) : 0) +
    (foundedYear
      ? Math.min(Math.floor((new Date().getFullYear() - foundedYear) / 5), 10)
      : 0);
  const trustScore = Math.min(pts, 100);

  const university: UniversityDetail = {
    id: uni.id,
    slug: uni.slug,
    name: uni.name,
    description: uni.description ?? null,
    logo_url: uni.logo_url ?? null,
    banner_url: uni.banner_url ?? null,
    verified: isVerified,
    listings_count: listingCount,
    trust_score: trustScore,
    city: uni.city ?? null,
    type: (uniAny.type as "public" | "private" | null) ?? null,
    student_count: studentCount,
    accreditation: (uniAny.accreditation as string | null) ?? null,
    founded_year: foundedYear,
    website: uni.website ?? null,
    phone: uni.phone ?? null,
    email: uni.email ?? null,
    created_at: uni.created_at ?? null,
  };

  return {
    university,
    listings: (listingsRes.data ?? []) as Record<string, unknown>[],
    error: listingsRes.error,
  };
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/supabase-queries.ts
git commit -m "feat(queries): add getUniversities and getUniversity supabase queries"
```

---

## Task 6: Wire UniversitiesSection + UniversityCard

**Files:**
- Modify: `frontend/src/components/agencies/UniversityCard.tsx`
- Modify: `frontend/src/components/agencies/UniversitiesSection.tsx`

- [ ] **Step 1: Rewrite `UniversityCard.tsx`**

Replace the entire file:

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { MapPin, GraduationCap, Users } from "lucide-react";
import type { ApiUniversity } from "@/types/api";

interface UniversityCardProps {
  university: ApiUniversity;
  index: number;
}

export default function UniversityCard({ university, index }: UniversityCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      className="bg-card-dark rounded-2xl overflow-hidden border border-white/5 hover:border-primary/30 transition-all duration-300 shadow-lg hover:shadow-xl hover:shadow-primary/5 group"
    >
      {/* Header */}
      <div className="h-32 bg-gray-800 relative">
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />
        {university.banner_url ? (
          <Image
            src={university.banner_url}
            alt={`${university.name} campus`}
            fill
            className="object-cover mix-blend-overlay opacity-60"
            sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent" />
        )}
        <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end z-20">
          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center shadow-lg overflow-hidden flex-shrink-0">
            {university.logo_url ? (
              <Image
                src={university.logo_url}
                alt={university.name}
                width={48}
                height={48}
                className="object-contain"
                unoptimized
              />
            ) : (
              <GraduationCap className="h-6 w-6 text-primary" />
            )}
          </div>
          {university.type && (
            <div className="bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded backdrop-blur-md border border-primary/20 capitalize">
              {university.type}
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-5">
        <h3 className="text-lg font-bold text-white mb-1 group-hover:text-primary transition-colors line-clamp-1">
          {university.name}
        </h3>
        {university.city && (
          <div className="flex items-center gap-1 text-gray-400 text-xs mb-4">
            <MapPin className="h-3.5 w-3.5" /> {university.city}
          </div>
        )}

        <div className="space-y-2 mb-6">
          {university.student_count != null && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1">
                <Users className="h-3 w-3" /> Students
              </span>
              <span className="text-white">{university.student_count.toLocaleString()}</span>
            </div>
          )}
          {university.accreditation && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Accreditation</span>
              <span className="text-white text-xs truncate max-w-[120px]">{university.accreditation}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Active Listings</span>
            <span className="text-primary font-semibold">{university.listings_count}</span>
          </div>
        </div>

        <Link
          href={`/universities/${university.slug}`}
          className="block w-full py-2.5 border border-primary text-primary hover:bg-primary hover:text-white font-semibold rounded-lg transition-colors text-sm text-center"
        >
          View Student Housing
        </Link>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Rewrite `UniversitiesSection.tsx`**

Replace the entire file:

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { GraduationCap, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getUniversities } from "@/lib/supabase-queries";
import UniversityCard from "./UniversityCard";

export default function UniversitiesSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["universities", "preview"],
    queryFn: () => getUniversities(undefined, 4),
  });

  const universities = data?.universities ?? [];

  return (
    <section className="py-16 bg-[#161616] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-10">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
              <GraduationCap className="h-6 w-6 text-primary" /> Partner Universities
            </h2>
            <p className="text-gray-400 text-sm">
              Discover verified student housing and campus-adjacent rentals.
            </p>
          </div>
          <Link
            href="/universities"
            className="text-sm text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : universities.length === 0 ? (
          <p className="text-gray-500 text-sm">No partner universities yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {universities.map((university, i) => (
              <UniversityCard key={university.id} university={university} index={i} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i university
```
Expected: no university-related errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/agencies/UniversityCard.tsx frontend/src/components/agencies/UniversitiesSection.tsx
git commit -m "feat(frontend): wire UniversitiesSection and UniversityCard to real API"
```

---

## Task 7: Admin sidebar + EntityPicker

**Files:**
- Modify: `frontend/src/components/admin/AdminSidebar.tsx`
- Modify: `frontend/src/components/admin/EntityPicker.tsx`

- [ ] **Step 1: Add GraduationCap to AdminSidebar imports**

In `AdminSidebar.tsx`, find the lucide imports block and add `GraduationCap`:
```typescript
import {
  LayoutDashboard,
  Users,
  Building2,
  FolderOpen,
  Home,
  FileText,
  ArrowLeftRight,
  Bell,
  AlertTriangle,
  Clock,
  LogOut,
  ShieldCheck,
  PhoneCall,
  GraduationCap,
} from "lucide-react";
```

- [ ] **Step 2: Add Universities nav item**

In `NAV_GROUPS`, find the `"Business"` group:
```typescript
{
  label: "Business",
  items: [
    { id: "agencies", label: "Agencies", icon: Building2 },
    { id: "bookings", label: "Bookings", icon: ArrowLeftRight },
    { id: "leads", label: "Leads", icon: PhoneCall },
  ],
},
```

Replace with:
```typescript
{
  label: "Business",
  items: [
    { id: "agencies", label: "Agencies", icon: Building2 },
    { id: "universities", label: "Universities", icon: GraduationCap },
    { id: "bookings", label: "Bookings", icon: ArrowLeftRight },
    { id: "leads", label: "Leads", icon: PhoneCall },
  ],
},
```

- [ ] **Step 3: Update EntityPicker section type**

In `EntityPicker.tsx`, find:
```typescript
  section: "users" | "agencies" | "projects";
```
Replace with:
```typescript
  section: "users" | "agencies" | "projects" | "universities";
```

Also update the search input placeholder — `universities` already returns `name` field so `getLabel` handles it correctly (the `else` branch returns `item.name`).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/admin/AdminSidebar.tsx frontend/src/components/admin/EntityPicker.tsx
git commit -m "feat(admin): add Universities sidebar nav and EntityPicker section"
```

---

## Task 8: Admin dashboard — universities SECTIONS + listing pickers

**Files:**
- Modify: `frontend/src/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Add `universities` to SECTIONS config**

In `dashboard/page.tsx`, find the `SECTIONS` object. After the `agencies` section (after line 328, the closing `},` of the agencies entry), add:

```typescript
  universities: {
    title: "Universities",
    apiSection: "universities",
    searchPlaceholder: "Search by name…",
    canCreate: true,
    columns: [
      { key: "name", label: "Name" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      {
        key: "type", label: "Type",
        render: (v) => v ? <Badge color={v === "public" ? "blue" : "purple"}>{String(v)}</Badge> : <span className="text-zinc-400">—</span>,
      },
      {
        key: "verified", label: "Verified",
        render: (v) => <Badge color={v ? "green" : "gray"}>{v ? "Verified" : "Unverified"}</Badge>,
      },
      { key: "created_at", label: "Created", render: (v) => formatDate(v) },
    ],
    editFields: [
      { key: "name", label: "Name", required: true },
      { key: "slug", label: "Slug" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "logo_url", label: "Logo Image URL", type: "image_url" },
      { key: "banner_url", label: "Banner Image URL", type: "image_url" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      { key: "website", label: "Website" },
      { key: "founded_year", label: "Founded Year", type: "number", helper: "e.g. 1989" },
      { key: "type", label: "Type", type: "select", options: ["public", "private"] },
      { key: "student_count", label: "Student Count", type: "number" },
      { key: "accreditation", label: "Accreditation", helper: "e.g. AACSB, QS Ranked" },
      { key: "verified", label: "Verified", type: "select", options: ["true", "false"] },
    ],
    createFields: [
      { key: "name", label: "Name", required: true },
      { key: "owner_id", label: "Owner", type: "picker", pickerSection: "users", required: true },
      { key: "slug", label: "Slug (leave blank to auto-generate)" },
      { key: "description", label: "Description", type: "textarea" },
      { key: "logo_url", label: "Logo Image URL", type: "image_url" },
      { key: "banner_url", label: "Banner Image URL", type: "image_url" },
      { key: "phone", label: "Phone" },
      { key: "email", label: "Email" },
      { key: "city", label: "City" },
      { key: "website", label: "Website" },
      { key: "founded_year", label: "Founded Year", type: "number", helper: "e.g. 1989" },
      { key: "type", label: "Type", type: "select", options: ["public", "private"] },
      { key: "student_count", label: "Student Count", type: "number" },
      { key: "accreditation", label: "Accreditation", helper: "e.g. AACSB, QS Ranked" },
      { key: "verified", label: "Verified", type: "select", options: ["true", "false"] },
    ],
  },
```

- [ ] **Step 2: Update `FieldDef` pickerSection type**

In `dashboard/page.tsx`, find:
```typescript
  pickerSection?: "users" | "agencies" | "projects";
```
Replace with:
```typescript
  pickerSection?: "users" | "agencies" | "projects" | "universities";
```

- [ ] **Step 3: Add university_id to listings generic createFields**

In the `listings` section `createFields` array, after the `agency_id` and `project_id` picker entries (around line 247), add:
```typescript
      { key: "university_id", label: "University (optional)", type: "picker", pickerSection: "universities" },
```

- [ ] **Step 4: Add university_id to AdminListingEditForm state**

In `AdminListingEditForm`, find the `useState` initializer:
```typescript
  const initialAgency = initial.agencies as Record<string, unknown> | null | undefined;
  const initialProject = initial.projects as Record<string, unknown> | null | undefined;
  const [form, setForm] = useState<Record<string, unknown>>({
    ...initial,
    ...
    agency_id_label: asText(initialAgency?.name),
    project_id_label: asText(initialProject?.title),
  });
```

Add `university_id_label: ""` to the initial state object (after `project_id_label`):
```typescript
    university_id_label: "",
```

- [ ] **Step 5: Add university picker to AdminListingEditForm JSX**

In `AdminListingEditForm`, find the section with Agency and Project pickers (around line 1270):
```tsx
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <FieldShell label="Status">
          ...
        </FieldShell>
        <FieldShell label="Agency">
          <EntityPicker ... section="agencies" ... />
        </FieldShell>
        <FieldShell label="Project">
          <EntityPicker ... section="projects" ... />
        </FieldShell>
      </section>
```

Change the grid to `md:grid-cols-4` and add a University picker after Project:
```tsx
      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <FieldShell label="Status">
          <select value={asText(form.status)} onChange={(e) => setField("status", e.target.value)} className={inputClass}>
            {["active", "pending", "rejected", "sold", "rented"].map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </FieldShell>
        <FieldShell label="Agency">
          <EntityPicker
            value={asText(form.agency_id)}
            displayValue={asText(form.agency_id_label)}
            section="agencies"
            placeholder="Search agencies..."
            onChange={(id, label) => {
              setField("agency_id", id);
              setForm((prev) => ({ ...prev, agency_id_label: label, project_id: "", project_id_label: "" }));
            }}
          />
        </FieldShell>
        <FieldShell label="Project">
          <EntityPicker
            value={asText(form.project_id)}
            displayValue={asText(form.project_id_label)}
            section="projects"
            placeholder={form.agency_id ? "Search projects..." : "Choose agency first"}
            disabled={!form.agency_id}
            extraParams={form.agency_id ? { agency_id: asText(form.agency_id) } : undefined}
            onChange={(id, label) => {
              setField("project_id", id);
              setForm((prev) => ({ ...prev, project_id_label: label }));
            }}
          />
        </FieldShell>
        <FieldShell label="University">
          <EntityPicker
            value={asText(form.university_id)}
            displayValue={asText(form.university_id_label)}
            section="universities"
            placeholder="Search universities..."
            onChange={(id, label) => {
              setField("university_id", id);
              setForm((prev) => ({ ...prev, university_id_label: label }));
            }}
          />
        </FieldShell>
      </section>
```

- [ ] **Step 6: Add university_id to AdminListingEditForm submit**

In the `submit` function's `onSave({...})` call, add after `project_id`:
```typescript
      university_id: asText(form.university_id) || null,
```

- [ ] **Step 7: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: zero errors.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/app/admin/dashboard/page.tsx
git commit -m "feat(admin): add universities section and university picker to listing forms"
```

---

## Task 9: Universities list page

**Files:**
- Create: `frontend/src/app/universities/page.tsx`

- [ ] **Step 1: Create the page**

```tsx
"use client";

import { useQuery } from "@tanstack/react-query";
import { GraduationCap } from "lucide-react";
import { getUniversities } from "@/lib/supabase-queries";
import UniversityCard from "@/components/agencies/UniversityCard";

export default function UniversitiesPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["universities"],
    queryFn: () => getUniversities(),
  });

  const universities = data?.universities ?? [];

  return (
    <div className="min-h-screen bg-background-dark">
      <section className="py-20 bg-gradient-to-b from-black to-background-dark text-center px-4">
        <div className="flex items-center justify-center gap-3 mb-4">
          <GraduationCap className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold text-white">Partner Universities</h1>
        </div>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          Verified student housing and campus-adjacent rentals from Egypt&apos;s top universities.
        </p>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-64 bg-white/5 rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : universities.length === 0 ? (
          <div className="text-center py-20">
            <GraduationCap className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">No partner universities yet.</p>
            <p className="text-gray-600 text-sm mt-2">Check back soon.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {universities.map((university, i) => (
              <UniversityCard key={university.id} university={university} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/universities/
git commit -m "feat(frontend): add universities list page"
```

---

## Task 10: University detail page

**Files:**
- Create: `frontend/src/components/universities/UniversityHero.tsx`
- Create: `frontend/src/components/universities/UniversitySidebar.tsx`
- Create: `frontend/src/app/universities/[slug]/page.tsx`

- [ ] **Step 1: Create `UniversityHero.tsx`**

```tsx
"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { GraduationCap, ShieldCheck } from "lucide-react";
import type { UniversityDetail } from "@/types";

interface Props {
  university: UniversityDetail;
}

export default function UniversityHero({ university }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="relative w-full h-[50vh] overflow-hidden"
    >
      {university.banner_url ? (
        <Image
          src={university.banner_url}
          alt={`${university.name} Banner`}
          fill
          className="object-cover"
          priority
          sizes="100vw"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-background-dark via-card-dark to-black" />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background-dark/40 to-background-dark/95 pointer-events-none" />

      <div className="absolute bottom-0 left-0 w-full p-8 md:p-12 z-10">
        <div className="max-w-[1600px] mx-auto">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-primary/90 text-white text-xs px-3 py-1 rounded-full uppercase tracking-wider font-semibold">
                {university.type === "public"
                  ? "Public University"
                  : university.type === "private"
                  ? "Private University"
                  : "Partner University"}
              </span>
              {university.verified && (
                <span className="flex items-center gap-1 bg-emerald-500/20 text-emerald-400 text-xs px-3 py-1 rounded-full font-semibold border border-emerald-500/20">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg overflow-hidden">
                {university.logo_url ? (
                  <Image
                    src={university.logo_url}
                    alt={university.name}
                    width={64}
                    height={64}
                    className="object-contain"
                    unoptimized
                  />
                ) : (
                  <GraduationCap className="h-8 w-8 text-primary" />
                )}
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-white">{university.name}</h1>
                {university.city && (
                  <p className="text-gray-400 mt-1">{university.city}, Egypt</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create `UniversitySidebar.tsx`**

```tsx
import { MapPin, GraduationCap, Globe, Phone, Mail, Users, BookOpen, Calendar } from "lucide-react";
import type { UniversityDetail } from "@/types";

interface Props {
  university: UniversityDetail;
}

export default function UniversitySidebar({ university }: Props) {
  return (
    <div className="space-y-6">
      <div className="bg-card-dark rounded-2xl p-6 border border-white/5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">Trust Score</p>
        <div className="flex items-end gap-2">
          <span className="text-5xl font-bold text-white">{university.trust_score}</span>
          <span className="text-gray-400 mb-1">/100</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${university.trust_score}%` }}
          />
        </div>
      </div>

      <div className="bg-card-dark rounded-2xl p-6 border border-white/5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Details</p>
        {university.city && (
          <div className="flex items-center gap-3 text-sm">
            <MapPin className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-gray-300">{university.city}, Egypt</span>
          </div>
        )}
        {university.type && (
          <div className="flex items-center gap-3 text-sm">
            <GraduationCap className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-gray-300 capitalize">{university.type} University</span>
          </div>
        )}
        {university.student_count != null && (
          <div className="flex items-center gap-3 text-sm">
            <Users className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-gray-300">{university.student_count.toLocaleString()} Students</span>
          </div>
        )}
        {university.accreditation && (
          <div className="flex items-center gap-3 text-sm">
            <BookOpen className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-gray-300">{university.accreditation}</span>
          </div>
        )}
        {university.founded_year && (
          <div className="flex items-center gap-3 text-sm">
            <Calendar className="h-4 w-4 text-primary flex-shrink-0" />
            <span className="text-gray-300">Est. {university.founded_year}</span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm pt-2 border-t border-white/5">
          <span className="text-gray-400">Active Listings</span>
          <span className="text-white font-semibold">{university.listings_count}</span>
        </div>
      </div>

      {(university.website || university.phone || university.email) && (
        <div className="bg-card-dark rounded-2xl p-6 border border-white/5 space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Contact</p>
          {university.website && (
            <a
              href={university.website}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 text-sm text-primary hover:underline"
            >
              <Globe className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">{university.website.replace(/^https?:\/\//, "")}</span>
            </a>
          )}
          {university.phone && (
            <div className="flex items-center gap-3 text-sm">
              <Phone className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-gray-300">{university.phone}</span>
            </div>
          )}
          {university.email && (
            <div className="flex items-center gap-3 text-sm">
              <Mail className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-gray-300">{university.email}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/app/universities/[slug]/page.tsx`**

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import UniversityHero from "@/components/universities/UniversityHero";
import UniversitySidebar from "@/components/universities/UniversitySidebar";
import TopListings from "@/components/agency-details/TopListings";
import { getUniversity } from "@/lib/supabase-queries";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { university } = await getUniversity(slug);
  if (!university) return { title: "University — Axiom" };
  return {
    title: `${university.name} — Axiom`,
    description:
      university.description ??
      `Explore student housing from ${university.name} on Axiom.`,
  };
}

export default async function UniversityDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const { university, listings } = await getUniversity(slug);

  if (!university) notFound();

  const topListings = listings.map((l) => {
    const images = (l.images as string[] | null) ?? [];
    return {
      id: l.id as string,
      title: l.title as string,
      location: l.location as string,
      image: images[0] ?? "",
      price: `EGP ${(l.price as number).toLocaleString()}`,
      priceLabel: `/${(l.price_period as string) ?? "mo"}`,
      beds: l.bedrooms != null ? `${l.bedrooms}` : "N/A",
      area: l.size_sqm ? `${l.size_sqm} m²` : "N/A",
      status: l.status as string,
      statusColor: "text-green-400" as const,
      progressPercent: 100,
      progressColor: "bg-primary" as const,
      progressLabel: "Active",
      completionLabel: "Active",
      cta: "View Listing",
    };
  });

  return (
    <div className="max-w-[1600px] mx-auto pb-20">
      <UniversityHero university={university} />
      <div className="px-4 sm:px-6 lg:px-8 mt-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="lg:w-[30%]">
            <UniversitySidebar university={university} />
          </div>
          <div className="lg:w-[70%] space-y-8">
            {university.description && (
              <div className="bg-card-dark rounded-2xl p-6 border border-white/5">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                  About
                </p>
                <p className="text-gray-300 leading-relaxed">{university.description}</p>
              </div>
            )}
            <TopListings
              listings={topListings}
              totalListings={university.listings_count}
              totalCities={university.city ? 1 : 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/universities/ frontend/src/app/universities/[slug]/
git commit -m "feat(frontend): add university detail page and components"
```

---

## Task 11: Final TypeScript check and integration commit

**Files:** All modified files.

- [ ] **Step 1: Full TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 2: If errors, fix them**

Common issues to watch for:
- `TopListings` prop type mismatch — check `frontend/src/components/agency-details/TopListings.tsx` for the exact props interface and align `topListings` mapping in the detail page.
- `UniversityDetail` missing field — align with `getUniversity` return shape.
- `ApiUniversity` `listings` field uses `ListingBrief` — ensure `ListingBrief` is imported/used correctly in `api.ts`.

- [ ] **Step 3: Update ROADMAP.md**

In `docs/ROADMAP.md`, add "Partner Universities" to the completed features list.

- [ ] **Step 4: Final commit**

```bash
git add docs/ROADMAP.md
git commit -m "feat: complete partner universities — DB, backend API, admin CRUD, public pages"
```
