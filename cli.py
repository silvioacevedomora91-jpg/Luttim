import argparse
import sqlite3
import sys
from typing import List

import service
from service import (
    EXPIRY_DAYS,
    MIN_REDEMPTION,
    NEAR_EXPIRY_DAYS,
    POINTS_PER_DOLLAR,
)


# ---------------------------------------------------------------------------
# Helpers de presentación
# ---------------------------------------------------------------------------

def _fmt_pts(n: int) -> str:
    return f"{n:,} pts"


def _fmt_usd(v: float) -> str:
    return f"${v:,.2f}"


def _divider(char: str = "─", width: int = 60) -> str:
    return char * width


def _header(title: str) -> None:
    print(_divider("═"))
    print(f"  {title}")
    print(_divider("═"))


# ---------------------------------------------------------------------------
# Subcomandos
# ---------------------------------------------------------------------------

def cmd_add_user(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    try:
        user = service.create_user(conn, args.name, args.email)
    except Exception as exc:
        _error(str(exc))
        return
    _header("Usuario creado")
    print(f"  ID     : {user.id}")
    print(f"  Nombre : {user.name}")
    print(f"  Email  : {user.email}")
    print(_divider())


def cmd_list_users(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    users = service.list_users(conn)
    if not users:
        print("No hay usuarios registrados.")
        return
    _header("Usuarios registrados")
    for u in users:
        print(f"  [{u.id}] {u.name} <{u.email}>")
    print(_divider())


def cmd_earn(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    try:
        tx = service.earn_points(conn, args.user_id, args.amount, args.desc or "")
    except Exception as exc:
        _error(str(exc))
        return
    _header("Puntos acreditados")
    print(f"  Monto pagado : {_fmt_usd(tx.amount_usd)}")
    print(f"  Puntos ganados: {_fmt_pts(tx.points)}")
    print(f"  Vencen el    : {tx.expires_at.strftime('%Y-%m-%d')}")
    print(f"  Descripción  : {tx.description or '—'}")
    _show_balance_inline(conn, args.user_id)


def cmd_redeem(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    try:
        tx = service.redeem_points(conn, args.user_id, args.points)
    except Exception as exc:
        _error(str(exc))
        return
    _header("Canje exitoso")
    print(f"  Puntos canjeados : {_fmt_pts(tx.points)}")
    print(f"  Dinero recibido  : {_fmt_usd(tx.amount_usd)}")
    _show_balance_inline(conn, args.user_id)


def cmd_balance(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    try:
        bal = service.get_balance(conn, args.user_id)
        user = service.get_user(conn, args.user_id)
    except Exception as exc:
        _error(str(exc))
        return
    _header(f"Saldo de puntos — {user.name}")
    print(f"  Puntos disponibles : {_fmt_pts(bal.redeemable_points)}")
    print(f"  Equivale a         : {_fmt_usd(bal.redeemable_usd)}")
    if bal.pending_expiry > 0:
        print(
            f"  ⚠  {_fmt_pts(bal.pending_expiry)} vencen en los próximos {NEAR_EXPIRY_DAYS} días"
        )
    print(_divider())
    print(f"  Tasa de conversión : {POINTS_PER_DOLLAR} pts = $1.00")
    print(f"  Mínimo para canjear: {_fmt_pts(MIN_REDEMPTION)}")
    print(_divider())


def cmd_history(conn: sqlite3.Connection, args: argparse.Namespace) -> None:
    try:
        txs = service.list_history(conn, args.user_id, limit=args.limit)
        user = service.get_user(conn, args.user_id)
    except Exception as exc:
        _error(str(exc))
        return
    if not txs:
        print("Sin transacciones aún.")
        return
    _header(f"Historial — {user.name} (últimas {len(txs)})")
    for tx in txs:
        tag = "+" if tx.type == "earn" else "-"
        exp = f"  vence {tx.expires_at.strftime('%Y-%m-%d')}" if tx.expires_at else ""
        print(
            f"  {tx.created_at.strftime('%Y-%m-%d %H:%M')}  "
            f"{tag}{_fmt_pts(tx.points):>12}  "
            f"{_fmt_usd(tx.amount_usd):>9}  "
            f"{tx.description[:28]:<28}{exp}"
        )
    print(_divider())


# ---------------------------------------------------------------------------
# Utilidades
# ---------------------------------------------------------------------------

def _show_balance_inline(conn: sqlite3.Connection, user_id: int) -> None:
    bal = service.get_balance(conn, user_id)
    print(_divider())
    print(
        f"  Saldo actual: {_fmt_pts(bal.redeemable_points)} "
        f"({_fmt_usd(bal.redeemable_usd)})"
    )
    print(_divider())


def _error(msg: str) -> None:
    print(f"\n  ERROR: {msg}\n", file=sys.stderr)


# ---------------------------------------------------------------------------
# Parser
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="luttim",
        description="Sistema de puntos y canje por dinero — Luttim",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # add-user
    p = sub.add_parser("add-user", help="Registrar nuevo usuario")
    p.add_argument("name", help="Nombre completo")
    p.add_argument("email", help="Correo electrónico")

    # list-users
    sub.add_parser("list-users", help="Listar todos los usuarios")

    # earn
    p = sub.add_parser("earn", help="Acreditar puntos por compra")
    p.add_argument("user_id", type=int, help="ID del usuario")
    p.add_argument("amount", type=float, help="Monto pagado en USD")
    p.add_argument("--desc", default="", help="Descripción de la compra")

    # redeem
    p = sub.add_parser("redeem", help="Canjear puntos por dinero")
    p.add_argument("user_id", type=int, help="ID del usuario")
    p.add_argument("points", type=int, help="Cantidad de puntos a canjear")

    # balance
    p = sub.add_parser("balance", help="Consultar saldo de puntos")
    p.add_argument("user_id", type=int, help="ID del usuario")

    # history
    p = sub.add_parser("history", help="Ver historial de transacciones")
    p.add_argument("user_id", type=int, help="ID del usuario")
    p.add_argument("--limit", type=int, default=20, help="Número de registros (default: 20)")

    return parser


def run(conn: sqlite3.Connection, argv: List[str] = None) -> None:
    parser = build_parser()
    args = parser.parse_args(argv)

    dispatch = {
        "add-user": cmd_add_user,
        "list-users": cmd_list_users,
        "earn": cmd_earn,
        "redeem": cmd_redeem,
        "balance": cmd_balance,
        "history": cmd_history,
    }
    dispatch[args.command](conn, args)
