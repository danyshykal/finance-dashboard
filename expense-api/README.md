# Expense Tracker API

A REST API for recording expenses and seeing spending by category.

**Stack:** Python 3.12+ · FastAPI · SQLAlchemy 2 · PostgreSQL (psycopg 3) · Pydantic v2 · pytest

## Setup

```powershell
cd expense-api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

copy .env.example .env      # then put your PostgreSQL password in both URLs
python -m app.create_db     # creates expense_tracker and expense_tracker_test
```

## Run

```powershell
uvicorn app.main:app --reload
```

The `expenses` table is created on startup. Interactive docs are at <http://localhost:8000/docs>.

## Test

```powershell
pytest
```

Tests run against `TEST_DATABASE_URL` (created automatically if missing) and wipe its tables between tests.

## Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/expenses` | Create an expense → `201` |
| `GET` | `/expenses` | List expenses, newest first. Query: `category`, `start_date`, `end_date`, `limit` (1–100, default 50), `offset` |
| `GET` | `/expenses/{id}` | Get one expense |
| `PATCH` | `/expenses/{id}` | Update only the fields sent |
| `DELETE` | `/expenses/{id}` | Delete → `204` |
| `GET` | `/summary/by-category` | Total and count per category, largest first. Query: `start_date`, `end_date` |
| `GET` | `/health` | Liveness check |

### Example

```http
POST /expenses
{"amount": 42.50, "category": "Groceries", "description": "Weekly shop", "spent_on": "2026-03-01"}
```

```json
201 Created
{
  "id": 1, "amount": 42.5, "category": "groceries", "description": "Weekly shop",
  "spent_on": "2026-03-01", "created_at": "2026-03-01T10:15:00Z", "updated_at": "2026-03-01T10:15:00Z"
}
```

```http
GET /summary/by-category?start_date=2026-03-01&end_date=2026-03-31
```

```json
{
  "start_date": "2026-03-01", "end_date": "2026-03-31", "grand_total": 542.5,
  "categories": [
    {"category": "rent", "total": 500.0, "count": 1},
    {"category": "groceries", "total": 42.5, "count": 1}
  ]
}
```

## Validation rules

- `amount`: required, greater than 0, at most 2 decimal places. Stored as `NUMERIC(12,2)`, so totals are exact.
- `category`: required, 1–50 characters. Whitespace is trimmed and it is lower-cased, so `Food` and `food` are one category.
- `description`: optional, up to 255 characters. Send `null` in a `PATCH` to clear it.
- `spent_on`: ISO date, defaults to today, can't be in the future.
- Unknown fields and unknown query parameters are rejected.
- `start_date` must be on or before `end_date`.

## Errors

Every error has the same shape:

```json
422 Unprocessable Entity
{
  "error": {
    "code": "validation_error",
    "message": "Request validation failed",
    "details": [{"field": "body.amount", "message": "Input should be greater than 0"}]
  }
}
```

`code` is one of `validation_error` (422), `not_found` (404), `method_not_allowed` (405) or `error` (500).

## Layout

```
app/
  main.py          app setup, startup table creation
  config.py        settings from .env
  database.py      engine, session, get_db dependency
  models.py        Expense table
  schemas.py       request validation and response models
  errors.py        uniform JSON error handlers
  create_db.py     creates the dev and test databases
  routers/
    expenses.py    CRUD endpoints
    summary.py     spending by category
tests/             API tests (pytest + FastAPI TestClient)
```
