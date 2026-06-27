#!/usr/bin/env python3
"""
AXIOM V2 Demo Data Generator
Extracts and transforms scraped data into SQL INSERT statements
for listings, agencies, and universities.
"""

import csv
import json
import uuid
import random
import re
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional

# Output files
OUTPUT_DIR = "demo_data_output"
LISTINGS_FILE = f"{OUTPUT_DIR}/listings_demo.json"
AGENCIES_FILE = f"{OUTPUT_DIR}/agencies_demo.json"
UNIVERSITIES_FILE = f"{OUTPUT_DIR}/universities_demo.json"
SQL_FILE = f"{OUTPUT_DIR}/insert_demo_data.sql"

# Fixed owner_id for demo data (you'll need to create this user in auth.users first)
DEMO_OWNER_ID = "00000000-0000-0000-0000-000000000001"

# Egyptian major universities data
EGYPTIAN_UNIVERSITIES = [
    {
        "name": "Cairo University",
        "slug": "cairo-university",
        "city": "Giza",
        "founded_year": 1908,
        "type": "public",
        "student_count": 250000,
        "accreditation": "Egyptian Ministry of Higher Education",
        "description": "Egypt's premier public university, located in Giza. One of the largest universities in Africa and the Middle East with a rich history of academic excellence.",
        "website": "https://cu.edu.eg",
        "verified": True
    },
    {
        "name": "Ain Shams University",
        "slug": "ain-shams-university",
        "city": "Cairo",
        "founded_year": 1950,
        "type": "public",
        "student_count": 180000,
        "accreditation": "Egyptian Ministry of Higher Education",
        "description": "One of Egypt's largest universities, located in Cairo. Known for its medical, engineering, and humanities faculties.",
        "website": "https://www.asu.edu.eg",
        "verified": True
    },
    {
        "name": "Alexandria University",
        "slug": "alexandria-university",
        "city": "Alexandria",
        "founded_year": 1938,
        "type": "public",
        "student_count": 150000,
        "accreditation": "Egyptian Ministry of Higher Education",
        "description": "A major public university in Alexandria, known for its coastal campus and strong programs in medicine, engineering, and marine sciences.",
        "website": "https://alexu.edu.eg",
        "verified": True
    },
    {
        "name": "The American University in Cairo",
        "slug": "auc",
        "city": "Cairo",
        "founded_year": 1919,
        "type": "private",
        "student_count": 7000,
        "accreditation": "Middle States Commission on Higher Education (USA)",
        "description": "Egypt's leading English-language university, offering American-style liberal arts education. Located in New Cairo with a historic downtown campus.",
        "website": "https://www.aucegypt.edu",
        "verified": True
    },
    {
        "name": "Mansoura University",
        "slug": "mansoura-university",
        "city": "Mansoura",
        "founded_year": 1972,
        "type": "public",
        "student_count": 120000,
        "accreditation": "Egyptian Ministry of Higher Education",
        "description": "A major public university in the Nile Delta, renowned for its medical school and Urology and Nephrology Center.",
        "website": "https://www.mans.edu.eg",
        "verified": True
    },
    {
        "name": "Assiut University",
        "slug": "assiut-university",
        "city": "Asyut",
        "founded_year": 1957,
        "type": "public",
        "student_count": 95000,
        "accreditation": "Egyptian Ministry of Higher Education",
        "description": "Upper Egypt's oldest university, serving as a major educational hub for southern Egypt with strong engineering and medical programs.",
        "website": "https://www.aun.edu.eg",
        "verified": True
    },
    {
        "name": "German University in Cairo",
        "slug": "guc",
        "city": "Cairo",
        "founded_year": 2002,
        "type": "private",
        "student_count": 12000,
        "accreditation": "German Accreditation Council",
        "description": "Egypt's first German-style university, offering programs in engineering, management, and applied sciences with German academic standards.",
        "website": "https://www.guc.edu.eg",
        "verified": True
    },
    {
        "name": "Zagazig University",
        "slug": "zagazig-university",
        "city": "Az Zaqaziq",
        "founded_year": 1974,
        "type": "public",
        "student_count": 110000,
        "accreditation": "Egyptian Ministry of Higher Education",
        "description": "A major public university in the Sharqia Governorate, offering diverse programs in medicine, agriculture, and humanities.",
        "website": "https://www.zu.edu.eg",
        "verified": True
    },
    {
        "name": "Tanta University",
        "slug": "tanta-university",
        "city": "Tanta",
        "founded_year": 1972,
        "type": "public",
        "student_count": 100000,
        "accreditation": "Egyptian Ministry of Higher Education",
        "description": "A prominent university in the Nile Delta, known for its medical faculty and hospitals serving the Gharbia Governorate.",
        "website": "https://www.tanta.edu.eg",
        "verified": True
    },
    {
        "name": "British University in Egypt",
        "slug": "bue",
        "city": "Cairo",
        "founded_year": 2005,
        "type": "private",
        "student_count": 8000,
        "accreditation": "Egyptian Ministry of Higher Education & UK Partners",
        "description": "A modern private university offering British-style education with strong industry partnerships and internship programs.",
        "website": "https://www.bue.edu.eg",
        "verified": True
    }
]

