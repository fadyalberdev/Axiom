# AXIOM Report Corrections from Early Report

The old early-stage report was treated as historical structure only. The following corrections were applied:

1. The project title is AXIOM, not the early report title.
2. The current account model is `user | admin`; the technical chapters do not model separate browsing and seller roles.
3. Listing ownership uses `owner_id`.
4. Shared housing is represented by `listings.category = shared_housing` with housemates and applications.
5. The stack is Next.js 16, FastAPI, Supabase PostgreSQL, pgvector, Ollama, and Stripe.
6. AI is implemented through seven public AI routes plus internal RAG, embedding, and fraud services.
7. Payments use a flat platform-retained booking fee for rent/shared housing; sale listings are lead-generation/contact-only.
8. WhatsApp leads, viewing requests, shared-housing applications, and bookings replace the early inquiry/contact flow.
9. The admin system includes approval/rejection, user verification, fraud review, agencies, universities, projects, blog, and booking visibility.
