"""
migrate_sqlite_to_pg.py
=======================
One-time script to migrate the local SQLite database to a hosted
PostgreSQL database (e.g., Neon).

Usage
-----
From the backend/ directory, with both DATABASE_URL env vars set:

    # Set source (SQLite) and target (Postgres) URLs
    set SQLITE_URL=sqlite:///./talentlens.db
    set PG_URL=postgresql+psycopg://user:pass@host/db?sslmode=require

    python scripts/migrate_sqlite_to_pg.py

How it works
------------
1. Reflects all tables from SQLite using SQLAlchemy.
2. Creates the same tables on PostgreSQL using the ORM models.
3. Copies every row table-by-table, skipping file-path blobs that don't
   exist in a cloud environment (Resume_File_Path content).

NOTE: Run this ONCE before your first Render deploy. Re-running is safe —
the script skips tables that already have data in Postgres.
"""

import os
import sys

# ── Add backend/ to path so we can import models ──────────────────────────────
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text, inspect
from sqlalchemy.orm import sessionmaker
import models  # noqa: F401  — registers all ORM models


def make_engine(url: str):
    kwargs = {}
    if url.startswith("sqlite"):
        kwargs["connect_args"] = {"check_same_thread": False}
    else:
        kwargs["pool_pre_ping"] = True
    return create_engine(url, **kwargs)


def migrate():
    sqlite_url = os.getenv("SQLITE_URL", "sqlite:///./talentlens.db")
    pg_url = os.getenv("PG_URL")

    if not pg_url:
        print("ERROR: Set the PG_URL environment variable to your Neon connection string.")
        print("  Example: set PG_URL=postgresql+psycopg://user:pass@host/db?sslmode=require")
        sys.exit(1)

    print(f"Source : {sqlite_url}")
    print(f"Target : {pg_url[:40]}...")

    src_engine = make_engine(sqlite_url)
    tgt_engine = make_engine(pg_url)

    # Create all tables on Postgres using ORM models
    print("\n[1/3] Creating tables on PostgreSQL...")
    models.Base.metadata.create_all(bind=tgt_engine)
    print("      Tables created (or already exist).")

    # Reflect table names from SQLite
    inspector = inspect(src_engine)
    table_names = inspector.get_table_names()
    print(f"\n[2/3] Found {len(table_names)} tables in SQLite: {table_names}")

    SrcSession = sessionmaker(bind=src_engine)
    TgtSession = sessionmaker(bind=tgt_engine)

    src_session = SrcSession()
    tgt_session = TgtSession()

    skipped = []
    migrated = []

    for table in table_names:
        # Check if Postgres table already has rows
        try:
            existing_count = tgt_session.execute(
                text(f'SELECT COUNT(*) FROM "{table}"')
            ).scalar()
        except Exception:
            existing_count = 0

        if existing_count and existing_count > 0:
            print(f"  SKIP  {table:40s} (already has {existing_count} rows in Postgres)")
            skipped.append(table)
            continue

        # Fetch all rows from SQLite
        try:
            rows = src_session.execute(text(f'SELECT * FROM "{table}"')).mappings().all()
        except Exception as e:
            print(f"  ERROR {table}: {e}")
            continue

        if not rows:
            print(f"  EMPTY {table:40s} (0 rows — nothing to migrate)")
            continue

        # Insert into Postgres
        try:
            col_names = list(rows[0].keys())
            placeholders = ", ".join([f":{c}" for c in col_names])
            columns = ", ".join([f'"{c}"' for c in col_names])
            insert_sql = text(
                f'INSERT INTO "{table}" ({columns}) VALUES ({placeholders}) '
                f'ON CONFLICT DO NOTHING'
            )
            for row in rows:
                tgt_session.execute(insert_sql, dict(row))
            tgt_session.commit()
            print(f"  OK    {table:40s} ({len(rows)} rows migrated)")
            migrated.append(table)
        except Exception as e:
            tgt_session.rollback()
            print(f"  FAIL  {table}: {e}")

    src_session.close()
    tgt_session.close()

    print(f"\n[3/3] Migration complete.")
    print(f"      Migrated : {len(migrated)} tables")
    print(f"      Skipped  : {len(skipped)} tables (already had data)")
    print("\nDone! You can now deploy your backend to Render.")


if __name__ == "__main__":
    migrate()
