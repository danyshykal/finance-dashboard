from contextlib import asynccontextmanager

from fastapi import FastAPI

from app import models  # noqa: F401  (registers tables on Base.metadata)
from app.database import Base, engine
from app.errors import register_exception_handlers
from app.routers import expenses, summary


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    yield


app = FastAPI(
    title="Expense Tracker API",
    version="1.0.0",
    description="Track expenses and see spending by category.",
    lifespan=lifespan,
)
register_exception_handlers(app)
app.include_router(expenses.router)
app.include_router(summary.router)


@app.get("/health", tags=["health"])
def health() -> dict:
    return {"status": "ok"}
