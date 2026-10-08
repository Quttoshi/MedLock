import asyncio
import contextlib
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.rate_limit import limiter
from app.routers import auth, notifications, reports, access_requests, admin, doctor, medical_center, imaging, threads, patients, emergency
from app.services import background_jobs


@asynccontextmanager
async def lifespan(_app: FastAPI):
    task = asyncio.create_task(background_jobs.run_forever()) if settings.BACKGROUND_JOBS_ENABLED else None
    yield
    if task:
        task.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await task


app = FastAPI(title="MedLock API", version="1.0.0", lifespan=lifespan)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
# Before reports: its /reports/imaging/upload must not be shadowed by /reports/{report_id} routes.
app.include_router(imaging.router)
app.include_router(threads.router)
app.include_router(patients.router)
app.include_router(emergency.router)
app.include_router(reports.router)
app.include_router(notifications.router)
app.include_router(access_requests.router)
app.include_router(admin.router)
app.include_router(doctor.router)
app.include_router(medical_center.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
