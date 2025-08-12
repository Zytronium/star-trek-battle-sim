#!/bin/env python3
import csv

ships_file = "ships_2.csv"
defenses_file = "defenses_2.csv"
join_file = "ships_defenses_2.csv"

# Load defenses data into a dictionary
defenses = {}
with open(defenses_file, newline='', encoding='utf-8') as df:
    reader = csv.DictReader(df)
    for row in reader:
        defenses[row["name"].strip()] = row
    if "Unknown" not in defenses:
        print("Warning: 'Unknown' defense not found in defenses_2.csv")

# Prepare new join table data
join_rows = []
with open(ships_file, newline='', encoding='utf-8') as sf:
    reader = csv.DictReader(sf)
    for ship in reader:
        ship_id = ship["ship_id"]
        defense_names = [d.strip() for d in ship["defenses"].split(",") if d.strip()]
        for defense_name in defense_names:
            if defense_name in defenses:
                defense_id = defenses[defense_name].get("defense_id", defenses[defense_name].get("id", ""))
            else:
                print(f"Warning: Defense '{defense_name}' not found for ship '{ship['name']}', defaulting to 'Unknown'")
                defense_id = defenses.get("Unknown", {}).get("defense_id", defenses.get("Unknown", {}).get("id", ""))
                defense_name = "Unknown"

            def_row = defenses.get(defense_name, {})
            row = {
                "ship_id": ship_id,
                "defense_id": str(defense_id),
            }
            join_rows.append(row)

# Write join table
with open(join_file, "w", newline='', encoding='utf-8') as jf:
    fieldnames = ["ship_id", "defense_id"]
    writer = csv.DictWriter(jf, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(join_rows)

print(f"Join table '{join_file}' created successfully.")
