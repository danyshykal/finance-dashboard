"""Create the dev and test databases named in .env if they don't exist yet.

    python -m app.create_db
"""

from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url

from app.config import get_settings, to_sqlalchemy_url


def create_database(url: str) -> None:
    target = make_url(to_sqlalchemy_url(url))
    # Connect to the default "postgres" database; CREATE DATABASE can't run in a transaction.
    admin = create_engine(target.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        exists = conn.scalar(
            text("SELECT 1 FROM pg_database WHERE datname = :name"), {"name": target.database}
        )
        if exists:
            print(f"{target.database}: already exists")
        else:
            conn.execute(text(f'CREATE DATABASE "{target.database}"'))
            print(f"{target.database}: created")
    admin.dispose()


if __name__ == "__main__":
    settings = get_settings()
    create_database(settings.database_url)
    create_database(settings.test_database_url)
