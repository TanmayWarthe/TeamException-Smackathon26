#!/usr/bin/env python3
"""
scripts/import_twin_dataset.py
Imports legitimate domain records from legitimate_domains_dataset.json
into the CTIP Digital Twins database and filesystem storage.
"""

import json
import asyncio
import argparse
from pathlib import Path
from datetime import datetime, timezone
import importlib.util
import sys

# Setup workspace root in path
ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import select
from backend.app.database.session import AsyncSessionLocal, engine, Base
from backend.app.models.entities import DigitalTwinModel
from shared.config import sanitize_domain

# Dynamic import for hyphenated digital-twin directory
def _load_mod(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

twin_store = _load_mod("twin_store", ROOT_DIR / "digital-twin" / "storage" / "twin_store.py")
save_twin = twin_store.save_twin
load_twin = twin_store.load_twin

DATASET_PATH = ROOT_DIR / "legitimate_domains_dataset.json"


async def import_dataset(category_filter: str = None, limit: int = None, force: bool = False):
    if not DATASET_PATH.exists():
        print(f"❌ Error: Dataset file not found at {DATASET_PATH}")
        return 0

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        domains_data = json.load(f)

    if category_filter:
        domains_data = [d for d in domains_data if d.get("category", "").lower() == category_filter.lower()]

    if limit and limit > 0:
        domains_data = domains_data[:limit]

    print(f"📦 Loaded {len(domains_data)} domain records from dataset.")

    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    imported_db = 0
    updated_db = 0
    created_fs = 0

    async with AsyncSessionLocal() as session:
        for item in domains_data:
            domain = item["domain"].strip().lower()
            name = item["website_name"].strip()
            url = item["official_url"].strip()
            category = item.get("category", "General")

            # 1. Update/Save in SQLite DB
            res = await session.execute(
                select(DigitalTwinModel).where(
                    (DigitalTwinModel.official_url == url) | (DigitalTwinModel.domain == domain)
                )
            )
            existing = res.scalars().first()

            if not existing:
                twin_record = DigitalTwinModel(
                    website_name=name,
                    official_url=url,
                    domain=domain,
                    fingerprint_version=1,
                    screenshot_path="",
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(twin_record)
                imported_db += 1
            elif force:
                existing.website_name = name
                existing.official_url = url
                existing.updated_at = datetime.now(timezone.utc)
                updated_db += 1

            # 2. Update/Save in TwinStore (Filesystem JSON)
            fs_twin = load_twin(domain)
            if not fs_twin or force:
                base_twin = {
                    "website_name": name,
                    "domain": domain,
                    "official_url": url,
                    "category": category,
                    "fingerprint_version": 1,
                    "screenshot_path": "",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "dom_fingerprint": {
                        "total_elements": 0,
                        "forms": [],
                        "inputs": [],
                        "buttons": [],
                    },
                    "css_colors": [],
                    "visual_embedding": None,
                    "logo_embedding": None,
                }
                save_twin(domain, base_twin)
                created_fs += 1

        await session.commit()

    print(f"✅ Seeding Complete:")
    print(f"   • Database: {imported_db} newly inserted, {updated_db} updated")
    print(f"   • Filesystem Twin Store: {created_fs} twin records initialized")
    return imported_db + updated_db


def main():
    parser = argparse.ArgumentParser(description="Import legitimate domains into CTIP Digital Twins")
    parser.add_argument("--category", type=str, help="Filter by category (e.g. 'E-commerce', 'Banking/Finance')")
    parser.add_argument("--limit", type=int, help="Limit number of domains to import")
    parser.add_argument("--force", action="store_true", help="Force overwrite existing twins")
    args = parser.parse_args()

    asyncio.run(import_dataset(category_filter=args.category, limit=args.limit, force=args.force))


if __name__ == "__main__":
    main()
