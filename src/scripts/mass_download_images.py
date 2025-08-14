#!/usr/bin/env python3
import csv
import os
import requests
from PIL import Image
from io import BytesIO

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))  # src/
CSV_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "csv_files"))  # csv_files/

FILES = [
    {
        "csv": os.path.join(CSV_DIR, "ships.csv"),
        "img_dir": os.path.join(BASE_DIR, "public", "images", "ships"),
        "public_path": "images/ships"
    },
    {
        "csv": os.path.join(CSV_DIR, "boss_ships.csv"),
        "img_dir": os.path.join(BASE_DIR, "public", "images", "bosses"),
        "public_path": "images/bosses"
    }
]

# Ensure directories exist
for f in FILES:
    os.makedirs(f["img_dir"], exist_ok=True)

def get_filename_base(name):
    return name.replace(" ", "_")

def download_and_convert(name, url, save_dir):
    filename_base = get_filename_base(name)
    webp_path = os.path.join(save_dir, f"{filename_base}.webp")

    # If already exists
    if os.path.exists(webp_path):
        print(f"🔁 Skipping {name}: already exists.")
        return "skipped", webp_path

    try:
        print(f"⬇️ Downloading {name} from {url}")
        r = requests.get(url, timeout=15)
        r.raise_for_status()

        img = Image.open(BytesIO(r.content)).convert("RGB")
        img.save(webp_path, "webp")
        print(f"✅ Saved {webp_path}")
        return "success", webp_path

    except Exception as e:
        print(f"❌ Failed to download/convert {name} from {url}: {e}")
        return "failed", None

def process_csv(csv_file, img_dir, public_path):
    stats = {"success": 0, "failed": 0, "skipped": 0, "missing_local": 0}
    updated_rows = []

    with open(csv_file, newline='', encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fieldnames = reader.fieldnames
        for row in reader:
            name = row["name"]
            src_val = row["image_src"]

            if not name or not src_val:
                stats["failed"] += 1
                updated_rows.append(row)
                continue

            # If already local path
            if not (src_val.lower().startswith("http://") or src_val.lower().startswith("https://")):
                local_file_path = os.path.join(BASE_DIR, "public", src_val)
                if not os.path.exists(local_file_path):
                    print(f"⚠️ Local file missing for {name}: {src_val}")
                    stats["missing_local"] += 1
                else:
                    stats["skipped"] += 1
                updated_rows.append(row)
                continue

            # Download new image
            status, local_path = download_and_convert(name, src_val, img_dir)
            if status == "success":
                row["image_src"] = f"{public_path}/{get_filename_base(name)}.webp"
                stats["success"] += 1
            elif status == "skipped":
                row["image_src"] = f"{public_path}/{get_filename_base(name)}.webp"
                stats["skipped"] += 1
            else:
                stats["failed"] += 1

            updated_rows.append(row)

    # Overwrite CSV image_src
    with open(csv_file, "w", newline='', encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(updated_rows)

    return stats

def main():
    total_stats = {"success": 0, "failed": 0, "skipped": 0, "missing_local": 0}

    for file_info in FILES:
        print(f"\n📂 Processing {file_info['csv']}")
        stats = process_csv(file_info["csv"], file_info["img_dir"], file_info["public_path"])
        for k in total_stats:
            total_stats[k] += stats[k]

    print("\n📊 Final Results:")
    print(f"✅ Successful downloads: {total_stats['success']}")
    print(f"🔁 Skipped (already existed or already local): {total_stats['skipped']}")
    print(f"⚠️ Missing local files: {total_stats['missing_local']}")
    print(f"❌ Failed downloads: {total_stats['failed']}")

if __name__ == "__main__":
    main()
