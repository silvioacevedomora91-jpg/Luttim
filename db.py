import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "luttim.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            name       TEXT    NOT NULL,
            email      TEXT    NOT NULL UNIQUE,
            created_at TEXT    NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS transactions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL REFERENCES users(id),
            type        TEXT    NOT NULL CHECK(type IN ('earn', 'redeem')),
            points      INTEGER NOT NULL CHECK(points > 0),
            amount_usd  REAL    NOT NULL,
            description TEXT    NOT NULL DEFAULT '',
            created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
            expires_at  TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_tx_user ON transactions(user_id);
    """)
    conn.commit()
