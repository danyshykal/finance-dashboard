from decimal import Decimal
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import func, select

from app.models import Expense
from app.routers.expenses import DB, apply_date_range
from app.schemas import CategorySummary, DateRange

router = APIRouter(prefix="/summary", tags=["summary"])


@router.get("/by-category", response_model=CategorySummary)
def spending_by_category(dates: Annotated[DateRange, Query()], db: DB) -> dict:
    total = func.sum(Expense.amount)
    stmt = (
        select(Expense.category, total.label("total"), func.count().label("count"))
        .group_by(Expense.category)
        .order_by(total.desc(), Expense.category)
    )
    rows = db.execute(apply_date_range(stmt, dates)).mappings().all()
    return {
        "start_date": dates.start_date,
        "end_date": dates.end_date,
        "grand_total": sum((row["total"] for row in rows), Decimal("0")),
        "categories": rows,
    }
