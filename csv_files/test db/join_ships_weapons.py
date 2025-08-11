#!/bin/env python3
import csv
import os

ships_file = "ships_2.csv"
weapons_file = "weapons_2.csv"
output_file = "ships_weapons_2.csv"

# Defaults
DEFAULTS = {
    "damage_multiplier": "1",
    "max_per_turn": "1",
    "cooldown_turns": "1",
    "max_usage": "99999"
}

# Load weapons
weapons = {}
unknown_weapon_id = None
with open(weapons_file, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        weapons[row["name"].strip().lower()] = {
            "weapon_id": int(row["weapon_id"]),
            "usage_limit": row["usage_limit"].strip() if row["usage_limit"] else DEFAULTS["max_usage"]
        }
        if row["name"].strip().lower() == "unknown":
            unknown_weapon_id = int(row["weapon_id"])

if unknown_weapon_id is None:
    unknown_weapon_id = max(w["weapon_id"] for w in weapons.values()) + 1
    weapons["unknown"] = {"weapon_id": unknown_weapon_id, "usage_limit": 0}
    print(f"⚠ No 'Unknown' weapon in weapons_2.csv. Added as id={unknown_weapon_id}.")

# Load ships
ships = []
with open(ships_file, newline="", encoding="utf-8") as f:
    reader = csv.DictReader(f)
    for row in reader:
        ships.append({
            "ship_id": int(row["ship_id"]),
            "weapons": [w.strip() for w in row["weapons"].split(",") if w.strip()]
        })

# Load existing join table
existing_data = {}
if os.path.exists(output_file):
    with open(output_file, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            key = (int(row["ship_id"]), int(row["weapon_id"]))
            existing_data[key] = row

# Track changes
added, removed, updated, unchanged = 0, 0, 0, 0
rows = []
new_keys = set()

for ship in ships:
    for weapon_name in ship["weapons"]:
        weapon_key = weapon_name.lower()
        if weapon_key in weapons:
            weapon_id = weapons[weapon_key]["weapon_id"]
            usage_limit = weapons[weapon_key]["usage_limit"]
        else:
            print(f"⚠ Weapon '{weapon_name}' not found for ship {ship['ship_id']}. Using 'Unknown'.")
            weapon_id = unknown_weapon_id
            usage_limit = weapons["unknown"]["usage_limit"]

        key = (ship["ship_id"], weapon_id)
        new_keys.add(key)

        if key in existing_data:
            row = dict(existing_data[key])  # Start from existing
            changed = False

            # Fill only null/empty fields with defaults
            for field in ["damage_multiplier", "max_per_turn", "cooldown_turns", "max_usage"]:
                if row[field] is None or row[field] == "":
                    if field == "max_usage" and usage_limit != DEFAULTS["max_usage"]:
                        row[field] = usage_limit
                    else:
                        row[field] = DEFAULTS[field]
                    changed = True

            if changed:
                updated += 1
                print(f"🔄 Updated defaults for ship_id={ship['ship_id']} weapon_id={weapon_id}.")
            else:
                unchanged += 1
                print(f"ℹ Unchanged: ship_id={ship['ship_id']} weapon_id={weapon_id}.")

        else:
            added += 1
            row = {
                "ship_id": str(ship["ship_id"]),
                "weapon_id": str(weapon_id),
                "damage_multiplier": DEFAULTS["damage_multiplier"],
                "max_per_turn": DEFAULTS["max_per_turn"],
                "cooldown_turns": DEFAULTS["cooldown_turns"],
                "max_usage": usage_limit
            }
            print(f"➕ Added: ship_id={ship['ship_id']} weapon_id={weapon_id}.")

        rows.append(row)

# Find removed keys
for key in existing_data.keys():
    if key not in new_keys:
        removed += 1
        print(f"➖ Removed: ship_id={key[0]} weapon_id={key[1]}.")

# Write CSV
with open(output_file, "w", newline="", encoding="utf-8") as f:
    writer = csv.DictWriter(f, fieldnames=[
        "ship_id", "weapon_id", "damage_multiplier", "max_per_turn", "cooldown_turns", "max_usage"
    ])
    writer.writeheader()
    writer.writerows(rows)

print(f"\n✅ {output_file} written with {len(rows)} rows.")
print(f"Summary: Added={added}, Removed={removed}, Updated={updated}, Unchanged={unchanged}")
