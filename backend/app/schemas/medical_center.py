from datetime import date
from typing import Literal

from pydantic import BaseModel


class UpdateRegistrationRequest(BaseModel):
    """Licence details a pending or rejected center can correct before review."""
    regulator: Literal["PHC", "SHCC", "KPHCC", "IHRA"]
    license_number: str
    license_expires_at: date
    address: str
