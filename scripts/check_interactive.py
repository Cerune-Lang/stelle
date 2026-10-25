#!/usr/bin/env python3
"""Smoke-test interactive Stelle using piped input on four Cerune routes."""
import argparse
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ROUTES = (("IR", ("run",)), ("MIR", ("run-mir",)),
          ("SSA", ("run-mir", "--ssa")), ("VM", ("run-vm",)))
SCENARIOS = (
    ("win", b"1\n1\n1\n", "You win!\n", 3, 0),
    ("escape", b"3\n", "You escaped.\n", 1, 0),
    ("invalid_then_escape", b"9\n3\n", "You escaped.\n", 2, 1),
    ("heal_eof", b"2\n", "Input ended.\n", 2, 0),
    ("no_potions_loss", b"2\n2\n2\n2\n2\n", "Game over.\n", 5, 0),
    ("crlf_escape", b"3\r\n", "You escaped.\n", 1, 0),
    ("no_newline_escape", b"3", "You escaped.\n", 1, 0),
    ("immediate_eof", b"", "Input ended.\n", 1, 0),
)
TERMINALS = ("You win!\n", "You escaped.\n", "Game over.\n", "Input ended.\n")

def verify(output, scenario):
    name, _, ending, prompts, invalid = scenario
    text = output.decode("utf-8")
    if not text.startswith("Stelle\nA slime appears!\n"):
        return f"{name}: missing intro"
    if text.count("Choose an action:\n") != prompts:
        return f"{name}: wrong prompt count"
    if text.count("Invalid action. Enter 1, 2 or 3.\n") != invalid:
        return f"{name}: wrong invalid-input count"
    if text.count(">\n") != prompts:
        return f"{name}: wrong input marker count"
    if not text.endswith(ending):
        return f"{name}: wrong final result {text[-80:]!r}"
    if sum(text.count(item) for item in TERMINALS) != 1:
        return f"{name}: incorrect terminal message count"
    if name == "win" and (text.count("You attack for 4.\n") != 3
                          or text.count("Slime attacks for 2.\n") != 2):
        return "win: unexpected combat sequence"
    if name == "no_potions_loss" and (text.count("No potions left.\n") != 4
                                       or text.count("Slime attacks for 2.\n") != 5):
        return "no_potions_loss: unexpected combat sequence"
    return None

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", default="cerune")
    args = parser.parse_args(argv)
    binary = shutil.which(args.binary)
    if binary is None and Path(args.binary).is_file():
        binary = str(Path(args.binary).resolve())
    if not binary:
        parser.error(f"Cerune executable not found: {args.binary}")
    source = ROOT / "src" / "main.ceru"
    check = subprocess.run([binary, "check", str(source.resolve())],
                           capture_output=True, stdin=subprocess.DEVNULL,
                           timeout=30, check=False)
    if check.returncode or check.stderr:
        print(f"FAIL check: {check.stderr!r}", file=sys.stderr)
        return 1
    failed = 0
    for case in SCENARIOS:
        for label, route in ROUTES:
            cmd = [binary, route[0], str(source.resolve()), *route[1:]]
            try:
                result = subprocess.run(cmd, input=case[1], capture_output=True,
                                        timeout=10, check=False)
                error = verify(result.stdout, case)
                if result.returncode or result.stderr or error:
                    raise RuntimeError(
                        f"exit={result.returncode}, stderr={result.stderr[:300]!r}, "
                        f"detail={error}"
                    )
            except (OSError, subprocess.TimeoutExpired, RuntimeError) as exc:
                failed += 1
                print(f"FAIL {case[0]} [{label}]: {exc}", file=sys.stderr)
            else:
                print(f"PASS {case[0]} [{label}]")
    print(f"{len(SCENARIOS)} scenarios x {len(ROUTES)} routes; failures: {failed}")
    return int(failed != 0)

if __name__ == "__main__":
    sys.exit(main())
