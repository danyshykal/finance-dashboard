from datetime import date, timedelta

import pytest


def field_errors(response):
    return {d["field"]: d["message"] for d in response.json()["error"]["details"]}


# --- create -----------------------------------------------------------------


def test_create_expense(client):
    response = client.post(
        "/expenses",
        json={"amount": "42.50", "category": "  Groceries ", "description": "Weekly shop", "spent_on": "2026-03-01"},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["id"] == 1
    assert body["amount"] == 42.5
    assert body["category"] == "groceries"
    assert body["description"] == "Weekly shop"
    assert body["spent_on"] == "2026-03-01"
    assert "created_at" in body and "updated_at" in body


def test_create_defaults_spent_on_to_today(client):
    response = client.post("/expenses", json={"amount": 5, "category": "coffee"})

    assert response.status_code == 201
    assert response.json()["spent_on"] == date.today().isoformat()
    assert response.json()["description"] is None


@pytest.mark.parametrize(
    ("payload", "field", "message"),
    [
        ({"category": "food"}, "body.amount", "Field required"),
        ({"amount": 10}, "body.category", "Field required"),
        ({"amount": 0, "category": "food"}, "body.amount", "Input should be greater than 0"),
        ({"amount": -5, "category": "food"}, "body.amount", "Input should be greater than 0"),
        ({"amount": "12.345", "category": "food"}, "body.amount", "Decimal input should have no more than 2 decimal places"),
        ({"amount": "abc", "category": "food"}, "body.amount", "Input should be a valid decimal"),
        ({"amount": "NaN", "category": "food"}, "body.amount", "Input should be a finite number"),
        ({"amount": 10, "category": "   "}, "body.category", "String should have at least 1 character"),
        ({"amount": 10, "category": "x" * 51}, "body.category", "String should have at most 50 characters"),
        ({"amount": 10, "category": "food", "spent_on": "not-a-date"}, "body.spent_on", None),
        ({"amount": 10, "category": "food", "spent_on": (date.today() + timedelta(days=1)).isoformat()},
         "body.spent_on", "spent_on cannot be in the future"),
        ({"amount": 10, "category": "food", "user_id": 7}, "body.user_id", "Extra inputs are not permitted"),
    ],
)
def test_create_rejects_invalid_payload(client, payload, field, message):
    response = client.post("/expenses", json=payload)

    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert error["message"] == "Request validation failed"
    errors = field_errors(response)
    assert field in errors
    if message:
        assert errors[field] == message


def test_create_rejects_malformed_json(client):
    response = client.post("/expenses", content="{not json", headers={"Content-Type": "application/json"})

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "validation_error"


# --- retrieve ---------------------------------------------------------------


def test_get_expense(client, make_expense):
    created = make_expense(amount=12.99, category="transport")

    response = client.get(f"/expenses/{created['id']}")

    assert response.status_code == 200
    assert response.json() == created


def test_get_missing_expense_returns_404(client):
    response = client.get("/expenses/999")

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Expense 999 not found"}}


def test_get_with_non_integer_id_is_validation_error(client):
    response = client.get("/expenses/abc")

    assert response.status_code == 422
    assert "path.expense_id" in field_errors(response)


def test_list_expenses_newest_first(client, make_expense):
    make_expense(spent_on="2026-01-01")
    make_expense(spent_on="2026-03-01")
    make_expense(spent_on="2026-02-01")

    response = client.get("/expenses")

    assert response.status_code == 200
    body = response.json()
    assert body["total"] == 3
    assert [e["spent_on"] for e in body["items"]] == ["2026-03-01", "2026-02-01", "2026-01-01"]


def test_list_filters_by_category_and_dates(client, make_expense):
    make_expense(category="food", spent_on="2026-01-10")
    make_expense(category="food", spent_on="2026-02-10")
    make_expense(category="rent", spent_on="2026-02-10")
    make_expense(category="food", spent_on="2026-03-10")

    response = client.get(
        "/expenses", params={"category": "FOOD", "start_date": "2026-02-01", "end_date": "2026-03-31"}
    )

    body = response.json()
    assert body["total"] == 2
    assert {(e["category"], e["spent_on"]) for e in body["items"]} == {
        ("food", "2026-02-10"),
        ("food", "2026-03-10"),
    }


def test_list_pagination(client, make_expense):
    for day in range(1, 6):
        make_expense(spent_on=f"2026-01-0{day}")

    response = client.get("/expenses", params={"limit": 2, "offset": 2})

    body = response.json()
    assert body["total"] == 5
    assert body["limit"] == 2 and body["offset"] == 2
    assert [e["spent_on"] for e in body["items"]] == ["2026-01-03", "2026-01-02"]


@pytest.mark.parametrize(
    ("params", "field"),
    [
        ({"limit": 0}, "query.limit"),
        ({"limit": 101}, "query.limit"),
        ({"offset": -1}, "query.offset"),
        ({"start_date": "2026-13-01"}, "query.start_date"),
        ({"start_date": "2026-05-01", "end_date": "2026-04-01"}, "query"),
    ],
)
def test_list_rejects_invalid_query(client, params, field):
    response = client.get("/expenses", params=params)

    assert response.status_code == 422
    assert field in field_errors(response)


# --- update -----------------------------------------------------------------


def test_partial_update_changes_only_sent_fields(client, make_expense):
    created = make_expense(amount=10, category="food", description="Lunch")

    response = client.patch(f"/expenses/{created['id']}", json={"amount": "15.25"})

    assert response.status_code == 200
    body = response.json()
    assert body["amount"] == 15.25
    assert body["category"] == "food"
    assert body["description"] == "Lunch"
    assert body["updated_at"] >= created["updated_at"]
    assert client.get(f"/expenses/{created['id']}").json()["amount"] == 15.25


def test_update_can_clear_description(client, make_expense):
    created = make_expense(description="Lunch")

    response = client.patch(f"/expenses/{created['id']}", json={"description": None})

    assert response.status_code == 200
    assert response.json()["description"] is None


@pytest.mark.parametrize(
    ("payload", "message"),
    [
        ({}, "at least one field must be provided"),
        ({"amount": None}, "amount cannot be null"),
        ({"category": None}, "category cannot be null"),
    ],
)
def test_update_rejects_empty_or_null_required_fields(client, make_expense, payload, message):
    created = make_expense()

    response = client.patch(f"/expenses/{created['id']}", json=payload)

    assert response.status_code == 422
    assert field_errors(response)["body"] == message


def test_update_validates_values(client, make_expense):
    created = make_expense()

    response = client.patch(f"/expenses/{created['id']}", json={"amount": -1, "category": ""})

    assert response.status_code == 422
    assert set(field_errors(response)) == {"body.amount", "body.category"}


def test_update_missing_expense_returns_404(client):
    response = client.patch("/expenses/999", json={"amount": 1})

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


# --- delete -----------------------------------------------------------------


def test_delete_expense(client, make_expense):
    created = make_expense()

    response = client.delete(f"/expenses/{created['id']}")

    assert response.status_code == 204
    assert response.content == b""
    assert client.get(f"/expenses/{created['id']}").status_code == 404


def test_delete_missing_expense_returns_404(client):
    response = client.delete("/expenses/999")

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


# --- misc -------------------------------------------------------------------


def test_health(client):
    assert client.get("/health").json() == {"status": "ok"}


def test_unknown_route_uses_error_shape(client):
    response = client.get("/nope")

    assert response.status_code == 404
    assert response.json() == {"error": {"code": "not_found", "message": "Not Found"}}


def test_wrong_method_uses_error_shape(client):
    response = client.put("/expenses")

    assert response.status_code == 405
    assert response.json()["error"]["code"] == "method_not_allowed"
