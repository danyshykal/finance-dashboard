def test_summary_with_no_expenses(client):
    response = client.get("/summary/by-category")

    assert response.status_code == 200
    assert response.json() == {"start_date": None, "end_date": None, "grand_total": 0, "categories": []}


def test_summary_totals_by_category(client, make_expense):
    make_expense(amount="10.10", category="food")
    make_expense(amount="20.20", category="Food")
    make_expense(amount="500", category="rent")
    make_expense(amount="0.10", category="coffee")
    make_expense(amount="0.20", category="coffee")

    response = client.get("/summary/by-category")

    assert response.status_code == 200
    body = response.json()
    # Sorted by total, largest first; exact decimal arithmetic (0.1 + 0.2 == 0.3).
    assert body["categories"] == [
        {"category": "rent", "total": 500.0, "count": 1},
        {"category": "food", "total": 30.3, "count": 2},
        {"category": "coffee", "total": 0.3, "count": 2},
    ]
    assert body["grand_total"] == 530.6


def test_summary_respects_date_range(client, make_expense):
    make_expense(amount=100, category="food", spent_on="2026-01-31")
    make_expense(amount=25, category="food", spent_on="2026-02-01")
    make_expense(amount=75, category="travel", spent_on="2026-02-28")
    make_expense(amount=100, category="travel", spent_on="2026-03-01")

    response = client.get("/summary/by-category", params={"start_date": "2026-02-01", "end_date": "2026-02-28"})

    body = response.json()
    assert body["start_date"] == "2026-02-01" and body["end_date"] == "2026-02-28"
    assert body["categories"] == [
        {"category": "travel", "total": 75.0, "count": 1},
        {"category": "food", "total": 25.0, "count": 1},
    ]
    assert body["grand_total"] == 100.0


def test_summary_rejects_inverted_date_range(client):
    response = client.get("/summary/by-category", params={"start_date": "2026-03-01", "end_date": "2026-02-01"})

    assert response.status_code == 422
    assert response.json()["error"]["details"] == [
        {"field": "query", "message": "start_date must be on or before end_date"}
    ]
