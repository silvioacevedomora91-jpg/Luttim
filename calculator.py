#!/usr/bin/env python3
"""
Calculadora — Luttim

Uso interactivo:
  python calculator.py

Uso directo:
  python calculator.py "3 + 4 * 2"
  python calculator.py "sqrt(16)"
  python calculator.py "10 % 3"
"""

import math
import operator
import re
import sys
from typing import Union

Number = Union[int, float]

# ---------------------------------------------------------------------------
# Motor de cálculo
# ---------------------------------------------------------------------------

OPERATORS = {
    "+": operator.add,
    "-": operator.sub,
    "*": operator.mul,
    "/": operator.truediv,
    "//": operator.floordiv,
    "%": operator.mod,
    "^": operator.pow,
}

FUNCTIONS = {
    "sqrt": math.sqrt,
    "cbrt": lambda x: math.copysign(abs(x) ** (1 / 3), x),
    "abs":  abs,
    "log":  math.log10,
    "ln":   math.log,
    "sin":  lambda x: math.sin(math.radians(x)),
    "cos":  lambda x: math.cos(math.radians(x)),
    "tan":  lambda x: math.tan(math.radians(x)),
    "ceil": math.ceil,
    "floor": math.floor,
    "round": round,
    "fact": math.factorial,
}

CONSTANTS = {
    "pi":  math.pi,
    "e":   math.e,
    "tau": math.tau,
    "inf": math.inf,
}


def evaluate(expression: str) -> Number:
    """Evalúa una expresión matemática de forma segura."""
    expr = expression.strip()
    if not expr:
        raise ValueError("Expresión vacía.")

    # Reemplaza constantes
    for name, val in CONSTANTS.items():
        expr = re.sub(rf"\b{name}\b", str(val), expr)

    # Reemplaza ^ por ** (potencia estilo matemático)
    expr = expr.replace("^", "**")

    # Construye namespace seguro con funciones permitidas
    safe_ns = {fn: func for fn, func in FUNCTIONS.items()}
    safe_ns["__builtins__"] = {}

    try:
        result = eval(expr, safe_ns)  # noqa: S307 — namespace restringido
    except ZeroDivisionError:
        raise ZeroDivisionError("División por cero.")
    except Exception as exc:
        raise ValueError(f"Expresión inválida: {exc}") from exc

    if not isinstance(result, (int, float)):
        raise ValueError("El resultado no es un número.")
    if math.isnan(result):
        raise ValueError("Resultado indefinido (NaN).")

    return result


# ---------------------------------------------------------------------------
# Presentación
# ---------------------------------------------------------------------------

def _fmt(value: Number) -> str:
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    if isinstance(value, float):
        # Hasta 10 decimales significativos, sin ceros finales
        return f"{value:.10g}"
    return str(value)


def _divider(char: str = "─", width: int = 50) -> str:
    return char * width


def _banner() -> None:
    print(_divider("═"))
    print("  Calculadora Luttim")
    print("  Operadores : + - * / // % ^")
    print("  Funciones  : sqrt, cbrt, abs, log, ln,")
    print("               sin, cos, tan, ceil, floor,")
    print("               round, fact")
    print("  Constantes : pi, e, tau, inf")
    print("  Salir      : q / exit / Ctrl-C")
    print(_divider("═"))


def _print_result(expr: str, result: Number) -> None:
    print(_divider())
    print(f"  {expr} = {_fmt(result)}")
    print(_divider())


def _print_error(msg: str) -> None:
    print(f"\n  ERROR: {msg}\n")


# ---------------------------------------------------------------------------
# Modos de uso
# ---------------------------------------------------------------------------

def run_once(expression: str) -> None:
    """Evalúa una sola expresión pasada como argumento."""
    try:
        result = evaluate(expression)
        _print_result(expression, result)
    except Exception as exc:
        _print_error(str(exc))
        sys.exit(1)


def run_interactive() -> None:
    """Bucle interactivo REPL."""
    _banner()
    history: list[tuple[str, Number]] = []

    while True:
        try:
            raw = input("  > ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\n  Hasta luego.")
            break

        if not raw:
            continue
        if raw.lower() in {"q", "quit", "exit", "salir"}:
            print("  Hasta luego.")
            break
        if raw.lower() in {"h", "historial", "history"}:
            if not history:
                print("  Sin historial aún.")
            else:
                print(_divider())
                for i, (expr, res) in enumerate(history, 1):
                    print(f"  {i:>3}. {expr} = {_fmt(res)}")
                print(_divider())
            continue
        if raw.lower() in {"c", "clear", "limpiar"}:
            history.clear()
            print("  Historial borrado.")
            continue

        try:
            result = evaluate(raw)
            _print_result(raw, result)
            history.append((raw, result))
        except Exception as exc:
            _print_error(str(exc))


# ---------------------------------------------------------------------------
# Punto de entrada
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if len(sys.argv) > 1:
        run_once(" ".join(sys.argv[1:]))
    else:
        run_interactive()
