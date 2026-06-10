import jwt
from fastapi import Header

def get_user_id(authorization: str = Header(None)) -> str | None:
    if not authorization or not authorization.startswith("Bearer "):
        return None
    token = authorization.split(" ")[1]
    try:
        # Decode JWT without verifying signature since user ID is used for context filtering.
        # This is safe because routing relies on supabase client for actual DB permissions.
        decoded = jwt.decode(token, options={"verify_signature": False})
        return decoded.get("sub")
    except Exception as e:
        print("Failed to decode token in get_user_id:", e)
        return None
