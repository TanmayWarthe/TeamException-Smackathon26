"""
digital-twin/extractor/dom_extractor.py
Parses rendered HTML with BeautifulSoup to produce a structural DOM fingerprint.

Shared implementation — evidence-engine imports this same function.
"""

from bs4 import BeautifulSoup, Comment
from collections import Counter
from typing import Any

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))


def extract_dom_fingerprint(html: str) -> dict[str, Any]:
    """
    Extract a structural fingerprint from rendered HTML.

    Returns:
        dict with:
            - element_count: total number of HTML elements
            - tag_frequency: dict mapping tag names to counts
            - dom_depth: maximum nesting depth
            - form_count: number of <form> elements
            - input_count: number of <input> elements
            - has_nav: whether <nav> is present
            - has_header: whether <header> is present
            - has_footer: whether <footer> is present
            - link_count: number of <a> tags
            - script_count: number of <script> tags
            - meta_tags: list of meta tag name/content pairs
    """
    soup = BeautifulSoup(html, "lxml")

    # Remove comments
    for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
        comment.extract()

    all_tags = soup.find_all(True)
    element_count = len(all_tags)

    # Tag frequency
    tag_names = [tag.name for tag in all_tags]
    tag_frequency = dict(Counter(tag_names).most_common())

    # DOM depth
    def get_depth(element, current=0):
        children = [c for c in element.children if hasattr(c, "children")]
        if not children:
            return current
        return max(get_depth(c, current + 1) for c in children)

    dom_depth = get_depth(soup) if soup.body else 0

    # Form / input counts
    forms = soup.find_all("form")
    form_count = len(forms)
    input_count = len(soup.find_all("input"))

    # Structural landmarks
    has_nav = soup.find("nav") is not None
    has_header = soup.find("header") is not None
    has_footer = soup.find("footer") is not None

    # Links and scripts
    link_count = len(soup.find_all("a"))
    script_count = len(soup.find_all("script"))

    # Meta tags (useful for matching)
    meta_tags = []
    for meta in soup.find_all("meta"):
        name = meta.get("name", meta.get("property", ""))
        content = meta.get("content", "")
        if name and content:
            meta_tags.append({"name": name, "content": content[:200]})

    return {
        "element_count": element_count,
        "tag_frequency": tag_frequency,
        "dom_depth": dom_depth,
        "form_count": form_count,
        "input_count": input_count,
        "has_nav": has_nav,
        "has_header": has_header,
        "has_footer": has_footer,
        "link_count": link_count,
        "script_count": script_count,
        "meta_tags": meta_tags,
    }


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    sample_html = """
    <html>
    <head><title>Test Login</title></head>
    <body>
        <header><nav><a href="/">Home</a></nav></header>
        <main>
            <form action="/login" method="POST">
                <input type="text" name="username" placeholder="Email" />
                <input type="password" name="password" placeholder="Password" />
                <button type="submit">Sign In</button>
            </form>
        </main>
        <footer><p>© 2024</p></footer>
    </body>
    </html>
    """
    fp = extract_dom_fingerprint(sample_html)
    import json
    print(json.dumps(fp, indent=2))
