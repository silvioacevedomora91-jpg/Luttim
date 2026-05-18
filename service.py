import sqlite3
from datetime import datetime, timedelta
from typing import List, Optional

from models import PointsBalance, Transaction, User

POINTS_PER_DOLLAR = 100       # 100 puntos = $1
MIN_REDEMPTION = 500          # mínimo 500 puntos para canjear
EXPIRY_DAYS = 365             # los puntos vencen en 1 año
NEAR_EXPIRY_DAYS = 30         # alerta si vencen en <30 días


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None
    return datetime.fromisoformat(value)


# ---------------------------------------------------------------------------
# Usuarios
# ---------------------------------------------------------------------------

def create_user(conn: sqlite3.Connection, name: str, email: str) -> User:
    email = email.strip().lower()
    cur = conn.execute(
        "INSERT INTO users (name, email) VALUES (?, ?)", (name, email)
    )
    conn.commit()
    row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    return User(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        created_at=_parse_dt(row["created_at"]),
    )


def get_user(conn: sqlite3.Connection, user_id: int) -> Optional[User]:
    row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        return None
    return User(
        id=row["id"],
        name=row["name"],
        email=row["email"],
        created_at=_parse_dt(row["created_at"]),
    )


def list_users(conn: sqlite3.Connection) -> List[User]:
    rows = conn.execute("SELECT * FROM users ORDER BY id").fetchall()
    return [
        User(id=r["id"], name=r["name"], email=r["email"], created_at=_parse_dt(r["created_at"]))
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Puntos
# ---------------------------------------------------------------------------

def earn_points(
    conn: sqlite3.Connection,
    user_id: int,
    amount_usd: float,
    description: str = "",
) -> Transaction:
    if get_user(conn, user_id) is None:
        raise ValueError(f"Usuario {user_id} no encontrado.")
    if amount_usd <= 0:
        raise ValueError("El monto debe ser mayor a $0.")

    points = int(amount_usd * POINTS_PER_DOLLAR)
    expires_at = datetime.now() + timedelta(days=EXPIRY_DAYS)

    cur = conn.execute(
        """INSERT INTO transactions (user_id, type, points, amount_usd, description, expires_at)
           VALUES (?, 'earn', ?, ?, ?, ?)""",
        (user_id, points, amount_usd, description, expires_at.isoformat()),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM transactions WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row_to_transaction(row)


def get_balance(conn: sqlite3.Connection, user_id: int) -> PointsBalance:
    if get_user(conn, user_id) is None:
        raise ValueError(f"Usuario {user_id} no encontrado.")

    now = datetime.now().isoformat()
    near = (datetime.now() + timedelta(days=NEAR_EXPIRY_DAYS)).isoformat()

    earned = conn.execute(
        """SELECT COALESCE(SUM(points), 0) FROM transactions
           WHERE user_id = ? AND type = 'earn'""",
        (user_id,),
    ).fetchone()[0]

    redeemed = conn.execute(
        """SELECT COALESCE(SUM(points), 0) FROM transactions
           WHERE user_id = ? AND type = 'redeem'""",
        (user_id,),
    ).fetchone()[0]

    expired = conn.execute(
        """SELECT COALESCE(SUM(points), 0) FROM transactions
           WHERE user_id = ? AND type = 'earn' AND expires_at <= ?""",
        (user_id, now),
    ).fetchone()[0]

    pending_expiry = conn.execute(
        """SELECT COALESCE(SUM(points), 0) FROM transactions
           WHERE user_id = ? AND type = 'earn'
             AND expires_at > ? AND expires_at <= ?""",
        (user_id, now, near),
    ).fetchone()[0]

    redeemable = max(0, earned - redeemed - expired)

    return PointsBalance(
        user_id=user_id,
        total_points=max(0, earned - redeemed - expired),
        redeemable_points=redeemable,
        pending_expiry=pending_expiry,
    )


def redeem_points(
    conn: sqlite3.Connection,
    user_id: int,
    points: int,
) -> Transaction:
    if get_user(conn, user_id) is None:
        raise ValueError(f"Usuario {user_id} no encontrado.")
    if points < MIN_REDEMPTION:
        raise ValueError(
            f"Mínimo para canjear: {MIN_REDEMPTION} puntos "
            f"(${MIN_REDEMPTION / POINTS_PER_DOLLAR:.2f})."
        )

    balance = get_balance(conn, user_id)
    if points > balance.redeemable_points:
        raise ValueError(
            f"Puntos insuficientes. Disponibles: {balance.redeemable_points}."
        )

    amount_usd = points / POINTS_PER_DOLLAR
    cur = conn.execute(
        """INSERT INTO transactions (user_id, type, points, amount_usd, description)
           VALUES (?, 'redeem', ?, ?, 'Canje de puntos por efectivo')""",
        (user_id, points, amount_usd),
    )
    conn.commit()
    row = conn.execute("SELECT * FROM transactions WHERE id = ?", (cur.lastrowid,)).fetchone()
    return _row_to_transaction(row)


def list_history(
    conn: sqlite3.Connection,
    user_id: int,
    limit: int = 20,
) -> List[Transaction]:
    rows = conn.execute(
        """SELECT * FROM transactions WHERE user_id = ?
           ORDER BY created_at DESC LIMIT ?""",
        (user_id, limit),
    ).fetchall()
    return [_row_to_transaction(r) for r in rows]


def _row_to_transaction(row: sqlite3.Row) -> Transaction:
    return Transaction(
        id=row["id"],
        user_id=row["user_id"],
        type=row["type"],
        points=row["points"],
        amount_usd=row["amount_usd"],
        description=row["description"],
        created_at=_parse_dt(row["created_at"]),
        expires_at=_parse_dt(row["expires_at"]),
    )