# Common amenities for Egyptian properties
AMENITIES_POOL = [
    "Security", "Parking", "Elevator", "Air Conditioning", "Balcony",
    "Garden", "Swimming Pool", "Gym", "Clubhouse", "24/7 Security",
    "CCTV", "Intercom", "Internet Ready", "Satellite TV", "Storage Room",
    "Maid Room", "Driver Room", "Private Entrance", "Pets Allowed",
    "Central Heating", "Double Glazed Windows", "Fire Alarm", "Solar Panels"
]

# Property type mapping from scraped data to schema enum
PROPERTY_TYPE_MAP = {
    'apartment': 'apartment',
    'villa': 'villa',
    'studio': 'studio',
    'duplex': 'duplex',
    'penthouse': 'penthouse',
    'chalet': 'chalet',
    'townhouse': 'townhouse',
    'twin_house': 'twin_house',
    'twin house': 'twin_house',
    'commercial': 'commercial',
    'office space': 'office',
    'office': 'office',
    'clinic': 'commercial',
    'room': 'room',
    'land': 'land',
    'whole building': 'whole_building',
    'building': 'whole_building'
}

# Listing categories
CATEGORIES = ['for_sale', 'for_rent', 'shared_housing']

# Cities and their approximate coordinates
CITY_COORDS = {
    'Cairo': (30.0444, 31.2358),
    'Giza': (29.9870, 31.2118),
    'Alexandria': (31.1975, 29.8925),
    'New Cairo': (30.0444, 31.4857),
    'Sheikh Zayed': (30.0495, 30.9762),
    '6th of October': (29.9523, 30.9188),
    'Hurghada': (27.2579, 33.8116),
    'Sharm El Sheikh': (27.9158, 34.3299),
    'North Coast': (30.8500, 29.6000),
    'Ain Sukhna': (29.6000, 32.3167),
    'New Capital': (30.0074, 31.4913),
    'Mansoura': (31.0409, 31.3785),
    'Asyut': (27.1783, 31.1859),
    'Luxor': (25.6872, 32.6396),
    'Aswan': (23.9088, 32.8772)
}


def parse_price(price_str: str) -> tuple[float, str]:
    """Extract numeric price and currency from string."""
    if not price_str:
        return (0, 'EGP')
    
    # Remove commas and extract number
    cleaned = price_str.replace(',', '').replace('EGP', '').replace('USD', '').replace(' ', '').strip()
    
    currency = 'EGP'
    if 'USD' in price_str or '$' in price_str:
        currency = 'USD'
    
    try:
        # Extract first number found
        numbers = re.findall(r'\d+', cleaned)
        if numbers:
            return (float(''.join(numbers)), currency)
    except:
        pass
    
    return (random.randint(500000, 15000000), 'EGP')


def parse_area(area_str: str) -> Optional[float]:
    """Extract area in sqm from string."""
    if not area_str:
        return None
    
    # Look for sqm or m² patterns
    match = re.search(r'(\d+(?:\.\d+)?)\s*(?:sqm|m²|sq\.?\s*m\.?)', area_str.lower())
    if match:
        try:
            return float(match.group(1))
        except:
            pass
    
    # Look for sqft and convert
    match = re.search(r'(\d+(?:\.\d+)?)\s*(?:sqft|sq\.?\s*ft)', area_str.lower())
    if match:
        try:
            sqft = float(match.group(1))
            return round(sqft * 0.092903, 1)  # Convert sqft to sqm
        except:
            pass
    
    return None


def parse_bedrooms(bed_str: str) -> Optional[int]:
    """Extract bedroom count."""
    if not bed_str:
        return None
    
    # Look for numbers
    match = re.search(r'(\d+)', str(bed_str))
    if match:
        try:
            return int(match.group(1))
        except:
            pass
    
    if 'studio' in str(bed_str).lower():
        return 0
    
    return None


