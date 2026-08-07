#!/usr/bin/env python3
"""
scripts/generate_twin_fingerprints.py
Generates full Playwright screenshots, DOM structural fingerprints,
and CLIP ViT embeddings for domains in legitimate_domains_dataset.json
or custom requested URLs.
"""

import sys
import json
import asyncio
import argparse
from pathlib import Path
from datetime import datetime, timezone
import importlib.util

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR))

from sqlalchemy import select
from backend.app.database.session import AsyncSessionLocal, engine, Base
from backend.app.models.entities import DigitalTwinModel

def _load_mod(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod

twin_store = _load_mod("twin_store", ROOT_DIR / "digital-twin" / "storage" / "twin_store.py")
fp_mod = _load_mod("fingerprint", ROOT_DIR / "digital-twin" / "generator" / "fingerprint.py")

save_twin = twin_store.save_twin
generate_fingerprint = fp_mod.generate_fingerprint

DATASET_PATH = ROOT_DIR / "legitimate_domains_dataset.json"


async def fingerprint_domain(url: str, name: str = "", domain: str = ""):
    print(f"\n🚀 [Generating Fingerprint] -> {url} ({name or domain})")
    try:
        twin = await generate_fingerprint(url=url, website_name=name)
        if not twin or "error" in twin:
            print(f"⚠️ Failed to generate fingerprint for {url}: {twin.get('error') if twin else 'Unknown'}")
            return False

        # Save to filesystem
        save_twin(twin["domain"], twin)

        # Update database record
        async with AsyncSessionLocal() as session:
            res = await session.execute(
                select(DigitalTwinModel).where(
                    (DigitalTwinModel.domain == twin["domain"]) | (DigitalTwinModel.official_url == url)
                )
            )
            record = res.scalars().first()
            if record:
                record.screenshot_path = twin.get("screenshot_path", "")
                record.fingerprint_version = twin.get("fingerprint_version", 1)
                record.updated_at = datetime.now(timezone.utc)
            else:
                record = DigitalTwinModel(
                    website_name=name or twin.get("website_name", twin["domain"]),
                    official_url=url,
                    domain=twin["domain"],
                    fingerprint_version=twin.get("fingerprint_version", 1),
                    screenshot_path=twin.get("screenshot_path", ""),
                    created_at=datetime.now(timezone.utc),
                    updated_at=datetime.now(timezone.utc),
                )
                session.add(record)
            await session.commit()

        print(f"✅ Successfully generated and saved twin for {twin['domain']}")
        return True
    except Exception as e:
        print(f"❌ Error fingerprinting {url}: {e}")
        return False


async def batch_generate(category: str = None, top: int = None, domain_target: str = None, url_target: str = None):
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # 1. Single direct URL
    if url_target:
        await fingerprint_domain(url=url_target, name="", domain="")
        return

    # 2. Single domain lookup in dataset or direct
    if domain_target:
        clean_target = domain_target.strip().lower()
        if DATASET_PATH.exists():
            with open(DATASET_PATH, "r", encoding="utf-8") as f:
                dataset = json.load(f)
            match = next((d for d in dataset if d["domain"].lower() == clean_target), None)
            if match:
                await fingerprint_domain(url=match["official_url"], name=match["website_name"], domain=match["domain"])
                return
        # If not in dataset, construct standard https URL
        await fingerprint_domain(url=f"https://{clean_target}", name=clean_target, domain=clean_target)
        return

    # 3. Batch from dataset
    if not DATASET_PATH.exists():
        print(f"❌ Dataset not found at {DATASET_PATH}")
        return

    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        dataset = json.load(f)

    if category:
        dataset = [d for d in dataset if d.get("category", "").lower() == category.lower()]

    if top and top > 0:
        dataset = dataset[:top]

    print(f"⚡ Starting batch fingerprint generation for {len(dataset)} portals...")
    success_count = 0
    for idx, item in enumerate(dataset, 1):
        print(f"[{idx}/{len(dataset)}] Processing {item['website_name']} ({item['domain']})...")
        success = await fingerprint_domain(url=item["official_url"], name=item["website_name"], domain=item["domain"])
        if success:
            success_count += 1

    print(f"\n🎉 Batch Complete: {success_count}/{len(dataset)} twin fingerprints generated successfully.")


def main():
    parser = argparse.ArgumentParser(description="Generate full Playwright & CLIP AI fingerprints for Digital Twins")
    parser.add_argument("--domain", type=str, help="Target a specific domain (e.g. 'amazon.com')")
    parser.add_argument("--url", type=str, help="Target a custom full URL")
    parser.add_argument("--category", type=str, help="Filter by category in dataset (e.g. 'E-commerce', 'Banking/Finance')")
    parser.add_argument("--top", type=int, help="Limit to top N entries from dataset")
    args = parser.parse_args()

    asyncio.run(batch_generate(category=args.category, top=args.top, domain_target=args.domain, url_target=args.url))


if __name__ == "__main__":
    main()
