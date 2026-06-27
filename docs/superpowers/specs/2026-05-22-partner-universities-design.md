# Partner Universities — Design Spec
Date: 2026-05-22

## Overview

Add a Partner Universities system to AXIOM that mirrors the agencies system in structure but is kept in its own separate space. Admins can create universities, assign listings to them, and users can browse university detail pages. No projects section.

---

## 1. Database

### New table: `universities`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | auto |
| `name` | text NOT NULL | |
| `slug` | text UNIQUE NOT NULL | URL-safe identifier |
| `description` | text | |
| `logo_url` | text | |
| `banner_url` | text | |
| `website` | text | |
| `phone` | text | |
| `email` | text | |
| `city` | text | |
| `verified` | boolean DEFAULT false | admin-granted |
| `founded_year` | integer | |
| `type` | text | `'public'` or `'private'` |
| `student_count` | integer | |
| `accreditation` | text | e.g. "AACSB, QS Ranked" |
| `owner_id` | uuid REFERENCES auth.users | admin-assigned |
| `created_at` | timestamptz DEFAULT now() | |

### Modified table: `listings`

Add column: `university_id uuid REFERENCES universities(id) NULL`

A listing may have `agency_id`, `university_id`, both null, or one set — these are optional, independent associations.

---

## 2. Backend

### New module: `backend/app/universities/`

**`schemas.py`**
- `CreateUniversityRequest`: name, slug (optional, auto-generated if blank), description, logo_url, banner_url, website, phone, email, city, founded_year, type, student_count, accreditation
- `UpdateUniversityRequest`: all fields optional

**`router.py`** — registered at `/api/universities`

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/universities` | public | Paginated list, filter by `city` |
| GET | `/api/universities/{slug}` | public | Detail + active listings (limit 20) |
| GET | `/api/universities/{slug}/listings` | public | Paginated listings for this university |
| POST | `/api/universities` | admin JWT | Create university |
| PUT | `/api/universities/{university_id}` | admin JWT | Update university |
| DELETE | `/api/universities/{university_id}` | admin JWT | Delete university |

**Trust score** — computed from:
- `verified` status (base 40 pts)
- Active listings count (up to 30 pts)
- `student_count` as proxy for institution size (up to 20 pts)
- `founded_year` age (up to 10 pts)

**`GET /api/universities` response shape:**
```json
{
  "universities": [
    {
      "id": "uuid",
      "slug": "auc",
      "name": "American University in Cairo",
      "subtitle": "...",
      "logo_url": "...",
      "verified": true,
      "listings_count": 12,
      "city": "Cairo",
      "type": "private",
      "student_count": 6000,
      "accreditation": "AACSB"
    }
  ],
  "total": 10,
  "page": 1,
  "per_page": 12
}
```

**`GET /api/universities/{slug}` response shape** — adds: `description`, `banner_url`, `trust_score`, `founded_year`, `website`, `phone`, `email`, `listings` array.

### Admin router (`backend/app/admin/router.py`)

Add `universities` to the generic CRUD dispatcher — same pattern as `agencies`. Supports list, create, update, delete via admin JWT. EntityPicker search uses the same search endpoint pattern.

---

## 3. Admin Dashboard

### Sidebar (`AdminSidebar.tsx`)

Add "Universities" nav item between Agencies and Bookings:
- Icon: `GraduationCap` (lucide)
- ID: `"universities"`

### SECTIONS config (`admin/dashboard/page.tsx`)

New `universities` entry:

**Columns:** name, email, city, type (badge), verified (badge), created_at

**Create fields:**
- name (required)
- owner_id (picker: users, required)
- slug (optional, auto-generated)
- description (textarea)
- logo_url (image_url)
- banner_url (image_url)
- phone, email, city, website
- founded_year (number)
- type (select: public | private)
- student_count (number)
- accreditation (text)
- verified (select: true | false)

**Edit fields:** same minus `owner_id`

### Listing create/edit forms

Add `university_id` picker field (section: `"universities"`) alongside existing `agency_id` picker. Both optional. Label: "University (optional)".

- In `AdminListingEditForm`: new `FieldShell` for university picker, same row as Agency/Project pickers
- In generic `createFields` for listings section: add `university_id` picker entry

### EntityPicker

Add `"universities"` as valid section — backend search endpoint: `GET /api/admin/universities?search={q}`.

---

## 4. Frontend Public Pages

### New page: `/universities/page.tsx`

- Hero section (reuse AgenciesHero style, change copy)
- Grid of `UniversityCard` components
- Fetches `GET /api/universities`
- "No universities" empty state

### New page: `/universities/[slug]/page.tsx`

Layout mirrors `/agencies/[slug]`:
- Banner image header
- Logo + name + verified badge + trust score
- Sidebar: city, type, student_count, accreditation, founded_year, website, phone, email
- Active listings grid (same `ListingCard` components)
- **No projects section**

### Wire `UniversitiesSection` (on `/agencies` page)

- Replace `UNIVERSITIES` constant import with `GET /api/universities?per_page=4` query
- "View All" button → `/universities`
- Card links → `/universities/{slug}`

### Updated `UniversityCard`

- Accept real `ApiUniversity` shape instead of mock `University` type
- Show: logo, name, city, type badge, student_count, accreditation, listings_count

### Types

**`types/api.ts`** — add:
```typescript
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
  listings?: ApiListingBrief[];
  created_at: string;
}
```

**`types/index.ts`** — replace mock `University` with UI shape derived from `ApiUniversity`.

---

## 5. Out of Scope

- Projects for universities (explicitly excluded)
- Subscription plans / quotas for universities
- User-created universities (admin only)
- University-affiliated user accounts
