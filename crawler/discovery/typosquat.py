"""
CTIP Typosquatting and Lookalike Domain Discovery Generator
Generates permutation patterns (TLD swaps, prefixes/suffixes, hyphenations, homoglyphs)
for targeted university institutional domains.
"""

from typing import List, Set
from urllib.parse import urlparse

CAMPUS_KEYWORDS = ["login", "erp", "portal", "student", "auth", "webmail", "exam", "verify", "secure", "fees"]
SUSPICIOUS_TLDS = [".xyz", ".top", ".site", ".online", ".club", ".info", ".net", ".org", ".com", ".cc"]

def generate_domain_permutations(base_domain: str) -> List[str]:
    """
    Generate a list of candidate typosquatting & impersonation domains for a campus base domain.
    E.g. base: 'ycce.edu.in' -> ['ycce-erp.xyz', 'ycce-login.com', 'login-ycce.site', 'ycceportal.xyz', ...]
    """
    candidates: Set[str] = set()
    
    # Strip subdomains / tld to get core brand name
    parts = base_domain.split(".")
    brand = parts[0] if parts[0] not in ["www", "mail", "erp", "student"] else parts[1]
    
    # 1. Keyword Prefix & Suffix combinations
    for kw in CAMPUS_KEYWORDS:
        for tld in SUSPICIOUS_TLDS:
            candidates.add(f"{brand}-{kw}{tld}")
            candidates.add(f"{brand}{kw}{tld}")
            candidates.add(f"{kw}-{brand}{tld}")
            candidates.add(f"{kw}{brand}{tld}")
            
    # 2. Hyphenation variations
    candidates.add(f"{brand}-edu.xyz")
    candidates.add(f"{brand}-official.site")
    candidates.add(f"{brand}-campus.online")
    
    # 3. Missing character / duplication (typos)
    if len(brand) >= 3:
        for i in range(len(brand)):
            # Missing char
            dropped = brand[:i] + brand[i+1:]
            for tld in [".xyz", ".com", ".net"]:
                candidates.add(f"{dropped}{tld}")
            # Doubled char
            doubled = brand[:i] + brand[i] + brand[i:]
            for tld in [".xyz", ".com"]:
                candidates.add(f"{doubled}{tld}")

    return sorted(list(candidates))

if __name__ == "__main__":
    test_perms = generate_domain_permutations("ycce.edu.in")
    print(f"Generated {len(test_perms)} permutations for ycce.edu.in. Sample:")
    for p in test_perms[:10]:
        print(f" - https://{p}")
