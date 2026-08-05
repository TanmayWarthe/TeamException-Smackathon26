#!/usr/bin/env python3
"""
scripts/cleanup_threats.py
Deduplicates the threats table in the SQLite database by collapsing multiple active rows
per domain into a single canonical record (preserving seed records or most recent timestamps).
Also cleans up orphaned notification records.

Usage:
    python3 scripts/cleanup_threats.py          # Deduplicate duplicate rows
    python3 scripts/cleanup_threats.py --reset  # Reset back to initial seed state
"""

import sys
import sqlite3
import argparse
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "backend" / "ctip.db"


def deduplicate_threats(db_path: Path):
    if not db_path.exists():
        print(f"[Error] Database file not found at: {db_path}")
        return

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Find distinct active domains
    cursor.execute("""
        SELECT DISTINCT domain FROM threats WHERE threat_status = 'ACTIVE'
    """)
    domains = [row[0] for row in cursor.fetchall()]

    total_deleted = 0
    kept_threats = []

    for domain in domains:
        cursor.execute("""
            SELECT id, domain, risk_score, detected_at 
            FROM threats 
            WHERE domain = ? AND threat_status = 'ACTIVE'
            ORDER BY 
                CASE WHEN id LIKE 'thr_%' THEN 0 ELSE 1 END,
                detected_at DESC
        """, (domain,))
        rows = cursor.fetchall()

        if len(rows) > 1:
            # First row is the canonical one to keep (preferring seed ID thr_xxx or most recent)
            keep_id, keep_domain, keep_score, keep_date = rows[0]
            delete_ids = [r[0] for r in rows[1:]]

            # Delete duplicates
            cursor.executemany("DELETE FROM threats WHERE id = ?", [(tid,) for tid in delete_ids])
            # Delete associated notifications for removed rows
            cursor.executemany("DELETE FROM notifications WHERE threat_id = ?", [(tid,) for tid in delete_ids])

            total_deleted += len(delete_ids)
            kept_threats.append((keep_id, keep_domain, keep_score, len(delete_ids)))
        elif len(rows) == 1:
            kept_threats.append((rows[0][0], rows[0][1], rows[0][2], 0))

    # Also prune any orphaned notifications whose threat_id no longer exists or test duplicate notifications
    cursor.execute("""
        DELETE FROM notifications 
        WHERE (threat_id IS NOT NULL AND threat_id NOT IN (SELECT id FROM threats))
           OR (threat_id IS NULL AND id NOT IN ('ntf_001', 'ntf_002'))
    """)

    conn.commit()

    cursor.execute("SELECT count(*) FROM threats")
    remaining_count = cursor.fetchone()[0]

    cursor.execute("SELECT count(*) FROM notifications")
    remaining_notifs = cursor.fetchone()[0]

    conn.close()

    print("==================================================")
    print("CTIP Threat Deduplication Complete")
    print("==================================================")
    print(f"Total duplicate rows removed: {total_deleted}")
    print(f"Remaining active threats:     {remaining_count}")
    print(f"Remaining notifications:      {remaining_notifs}")
    print("\nCanonical threats retained:")
    for tid, domain, score, dup_count in kept_threats:
        dup_msg = f"(collapsed {dup_count} duplicates)" if dup_count > 0 else ""
        print(f"  • [{tid}] {domain} (Risk: {score}%) {dup_msg}")
    print("==================================================")


def reset_to_seed(db_path: Path):
    if not db_path.exists():
        print(f"[Error] Database file not found at: {db_path}")
        return

    conn = sqlite3.connect(str(db_path))
    cursor = conn.cursor()

    # Clear threats and notifications that are not seed
    cursor.execute("DELETE FROM threats WHERE id NOT IN ('thr_001', 'thr_002', 'thr_003')")
    cursor.execute("DELETE FROM notifications WHERE threat_id NOT IN ('thr_001', 'thr_002', 'thr_003')")

    conn.commit()

    cursor.execute("SELECT count(*) FROM threats")
    remaining_count = cursor.fetchone()[0]
    conn.close()

    print(f"Database reset to seed state ({remaining_count} threats remaining).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CTIP Threat Table Deduplication & Cleanup")
    parser.add_argument("--reset", action="store_true", help="Reset threats table to default seed items")
    args = parser.parse_args()

    if args.reset:
        reset_to_seed(DB_PATH)
    else:
        deduplicate_threats(DB_PATH)
