"""Shared rate limiter. It lives in its own module so routers can import it without
importing app.main (which imports the routers)."""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
