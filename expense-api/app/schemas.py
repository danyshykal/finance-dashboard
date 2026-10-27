from datetime import date, datetime
from decimal import Decimal
from typing import Annotated, Self

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    PlainSerializer,
    StringConstraints,
    field_validator,
    model_validator,
)

# Input types: amounts are exact decimals with at most 2 places; categories are
# normalised so "Food", " food " and "FOOD" all group together in summaries.
Amount = Annotated[
    Decimal, Field(gt=0, max_digits=12, decimal_places=2, allow_inf_nan=False, examples=[12.5])
]
Category = Annotated[
    str, StringConstraints(strip_whitespace=True, to_lower=True, min_length=1, max_length=50)
]
Description = Annotated[str, StringConstraints(strip_whitespace=True, max_length=255)]

# Output type: send money as a JSON number rather than Pydantic's default string.
Money = Annotated[Decimal, PlainSerializer(float, return_type=float)]


def _not_in_future(value: date | None) -> date | None:
    if value is not None and value > date.today():
        raise ValueError("spent_on cannot be in the future")
    return value


class ExpenseCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    amount: Amount
    category: Category
    description: Description | None = None
    spent_on: date = Field(default_factory=date.today)

    _check_spent_on = field_validator("spent_on")(_not_in_future)


class ExpenseUpdate(BaseModel):
    """Partial update: only the fields sent are changed."""

    model_config = ConfigDict(extra="forbid")

    amount: Amount | None = None
    category: Category | None = None
    description: Description | None = None
    spent_on: date | None = None

    _check_spent_on = field_validator("spent_on")(_not_in_future)

    @model_validator(mode="after")
    def check_fields(self) -> Self:
        if not self.model_fields_set:
            raise ValueError("at least one field must be provided")
        # description may be cleared with null; the required columns may not.
        for name in ("amount", "category", "spent_on"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class ExpenseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    amount: Money
    category: str
    description: str | None
    spent_on: date
    created_at: datetime
    updated_at: datetime


class ExpenseList(BaseModel):
    items: list[ExpenseOut]
    total: int
    limit: int
    offset: int


class DateRange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    start_date: date | None = None
    end_date: date | None = None

    @model_validator(mode="after")
    def check_range(self) -> Self:
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValueError("start_date must be on or before end_date")
        return self


class ExpenseFilters(DateRange):
    category: Category | None = None
    limit: int = Field(50, ge=1, le=100)
    offset: int = Field(0, ge=0)


class CategoryTotal(BaseModel):
    category: str
    total: Money
    count: int


class CategorySummary(BaseModel):
    start_date: date | None
    end_date: date | None
    grand_total: Money
    categories: list[CategoryTotal]
