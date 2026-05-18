#!/usr/bin/env python3
"""
Luttim — Sistema de puntos y canje por dinero.

Uso rápido:
  python main.py add-user "Ana García" ana@ejemplo.com
  python main.py earn 1 50.00 --desc "Compra supermercado"
  python main.py balance 1
  python main.py redeem 1 500
  python main.py history 1
"""
import sys

import cli
import db


def main() -> None:
    conn = db.get_connection()
    db.init_db(conn)
    try:
        cli.run(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
