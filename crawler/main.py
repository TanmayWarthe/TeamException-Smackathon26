"""
CTIP Threat Discovery Crawler Service CLI
"""

import sys
import argparse
from pathlib import Path

# Add project root to path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from crawler.scheduler.crawler_task import ThreatCrawler

def main():
    parser = argparse.ArgumentParser(description="CTIP Campus Phishing Threat Discovery Crawler")
    parser.add_argument("--target", type=str, default="ycce.edu.in", help="Target institutional domain")
    parser.add_argument("--count", type=int, default=10, help="Max candidates to probe")
    parser.add_argument("--backend", type=str, default="http://localhost:8000", help="CTIP Backend API URL")
    
    args = parser.parse_args()
    print(f"=== CTIP Threat Discovery Crawler Started ===")
    print(f"Target: {args.target} | Count: {args.count} | Backend: {args.backend}\n")
    
    crawler = ThreatCrawler(target_domains=[args.target], backend_url=args.backend)
    results = crawler.discover_and_probe(max_candidates_per_target=args.count)
    
    print(f"\n[Crawler Finished] Probed {len(results)} candidate phishing domains.")

if __name__ == "__main__":
    main()
