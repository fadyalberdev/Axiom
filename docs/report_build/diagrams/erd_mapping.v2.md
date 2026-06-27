# 4.4.2 Mapping of Entity Relationship Diagram

| Entity | Primary key | Foreign keys | Important attributes | Implementation source |
|---|---|---|---|---|
| `profiles` | `id` | `id -> auth.users.id` | `email`, `full_name`, `phone`, `role`, `is_verified_seller`, `gender`, `lifestyle_preferences`, `stripe_account_id` | `docs/schema/001_v2_comprehensive_schema.sql`, `backend/app/auth`, admin user verification |
| `neighborhoods` | `id` | None | `name`, `name_ar`, `city`, `slug` | Lookup table used by listing filters and recommendations |
| `agencies` | `id` | `owner_id -> profiles.id` | `name`, `slug`, `logo_url`, `phone`, `email`, `verified` | Agency pages, admin agency CRUD, lead routing |
| `projects` | `id` | `agency_id -> agencies.id` | `title`, `slug`, `starting_price`, `completion_pct`, `status`, `key_features` | Projects route and admin project CRUD |
| `listings` | `id` | `owner_id -> profiles.id`, `agency_id -> agencies.id`, `project_id -> projects.id`, `neighborhood_id -> neighborhoods.id` | `title`, `category`, `property_type`, `price`, `city`, `images`, `amenities`, `status`, `fraud_score`, `embedding`, `paused_at`, `deleted_at` | `backend/app/listings/router.py`, `backend/app/admin/router.py`, `backend/app/subscriptions/lapse.py` |
| `housemates` | `id` | `listing_id -> listings.id`, `user_id -> profiles.id` | `name`, `age`, `occupation`, `avatar_url`, `tags` | Shared-housing listing detail |
| `listing_applications` | `id` | `listing_id -> listings.id`, `applicant_id -> profiles.id` | `lifestyle_data`, `compatibility_score`, `compatibility_reasons`, `status`, `message` | Shared-housing apply flow and AI compatibility |
| `favorites` | `(user_id, listing_id)` | `user_id -> profiles.id`, `listing_id -> listings.id` | `created_at` | `toggle_favorite` RPC and listing favorites endpoints |
| `leads` | `id` | `user_id -> profiles.id`, `listing_id -> listings.id`, `agency_id -> agencies.id` | `contact_name`, `contact_phone`, `source`, `is_billable` | WhatsApp enquiry flow in `backend/app/leads/router.py` |
| `viewings` | `id` | `listing_id -> listings.id`, `requester_id -> profiles.id`, `owner_id -> profiles.id` | `scheduled_at`, `status`, `notes` | Viewing request and owner confirmation flow |
| `bookings` | `id` | `listing_id -> listings.id`, `renter_id -> profiles.id`, `owner_id -> profiles.id` | `booking_type`, `start_date`, `end_date`, `total_price`, `status`, `stripe_payment_intent_id` | Stripe rent booking flow in `backend/app/bookings/router.py` |
| `payments` | `id` | `user_id -> profiles.id`, `listing_id -> listings.id`, `booking_id -> bookings.id` | `kind`, `amount`, `currency`, `stripe_payment_intent_id`, `status`, `refunded_at` | Payment ledger for booking deposits and subscriptions |
| `booking_disbursements` | `id` | `booking_id -> bookings.id` | `month_number`, `amount`, `scheduled_date`, `status` | Booking payout schedule table retained by migration |
| `subscriptions` | `id` | `user_id -> profiles.id` | `plan`, `status`, `stripe_customer_id`, `stripe_subscription_id`, `trial_used`, `ai_descriptions_used` | Subscription plan enforcement and Stripe webhooks |
| `conversations` | `id` | `user_a_id -> profiles.id`, `user_b_id -> profiles.id`, `listing_id -> listings.id`, `initiated_by -> profiles.id` | `status`, `last_message_at`, per-user soft-delete timestamps | Legacy realtime messaging schema |
| `messages` | `id` | `conversation_id -> conversations.id`, `sender_id -> profiles.id` | `text`, `attachment_url`, `created_at` | Legacy realtime messaging schema |
| `blocked_users` | `id` | `blocker_id -> profiles.id`, `blocked_id -> profiles.id` | `reason`, `created_at` | Conversation blocking migration |
| `notifications` | `id` | `user_id -> profiles.id` | `type`, `title`, `body`, `metadata`, `is_read` | Listing approval, rejection, viewing, and application notifications |
| `blog_posts` | `id` | `author_id -> profiles.id` | `title`, `slug`, `category`, `content`, `tags`, `is_published` | Blog API and admin blog CRUD |
| `knowledge_chunks` | `id` | Polymorphic `source_type` and `source_id` | `chunk_text`, `embedding`, `metadata` | RAG search for AI chatbot and semantic listing support |

The central relationship is `profiles -> listings` through `owner_id`. AXIOM V2 intentionally avoids `broker_id`, `broker` role, and `seeker` role; agency, verification, subscription, booking, and lead behavior all attach to the unified `profiles` user model.
