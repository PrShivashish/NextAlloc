import hmac

from fastapi import Header, HTTPException, status

from app.core.config import settings


async def verify_api_key(x_api_key: str = Header(...)):
    """Service-to-service auth: the NestJS backend sends a shared secret in X-API-Key.

    Compared in constant time so the key can't be recovered via response timing.
    """
    if not hmac.compare_digest(x_api_key.encode(), settings.API_KEY.encode()):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API Key")
    return x_api_key