def parse_bathrooms(bath_str: str) -> Optional[int]:
    """Extract bathroom count."""
    if not bath_str:
        return None
    
    match = re.search(r'(\d+)', str(bath_str))
    if match:
        try:
            return int(match.group(1))
        except:
            pass
    
    return None


def extract_city(location: str) -> str:
    """Extract city from location string."""
    if not location:
        return 'Cairo'
    
    location_lower = location.lower()
    
    city_mapping = {
        'new cairo': 'New Cairo',
        'sheikh zayed': 'Sheikh Zayed',
        '6th of october': '6th of October',
        'october': '6th of October',
        'hurghada': 'Hurghada',
        'gouna': 'Hurghada',
        'el gouna': 'Hurghada',
        'sharm': 'Sharm El Sheikh',
        'sharm el sheikh': 'Sharm El Sheikh',
        'north coast': 'North Coast',
        'sahel': 'North Coast',
        'ain sokhna': 'Ain Sukhna',
        'ain sukhna': 'Ain Sukhna',
        'new capital': 'New Capital',
        'capital city': 'New Capital',
        'mansoura': 'Mansoura',
        'assiut': 'Asyut',
        'asyut': 'Asyut',
        'alexandria': 'Alexandria',
        'alex': 'Alexandria',
        'giza': 'Giza',
        'cairo': 'Cairo',
        'nasr city': 'Cairo',
        'maadi': 'Cairo',
        'zamalek': 'Cairo',
        'heliopolis': 'Cairo',
        'luxor': 'Luxor',
        'aswan': 'Aswan'
    }
    
    for key, value in city_mapping.items():
        if key in location_lower:
            return value
    
    return 'Cairo'  # Default


def generate_slug(text: str) -> str:
    """Generate URL-friendly slug."""
    slug = re.sub(r'[^\w\s-]', '', text.lower())
    slug = re.sub(r'[-\s]+', '-', slug)
    return slug[:50]


def generate_listing_title(row: Dict[str, Any]) -> str:
    """Generate an attractive listing title from data."""
    prop_type = row.get('type', 'Property')
    bedrooms = row.get('bedrooms') or row.get('beds') or row.get('Bedrooms')
    location = row.get('location', 'Great Location')
    compound = row.get('compound', '')
    
    # Clean up property type
    prop_type_clean = str(prop_type).replace('_', ' ').title() if prop_type else 'Property'
    
    # Build title
    parts = []
    if bedrooms:
        parts.append(f"{bedrooms} Bedroom")
    parts.append(prop_type_clean)
    if compound:
        parts.append(f"in {compound}")
    else:
        parts.append(f"in {location.split(',')[0]}")
    
    return ' '.join(parts)


def generate_amenities() -> List[str]:
    """Generate random amenities list."""
    count = random.randint(3, 8)
    return random.sample(AMENITIES_POOL, count)


