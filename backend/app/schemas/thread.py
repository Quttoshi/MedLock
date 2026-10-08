from typing import Optional

from pydantic import BaseModel


class StartThreadRequest(BaseModel):
    body: str
    # The doctor a patient is asking; ignored when a doctor starts the thread.
    doctor_id: Optional[str] = None


class PostMessageRequest(BaseModel):
    body: str
