-- Remove retired in-app shared-housing application, housemate, and notification surfaces.
-- Shared housing occupancy is now tracked directly on listings via total_spots/filled_spots.

drop table if exists public.listing_applications cascade;
drop table if exists public.housemates cascade;
drop table if exists public.notifications cascade;

alter table public.listings
  drop constraint if exists listings_shared_housing_spots_valid;

alter table public.listings
  add constraint listings_shared_housing_spots_valid
  check (
    category <> 'shared_housing'
    or (
      coalesce(filled_spots, 0) >= 0
      and (total_spots is null or total_spots >= 0)
      and (total_spots is null or coalesce(filled_spots, 0) <= total_spots)
    )
  );