def create_listing_from_row(row: Dict[str, Any], source: str) -> Dict[str, Any]:
    """Transform a CSV row into a listing object matching the database schema."""
    
    # Extract and parse fields
    price, currency = parse_price(str(row.get('price', '')))
    size_sqm = parse_area(str(row.get('area', row.get('size', row.get('Area', row.get('Size', ''))))))
    bedrooms = parse_bedrooms(str(row.get('bedrooms', row.get('beds', row.get('Bedrooms', row.get('Rooms', ''))))))
    bathrooms = parse_bathrooms(str(row.get('bathrooms', row.get('baths', row.get('Bathrooms', '')))))
    
    location = str(row.get('location', row.get('Location', 'Cairo')))
    city = extract_city(location)
    
    # Determine property type
    raw_type = str(row.get('type', row.get('Type', 'apartment'))).lower().strip()
    property_type = PROPERTY_TYPE_MAP.get(raw_type, 'apartment')
    
    # Determine category based on source/type
    category = random.choice(CATEGORIES)
    if 'rent' in str(row.get('Category', '')).lower():
        category = 'for_rent'
    elif 'sale' in str(row.get('Category', '')).lower():
        category = 'for_sale'
    
    # Generate title
    title = generate_listing_title({
        'type': property_type,
        'bedrooms': bedrooms,
        'location': location,
        'compound': row.get('compound', row.get('Compound', ''))
    })
    
    # Get description
    description = str(row.get('description', row.get('Description', '')))
    if len(description) < 50:
        description = f"Beautiful {property_type} located in {location}. "
        description += f"Featuring {bedrooms or 'spacious'} bedrooms and {bathrooms or 'modern'} bathrooms. "
        description += "Perfect for families or professionals seeking quality living in Egypt."
    
    # Get coordinates for city
    lat, lng = CITY_COORDS.get(city, (30.0444, 31.2358))
    # Add some random offset for variety
    lat += random.uniform(-0.05, 0.05)
    lng += random.uniform(-0.05, 0.05)
    
    listing = {
        "id": str(uuid.uuid4()),
        "owner_id": DEMO_OWNER_ID,
        "title": title,
        "description": description[:500],  # Limit length
        "category": category,
        "property_type": property_type,
        "price": price,
        "currency": currency,
        "price_period": "/month" if category == 'for_rent' else None,
        "location": location[:100],
        "city": city,
        "size_sqm": size_sqm,
        "bedrooms": bedrooms,
        "bathrooms": bathrooms,
        "latitude": round(lat, 6),
        "longitude": round(lng, 6),
        "images": [],  # Will be populated with placeholder URLs
        "amenities": generate_amenities(),
        "status": "active",  # Set as active for demo
        "views_count": random.randint(10, 500),
        "is_new": random.choice([True, False]),
        "created_at": (datetime.now() - timedelta(days=random.randint(1, 60))).isoformat()
    }
    
    # Add rental-specific fields
    if category == 'for_rent':
        listing["lease_type"] = random.choice(["monthly", "yearly"])
        listing["available_date"] = (datetime.now() + timedelta(days=random.randint(7, 60))).strftime("%Y-%m-%d")
    
    # Add sale-specific fields
    if category == 'for_sale':
        down_payment_pct = random.choice([10, 15, 20, 25, 30])
        listing["payment_plan"] = {
            "type": "installment" if random.random() > 0.3 else "cash",
            "down_payment_pct": down_payment_pct,
            "years": random.randint(5, 10) if down_payment_pct < 30 else None
        }
    
    # Add shared housing fields
    if category == 'shared_housing':
        listing["room_type"] = random.choice(["ensuite", "private", "shared"])
        listing["furnishing"] = random.choice(["furnished", "semi_furnished"])
        listing["utilities_included"] = random.choice([True, False])
        listing["bathroom_type"] = random.choice(["private", "shared", "ensuite"])
        listing["total_spots"] = random.randint(2, 4)
        listing["filled_spots"] = random.randint(0, 2)
        listing["availability"] = random.choice(["available", "limited"])
    
    return listing


def extract_agencies_from_csv(file_path: str) -> List[Dict[str, Any]]:
    """Extract unique agencies from the property_data_egypt.csv file."""
    agencies = {}
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                developer = row.get('Real_Estate_Developer', '').strip()
                if developer and developer != 'None' and len(developer) > 2:
                    # Clean up the name
                    name = developer.replace('for Real Estate', '').replace('Real Estate', '').strip()
                    if name and name not in agencies:
                        slug = generate_slug(name)
                        # Ensure unique slug
                        base_slug = slug
                        counter = 1
                        while slug in agencies:
                            slug = f"{base_slug}-{counter}"
                            counter += 1
                        
                        city = extract_city(row.get('Location', 'Cairo'))
                        
                        agencies[slug] = {
                            "id": str(uuid.uuid4()),
                            "owner_id": DEMO_OWNER_ID,
                            "name": name,
                            "slug": slug,
                            "description": f"{name} is a leading real estate developer in Egypt, specializing in premium residential and commercial properties across {city} and beyond.",
                            "city": city,
                            "verified": random.choice([True, False]),
                            "website": f"https://www.{slug.replace('-', '')}.eg" if random.random() > 0.5 else None,
                            "phone": f"+20{random.randint(1000000000, 1299999999)}",
                            "email": f"info@{slug.replace('-', '')}.eg" if random.random() > 0.6 else None
                        }
    except Exception as e:
        print(f"Error reading agencies: {e}")
    
    return list(agencies.values())


