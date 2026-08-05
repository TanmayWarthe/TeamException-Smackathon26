#!/usr/bin/env python3
"""
digital-twin/main.py
CLI entry point for generating and managing Digital Twins.

Usage:
    python digital-twin/main.py generate <url> [--name "Website Name"]
    python digital-twin/main.py list
    python digital-twin/main.py show <domain>
"""

import sys
import json
import argparse
import importlib.util
from pathlib import Path

# ── Load modules ─────────────────────────────────────────────
_base = Path(__file__).resolve().parent


def _load(name, path):
    spec = importlib.util.spec_from_file_location(name, str(path))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


_fingerprint = _load("fp", _base / "generator" / "fingerprint.py")
_twin_store = _load("ts", _base / "storage" / "twin_store.py")


def cmd_generate(args):
    """Generate a new Digital Twin."""
    twin = _fingerprint.generate_fingerprint_sync(
        url=args.url,
        website_name=args.name or "",
    )
    print(f"\n✅ Digital Twin generated for {twin['domain']}")
    print(f"   Saved to: {twin.get('screenshot_path', '?')}")


def cmd_list(args):
    """List all stored Digital Twins."""
    twins = _twin_store.list_twins()
    if not twins:
        print("No Digital Twins stored yet.")
        return

    print(f"\n📋 Stored Digital Twins ({len(twins)}):\n")
    for t in twins:
        print(f"  • {t['domain']}")
        print(f"    Name: {t.get('website_name', '?')}")
        print(f"    URL:  {t.get('official_url', '?')}")
        print(f"    Visual: {'✅' if t.get('has_visual_embedding') else '❌'}")
        print(f"    Logo:   {'✅' if t.get('has_logo_embedding') else '❌'}")
        print()


def cmd_show(args):
    """Show details of a specific Digital Twin."""
    twin = _twin_store.load_twin(args.domain)
    if twin is None:
        print(f"❌ No twin found for domain: {args.domain}")
        return

    # Print without embeddings
    display = {k: v for k, v in twin.items()
                if "embedding" not in k}
    print(json.dumps(display, indent=2, default=str))


def main():
    parser = argparse.ArgumentParser(description="CTIP Digital Twin Manager")
    sub = parser.add_subparsers(dest="command")

    gen = sub.add_parser("generate", help="Generate a new Digital Twin")
    gen.add_argument("url", help="Official URL to fingerprint")
    gen.add_argument("--name", help="Human-readable website name")

    sub.add_parser("list", help="List all stored twins")

    show = sub.add_parser("show", help="Show twin details")
    show.add_argument("domain", help="Domain to look up")

    args = parser.parse_args()

    if args.command == "generate":
        cmd_generate(args)
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "show":
        cmd_show(args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
