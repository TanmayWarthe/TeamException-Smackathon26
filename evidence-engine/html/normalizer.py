"""
evidence-engine/html/normalizer.py
Strips tracking scripts, comments, and excessive whitespace from HTML
to produce a clean string for DOM comparison.
"""

import re
from bs4 import BeautifulSoup, Comment


# Known tracking / ad script patterns to strip
_TRACKING_PATTERNS = [
    r"google-analytics\.com",
    r"googletagmanager\.com",
    r"facebook\.net",
    r"hotjar\.com",
    r"doubleclick\.net",
    r"analytics",
    r"tracking",
    r"adsbygoogle",
    r"pixel",
]
_TRACKING_RE = re.compile("|".join(_TRACKING_PATTERNS), re.IGNORECASE)


def normalize_html(html: str) -> str:
    """
    Clean HTML for structural comparison.

    Removes:
        - HTML comments
        - Tracking/ad <script> tags (keeps functional scripts)
        - Inline event handlers (onclick, etc.)
        - Excessive whitespace

    Returns:
        Cleaned HTML string.
    """
    soup = BeautifulSoup(html, "lxml")

    # Remove comments
    for comment in soup.find_all(string=lambda t: isinstance(t, Comment)):
        comment.extract()

    # Remove tracking/ad scripts (keep functional ones)
    for script in soup.find_all("script"):
        src = script.get("src", "")
        content = script.string or ""
        if _TRACKING_RE.search(src) or _TRACKING_RE.search(content):
            script.decompose()

    # Remove noscript tags (usually tracking fallbacks)
    for ns in soup.find_all("noscript"):
        ns.decompose()

    # Remove inline event handlers
    for tag in soup.find_all(True):
        attrs_to_remove = [a for a in tag.attrs if a.startswith("on")]
        for attr in attrs_to_remove:
            del tag[attr]
        # Remove data-analytics attributes
        attrs_to_remove = [a for a in tag.attrs if "analytics" in a.lower() or "tracking" in a.lower()]
        for attr in attrs_to_remove:
            del tag[attr]

    # Get cleaned HTML and normalize whitespace
    cleaned = soup.prettify()
    # Collapse multiple blank lines
    cleaned = re.sub(r"\n\s*\n", "\n", cleaned)

    return cleaned.strip()


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    test_html = """
    <html>
    <!-- This is a comment -->
    <head>
        <script src="https://www.googletagmanager.com/gtag.js"></script>
        <script>window.ga = function(){}</script>
        <script src="/app.js"></script>
    </head>
    <body onclick="track()">
        <div data-analytics-id="123">
            <form action="/login">
                <input type="text" name="user" />
                <input type="password" name="pass" />
            </form>
        </div>
        <noscript><img src="tracking-pixel.png"/></noscript>
    </body>
    </html>
    """
    result = normalize_html(test_html)
    print(result)
    print(f"\nOriginal length: {len(test_html)}")
    print(f"Cleaned length: {len(result)}")