def generate_listings_from_datasets() -> List[Dict[str, Any]]:
    """Generate 100 listings from the CSV datasets."""
    listings = []
    sources = [
        ('Datasets/real_estate_data_bayut_full.csv', 'bayut'),
        ('Datasets/egypt_real_estate_listings.csv', 'propertyfinder'),
        ('Datasets/Egypt-Real-Estate-Analysis-main/Egypt-Real-Estate-Analysis-main/property_data_egypt.csv', 'egypt_analysis'),
        ('Datasets/Apartments Prices Dataset version 2 .csv', 'apartments_v2')
    ]
    
    for file_path, source_name in sources:
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                
                # Sample rows based on how many we need
                sample_size = min(len(rows), 30)  # Get up to 30 from each source
                sampled = random.sample(rows, sample_size)
                
                for row in sampled:
                    if len(listings) >= 100:
                        break
                    
                    listing = create_listing_from_row(row, source_name)
                    if listing['price'] > 0:  # Only include if we have a valid price
                        listings.append(listing)
                        
        except Exception as e:
            print(f"Error reading {file_path}: {e}")
    
    # If we don't have enough, generate some synthetic ones
    while len(listings) < 100:
        city = random.choice(list(CITY_COORDS.keys()))
        property_type = random.choice(['apartment', 'villa', 'studio', 'duplex', 'penthouse', 'chalet'])
        category = random.choice(CATEGORIES)
        
        synthetic_listing = {
            "id": str(uuid.uuid4()),
            "owner_id": DEMO_OWNER_ID,
            "title": f"Modern {property_type.title()} in {city}",
            "description": f"Beautiful {property_type} located in the heart of {city}. Perfect for modern living with premium finishes and excellent location.",
            "category": category,
            "property_type": property_type,
            "price": random.randint(500000, 15000000),
            "currency": "EGP",
            "price_period": "/month" if category == 'for_rent' else None,
            "location": f"{random.choice(['Downtown', 'Compound', 'Residential Area'])}, {city}",
            "city": city,
            "size_sqm": random.randint(50, 350),
            "bedrooms": random.randint(1, 5),
            "bathrooms": random.randint(1, 4),
            "latitude": round(CITY_COORDS[city][0] + random.uniform(-0.05, 0.05), 6),
            "longitude": round(CITY_COORDS[city][1] + random.uniform(-0.05, 0.05), 6),
            "images": [],
            "amenities": generate_amenities(),
            "status": "active",
            "views_count": random.randint(10, 500),
            "is_new": random.choice([True, False]),
            "created_at": (datetime.now() - timedelta(days=random.randint(1, 60))).isoformat()
        }
        listings.append(synthetic_listing)
    
    return listings[:100]


def generate_universities() -> List[Dict[str, Any]]:
    """Generate 10 Egyptian universities."""
    universities = []
    for uni_data in EGYPTIAN_UNIVERSITIES:
        uni = {
            "id": str(uuid.uuid4()),
            "owner_id": DEMO_OWNER_ID,
            **uni_data,
            "created_at": datetime.now().isoformat()
        }
        universities.append(uni)
    return universities


def generate_sql_inserts(listings: List[Dict], agencies: List[Dict], universities: List[Dict]) -> str:
    """Generate SQL INSERT statements for the demo data."""
    sql_lines = [
        "-- AXIOM V2 Demo Data Insert Script",
        f"-- Generated on {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
        "",
        "-- NOTE: Ensure the demo owner user exists in auth.users first:",
        f"-- INSERT INTO auth.users (id, email) VALUES ('{DEMO_OWNER_ID}', 'demo@axiom.eg') ON CONFLICT DO NOTHING;",
        "",
    ]
    
    # Agencies inserts
    sql_lines.append("-- Insert Agencies")
    for agency in agencies[:20]:  # Limit to 20
        sql_lines.append(f"""
INSERT INTO agencies (id, owner_id, name, slug, description, city, verified, website, phone, email, created_at)
VALUES (
    '{agency['id']}',
    '{agency['owner_id']}',
    '{agency['name'].replace("'", "''")}',
    '{agency['slug']}',
    '{agency['description'].replace("'", "''")}',
    '{agency['city']}',
    {str(agency['verified']).lower()},
    {f"'{agency['website']}'" if agency.get('website') else 'NULL'},
    {f"'{agency['phone']}'" if agency.get('phone') else 'NULL'},
    {f"'{agency['email']}'" if agency.get('email') else 'NULL'},
    NOW()
) ON CONFLICT (slug) DO NOTHING;""")
    
    sql_lines.append("")
    sql_lines.append("-- Insert Universities")
    for uni in universities:
        sql_lines.append(f"""
INSERT INTO universities (id, owner_id, name, slug, description, city, founded_year, type, student_count, accreditation, website, verified, created_at)
VALUES (
    '{uni['id']}',
    '{uni['owner_id']}',
    '{uni['name'].replace("'", "''")}',
    '{uni['slug']}',
    '{uni['description'].replace("'", "''")}',
    '{uni['city']}',
    {uni['founded_year']},
    '{uni['type']}',
    {uni['student_count']},
    '{uni['accreditation'].replace("'", "''")}',
    {f"'{uni['website']}'" if uni.get('website') else 'NULL'},
    {str(uni['verified']).lower()},
    NOW()
) ON CONFLICT (slug) DO NOTHING;""")
    
    sql_lines.append("")
    sql_lines.append("-- Insert Listings")
    for listing in listings:
        # Convert amenities array to SQL
        amenities_sql = "'{" + ",".join([a.replace("'", "''") for a in listing['amenities']]) + "}'"
        
        # Build the INSERT
        sql_lines.append(f"""
INSERT INTO listings (
    id, owner_id, title, description, category, property_type, price, currency,
    location, city, size_sqm, bedrooms, bathrooms, latitude, longitude,
    amenities, status, views_count, is_new, created_at
) VALUES (
    '{listing['id']}',
    '{listing['owner_id']}',
    '{listing['title'].replace("'", "''")[:100]}',
    '{listing['description'].replace("'", "''")[:500]}',
    '{listing['category']}',
    '{listing['property_type']}',
    {listing['price']},
    '{listing['currency']}',
    '{listing['location'].replace("'", "''")[:100]}',
    '{listing['city']}',
    {listing['size_sqm'] if listing.get('size_sqm') else 'NULL'},
    {listing['bedrooms'] if listing.get('bedrooms') else 'NULL'},
    {listing['bathrooms'] if listing.get('bathrooms') else 'NULL'},
    {listing['latitude']},
    {listing['longitude']},
    {amenities_sql},
    '{listing['status']}',
    {listing['views_count']},
    {str(listing['is_new']).lower()},
    '{listing['created_at']}'
) ON CONFLICT DO NOTHING;""")
    
    return "\n".join(sql_lines)


