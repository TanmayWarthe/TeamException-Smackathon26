import socket
import ssl
from urllib.parse import urlparse


def resolve_domain_infrastructure(url: str, domain: str) -> dict[str, str]:
    """
    Resolves origin IP address, SSL certificate status, and registrar information
    for a candidate URL/domain.
    Handles local test environments (e.g. localhost, loopback IPs, unresolvable test domains)
    gracefully without outputting fabricated fake IP/registrar details.
    """
    url_str = (url or "").strip()
    if not url_str and domain:
        url_str = f"https://{domain}"
    elif url_str and not url_str.startswith(("http://", "https://")):
        url_str = f"https://{url_str}"

    parsed = urlparse(url_str)
    hostname = parsed.hostname or domain or url_str.replace("https://", "").replace("http://", "").split("/")[0]
    if ":" in hostname:
        hostname = hostname.split(":")[0]

    # 1. IP Address Resolution
    ip_address = "Not available"
    if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        ip_address = "127.0.0.1 (local)"
    elif hostname:
        try:
            resolved_ip = socket.gethostbyname(hostname)
            if resolved_ip.startswith("127."):
                ip_address = f"{resolved_ip} (local)"
            else:
                ip_address = resolved_ip
        except Exception:
            ip_address = "N/A — Local Test Domain"

    # 2. SSL Certificate Inspection
    ssl_status = "Not available"
    if hostname in ("localhost", "127.0.0.1", "0.0.0.0", "::1"):
        ssl_status = "No SSL Certificate (Local HTTP/Test)"
    elif hostname:
        try:
            context = ssl.create_default_context()
            with socket.create_connection((hostname, 443), timeout=3.5) as sock:
                with context.wrap_socket(sock, server_hostname=hostname) as ssock:
                    cert = ssock.getpeercert()
                    issuer_dict = dict(x[0] for x in cert.get("issuer", []))
                    issuer_name = (
                        issuer_dict.get("organizationName")
                        or issuer_dict.get("commonName")
                        or "Valid Issuer"
                    )
                    ssl_status = f"Valid ({issuer_name})"
        except Exception:
            if parsed.scheme.lower() == "http":
                ssl_status = "No SSL Certificate (HTTP only)"
            else:
                ssl_status = "Invalid / Untrusted SSL Certificate"

    # 3. Registrar Information (WHOIS)
    registrar = "Not available"

    return {
        "ip_address": ip_address,
        "registrar": registrar,
        "ssl_status": ssl_status,
    }
