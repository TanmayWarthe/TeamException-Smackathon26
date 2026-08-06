"""
digital-twin/generator/render.py
Renders a webpage using Playwright, captures full-page screenshot,
rendered HTML, and element bounding-box data for logo detection.

This module is reused by evidence-engine for candidate site rendering.
"""

import asyncio
from pathlib import Path
from urllib.parse import urlparse

try:
    from playwright.async_api import async_playwright, Page, Browser
    HAS_PLAYWRIGHT = True
except ImportError:
    HAS_PLAYWRIGHT = False
    async_playwright = None

import sys, os
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))
from shared.config import (
    DEFAULT_VIEWPORT, RENDER_WAIT_MS, BROWSER_HEADLESS,
    BROWSER_TIMEOUT_MS, SCREENSHOTS_DIR, sanitize_domain,
)


async def render_page(url: str, screenshot_path: str | None = None) -> dict:
    """
    Render a URL with Playwright (or requests fallback if Playwright is absent),
    capture screenshot and HTML.
    """
    domain = urlparse(url).hostname or "unknown"

    if screenshot_path is None:
        screenshot_path = str(SCREENSHOTS_DIR / f"{sanitize_domain(domain)}.png")

    if not HAS_PLAYWRIGHT:
        import requests
        try:
            resp = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0 CTIP Security Bot"})
            html = resp.text
        except Exception:
            html = f"<html><head><title>{domain}</title></head><body><h1>{domain}</h1></body></html>"
        
        return {
            "url": url,
            "domain": domain,
            "html": html,
            "screenshot_path": screenshot_path,
            "title": domain,
            "img_elements": [],
        }

    try:
        async with async_playwright() as p:
            browser: Browser = await p.chromium.launch(headless=BROWSER_HEADLESS)
            context = await browser.new_context(
                viewport=DEFAULT_VIEWPORT,
                ignore_https_errors=True,  # some phishing sites have bad certs
            )
            page: Page = await context.new_page()

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=25000)
            except Exception as e:
                print(f"[Render] Playwright goto notice for {url}: {e}")

            # Wait briefly for JS rendering
            try:
                await page.wait_for_timeout(RENDER_WAIT_MS)
            except Exception:
                pass

            # Capture screenshot
            Path(screenshot_path).parent.mkdir(parents=True, exist_ok=True)
            try:
                await page.screenshot(path=screenshot_path, full_page=True)
            except Exception:
                pass

            # Get rendered HTML and title
            try:
                html = await page.content()
                title = await page.title()
            except Exception:
                html = f"<html><head><title>{domain}</title></head><body><h1>{domain}</h1></body></html>"
                title = domain

            # Collect img element bounding boxes for logo detection
            try:
                img_elements = await page.evaluate("""
                    () => {
                        const imgs = document.querySelectorAll('img');
                        return Array.from(imgs).map(img => {
                            const rect = img.getBoundingClientRect();
                            return {
                                src: img.src || '',
                                alt: img.alt || '',
                                className: img.className || '',
                                x: rect.x,
                                y: rect.y,
                                width: rect.width,
                                height: rect.height,
                            };
                        });
                    }
                """)
            except Exception:
                img_elements = []

            await browser.close()

        return {
            "url": url,
            "domain": domain,
            "html": html,
            "screenshot_path": screenshot_path,
            "title": title or domain,
            "img_elements": img_elements,
        }
    except Exception as err:
        print(f"[Render] Playwright failed completely for {url}: {err}. Falling back to HTTP GET.")
        import requests
        try:
            resp = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0 CTIP Security Bot"})
            html = resp.text
        except Exception:
            html = f"<html><head><title>{domain}</title></head><body><h1>{domain}</h1></body></html>"

        return {
            "url": url,
            "domain": domain,
            "html": html,
            "screenshot_path": screenshot_path,
            "title": domain,
            "img_elements": [],
        }


def render_page_sync(url: str, screenshot_path: str | None = None) -> dict:
    """Synchronous wrapper for render_page().
    
    Raises RuntimeError if called from within an existing event loop.
    """
    try:
        asyncio.get_running_loop()
        raise RuntimeError(
            "render_page_sync() cannot be called from a running event loop. "
            "Use 'await render_page(url, screenshot_path)' instead."
        )
    except RuntimeError as e:
        if "cannot be called from a running event loop" in str(e):
            raise
        return asyncio.run(render_page(url, screenshot_path))


# ── Standalone test ───────────────────────────────────────────
if __name__ == "__main__":
    result = render_page_sync("https://github.com/login")
    print(f"Rendered: {result['url']}")
    print(f"Title: {result['title']}")
    print(f"Screenshot: {result['screenshot_path']}")
    print(f"HTML length: {len(result['html'])} chars")
    print(f"Images found: {len(result['img_elements'])}")