def main():
    """Main function to generate all demo data."""
    import os
    
    # Create output directory
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("🚀 Generating AXIOM V2 Demo Data...")
    
    # Generate listings
    print("📊 Extracting 100 listings from datasets...")
    listings = generate_listings_from_datasets()
    print(f"   ✓ Generated {len(listings)} listings")
    
    # Generate agencies
    print("🏢 Extracting agencies from datasets...")
    agencies = extract_agencies_from_csv('Datasets/Egypt-Real-Estate-Analysis-main/Egypt-Real-Estate-Analysis-main/property_data_egypt.csv')
    print(f"   ✓ Extracted {len(agencies)} agencies")
    
    # Generate universities
    print("🎓 Generating 10 Egyptian universities...")
    universities = generate_universities()
    print(f"   ✓ Generated {len(universities)} universities")
    
    # Save JSON files
    with open(LISTINGS_FILE, 'w', encoding='utf-8') as f:
        json.dump(listings, f, indent=2, ensure_ascii=False)
    print(f"   💾 Saved: {LISTINGS_FILE}")
    
    with open(AGENCIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(agencies, f, indent=2, ensure_ascii=False)
    print(f"   💾 Saved: {AGENCIES_FILE}")
    
    with open(UNIVERSITIES_FILE, 'w', encoding='utf-8') as f:
        json.dump(universities, f, indent=2, ensure_ascii=False)
    print(f"   💾 Saved: {UNIVERSITIES_FILE}")
    
    # Generate SQL
    sql_content = generate_sql_inserts(listings, agencies, universities)
    with open(SQL_FILE, 'w', encoding='utf-8') as f:
        f.write(sql_content)
    print(f"   💾 Saved: {SQL_FILE}")
    
    print("\n✅ Demo data generation complete!")
    print(f"\n📁 Output files in {OUTPUT_DIR}/:")
    print(f"   - listings_demo.json ({len(listings)} records)")
    print(f"   - agencies_demo.json ({len(agencies)} records)")
    print(f"   - universities_demo.json ({len(universities)} records)")
    print(f"   - insert_demo_data.sql (SQL INSERT statements)")
    print("\n⚠️  IMPORTANT: Before running the SQL:")
    print(f"   1. Create the demo owner user: '{DEMO_OWNER_ID}'")
    print("   2. Or replace DEMO_OWNER_ID in the script with an existing user ID")
    print("\n🎯 To import into Supabase:")
    print("   Option 1: Run the SQL file in Supabase SQL Editor")
    print("   Option 2: Use the JSON files with Supabase REST API or SDK")


if __name__ == "__main__":
    main()
