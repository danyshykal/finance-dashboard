from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import Select, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Expense
from app.schemas import (
    DateRange,
    ExpenseCreate,
    ExpenseFilters,
    ExpenseList,
    ExpenseOut,
    ExpenseUpdate,
)

router = APIRouter(prefix="/expenses", tags=["expenses"])

DB = Annotated[Session, Depends(get_db)]


def apply_date_range(stmt: Select, dates: DateRange) -> Select:
    if dates.start_date:
        stmt = stmt.where(Expense.spent_on >= dates.start_date)
    if dates.end_date:
        stmt = stmt.where(Expense.spent_on <= dates.end_date)
    return stmt


def get_expense_or_404(db: Session, expense_id: int) -> Expense:
    expense = db.get(Expense, expense_id)
    if expense is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"Expense {expense_id} not found")
    return expense


@router.post("", response_model=ExpenseOut, status_code=status.HTTP_201_CREATED)
def create_expense(payload: ExpenseCreate, db: DB) -> Expense:
    expense = Expense(**payload.model_dump())
    db.add(expense)
    db.commit()
    db.refresh(expense)
    return expense


@router.get("", response_model=ExpenseList)
def list_expenses(filters: Annotated[ExpenseFilters, Query()], db: DB) -> dict:
    stmt = apply_date_range(select(Expense), filters)
    if filters.category:
        stmt = stmt.where(Expense.category == filters.category)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    items = db.scalars(
        stmt.order_by(Expense.spent_on.desc(), Expense.id.desc())
        .limit(filters.limit)
        .offset(filters.offset)
    ).all()
    return {"items": items, "total": total, "limit": filters.limit, "offset": filters.offset}


@router.get("/{expense_id}", response_model=ExpenseOut)
def get_expense(expense_id: int, db: DB) -> Expense:
    return get_expense_or_404(db, expense_id)


@router.patch("/{expense_id}", response_model=ExpenseOut)
def update_expense(expense_id: int, payload: ExpenseUpdate, db: DB) -> Expense:
    expense = get_expense_or_404(db, expense_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(expense_id: int, db: DB) -> Response:
    expense = get_expense_or_404(db, expense_id)
    db.delete(expense)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
