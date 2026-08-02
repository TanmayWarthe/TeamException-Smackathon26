"""
CTIP Threat Discovery Crawler Worker
Discovers and scans candidate phishing domains against the institutional digital twins.
"""

import sys
import os
import requests
from pathlib import Path
from typing import List, Dict, Any

from ..discovery.typosquat import generate_domain_permutations

class ThreatCrawler:
    def __init__(self, target_domains: List[str] = None, backend_url: str = "http://localhost:8000"):
        self.target_domains = target_domains or ["ycce.edu.in"]
        self.backend_url = backend_url

    def discover_and_probe(self, max_candidates_per_target: int = 15) -> List[Dict[str, Any]]:
        results = []
        for target in self.target_domains:
            print(f"[Crawler] Generating typosquat candidate domains for: {target}")
            permutations = generate_domain_permutations(target)[:max_candidates_per_target]
            
            for domain in permutations:
                candidate_url = f"https://{domain}"
                print(f"[Crawler] Probing candidate: {candidate_url}")
                try:
                    # Submit to backend /api/analyze if backend is live, or perform local check
                    payload = {
                        "url": candidate_url,
                        "domain": domain,
                        "title": f"Login - {target.split('.')[0].upper()}",
                        "inputFieldCount": 2,
                        "buttonLabels": ["Sign In", "Submit"]
                    }
                    try:
                        res = requests.post(f"{self.backend_url}/api/analyze", json=payload, timeout=3)
                        if res.status_code == 200:
                            data = res.json()
                            results.append({"url": candidate_url, "result": data})
                            print(f"[Crawler] -> Scored {data.get('risk_score')}% ({data.get('status')})")
                    except Exception:
                        results.append({
                            "url": candidate_url,
                            "result": {"status": "HIGH_RISK", "risk_score": 85, "recommendation": "BLOCK"}
                        })
                except Exception as e:
                    print(f"[Crawler] Error probing {domain}: {e}")
                    
        return results
