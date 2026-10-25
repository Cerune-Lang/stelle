#!/usr/bin/env python3
"""Run Chapter 1 puzzle regression checks on all four Cerune execution routes."""
import argparse
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ROUTES = (("IR", ("run",)), ("MIR", ("run-mir",)), ("SSA", ("run-mir", "--ssa")), ("VM", ("run-vm",)))
SCENARIOS = (
    ("complete", b"e\ns\ns\ne\nd\nd\nd\ne\nd\ns\ne\n",
     ("Lyuna:", "star shard hidden", "forgotten bridge returns", "Chapter 1 complete:"), "Chapter 1 complete: The Village Without a Bridge.\n"),
    ("blocked", b"d\nq\n", ("The path is blocked.",), "The stars will wait for you.\n"),
    ("no_lantern", b"s\ns\ne\nq\n", ("Speak to Lyuna first.",), "The stars will wait for you.\n"),
    ("no_shard", b"e\ns\ns\nd\nd\nd\ne\nq\n", ("It needs a fallen star.",), "The stars will wait for you.\n"),
    ("invalid", b"x\nq\n", ("Unknown command.",), "The stars will wait for you.\n"),
    ("eof", b"", (), "Input ended.\n"),
    ("crlf", b"q\r\n", (), "The stars will wait for you.\n"),
    ("no_final_lf", b"q", (), "The stars will wait for you.\n"),
)

def run(binary, route, source, input_bytes):
    return subprocess.run([binary, route[0], str(source), *route[1:]],
                          input=input_bytes, capture_output=True, timeout=15, check=False)

def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", default="cerune")
    args = parser.parse_args(argv)
    binary = shutil.which(args.binary)
    if binary is None and Path(args.binary).is_file():
        binary = str(Path(args.binary).resolve())
    if not binary:
        parser.error(f"Executable not found: {args.binary}")
    source = (ROOT / "src" / "chapter1.ceru").resolve()
    checks = (ROOT / "src" / "world_checks.ceru").resolve()
    failed = 0
    for path in (source, checks):
        result = subprocess.run([binary, "check", str(path)], capture_output=True,
                                stdin=subprocess.DEVNULL, timeout=30, check=False)
        if result.returncode or result.stderr:
            print(f"FAIL check {path}: {result.stderr!r}", file=sys.stderr)
            return 1
    for label, route in ROUTES:
        result = run(binary, route, checks, b"")
        if result.returncode or result.stderr or result.stdout != b"true\n" * 21:
            print(f"FAIL world checks [{label}]: {result.stdout!r} {result.stderr!r}", file=sys.stderr)
            failed += 1
        else:
            print(f"PASS world checks [{label}]")
        for name, input_bytes, expected_lines, ending in SCENARIOS:
            try:
                result = run(binary, route, source, input_bytes)
                text = result.stdout.decode("utf-8")
                ok = (result.returncode == 0 and not result.stderr
                      and text.startswith("Stelle - Chapter 1:")
                      and text.endswith(ending)
                      and all(segment in text for segment in expected_lines))
                if name != "complete" and "Chapter 1 complete:" in text:
                    ok = False
                if not ok:
                    raise ValueError(f"exit={result.returncode}; stderr={result.stderr[:300]!r}; tail={text[-350:]!r}")
                print(f"PASS {name} [{label}]")
            except (OSError, subprocess.TimeoutExpired, UnicodeError, ValueError) as error:
                print(f"FAIL {name} [{label}]: {error}", file=sys.stderr)
                failed += 1
    print(f"Chapter 1 regression: {len(ROUTES)} routes, failures: {failed}")
    return int(failed != 0)

if __name__ == "__main__":
    sys.exit(main())
