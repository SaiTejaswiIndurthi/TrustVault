import logging
import httpx
from backend.app.config import settings

logger = logging.getLogger(__name__)

async def verify_captcha_token(token: str, remote_ip: str = None) -> tuple[bool, str]:
    """
    Validates a CAPTCHA response token against the configured provider.
    Returns (is_valid: bool, reason: str).
    Never trusts frontend claims.
    """
    if not token or not token.strip():
        return False, "CAPTCHA token is missing"

    token = token.strip()

    # Development fallback mode
    if settings.CAPTCHA_PROVIDER == "dev":
        if token == settings.DEV_CAPTCHA_PASSKEY or token.startswith("TRUSTVAULT_DEV_PASSED_"):
            return True, "Development mode token verified"
        return False, "Invalid development CAPTCHA token"

    # Cloudflare Turnstile Verification
    if settings.CAPTCHA_PROVIDER == "turnstile":
        verify_url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
        payload = {
            "secret": settings.CAPTCHA_SECRET_KEY,
            "response": token,
        }
        if remote_ip:
            payload["remoteip"] = remote_ip
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(verify_url, data=payload)
                if res.status_code != 200:
                    logger.error(f"Turnstile verification request failed: {res.status_code}")
                    return False, "CAPTCHA provider unreachable"
                data = res.json()
                if data.get("success"):
                    return True, "Turnstile verification successful"
                error_codes = data.get("error-codes", [])
                return False, f"Turnstile rejection: {','.join(error_codes)}"
        except Exception as e:
            logger.error(f"Exception contacting Turnstile: {e}")
            return False, "CAPTCHA service error"

    # Google reCAPTCHA Verification
    if settings.CAPTCHA_PROVIDER == "recaptcha":
        verify_url = "https://www.google.com/recaptcha/api/siteverify"
        payload = {
            "secret": settings.CAPTCHA_SECRET_KEY,
            "response": token,
        }
        if remote_ip:
            payload["remoteip"] = remote_ip
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(verify_url, data=payload)
                if res.status_code != 200:
                    logger.error(f"reCAPTCHA verification request failed: {res.status_code}")
                    return False, "reCAPTCHA provider unreachable"
                data = res.json()
                if data.get("success"):
                    return True, "reCAPTCHA verification successful"
                error_codes = data.get("error-codes", [])
                return False, f"reCAPTCHA rejection: {','.join(error_codes)}"
        except Exception as e:
            logger.error(f"Exception contacting reCAPTCHA: {e}")
            return False, "CAPTCHA service error"

    return False, "Unsupported CAPTCHA provider configuration"
