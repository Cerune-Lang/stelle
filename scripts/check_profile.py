#!/usr/bin/env python3
"""Check Stelle's player profile via all four Cerune execution routes."""
import argparse
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ROUTES = (("IR", ("run",)), ("MIR", ("run-mir",)),
          ("SSA", ("run-mir", "--ssa")), ("VM", ("run-vm",)))
PURE_CHECKS = b"true\n" * 16

CASES = (
    ("default", (),
     "Stelle profile\nName:\nステラ\nAge:\nunspecified\nGender:\nunspecified\n"),
    ("custom_name", ("星音",),
     "Stelle profile\nName:\n星音\nAge:\nunspecified\nGender:\nunspecified\n"),
    ("custom_age", ("", "20"),
     "Stelle profile\nName:\nステラ\nAge:\n20\nGender:\nunspecified\n"),
    ("female", ("星音", "20", "female"),
     "Stelle profile\nName:\n星音\nAge:\n20\nGender:\nfemale\n"),
    ("male", ("Arin", "28", "male"),
     "Stelle profile\nName:\nArin\nAge:\n28\nGender:\nmale\n"),
    ("long_lived", ("Traveler", "1000", "unspecified"),
     "Stelle profile\nName:\nTraveler\nAge:\n1000\nGender:\nunspecified\n"),
    ("blank_age", ("Traveler", "", "male"),
     "Stelle profile\nName:\nTraveler\nAge:\nunspecified\nGender:\nmale\n"),
    ("negative_age", ("Arin", "-1", "male"), "Age must be positive.\n"),
    ("invalid_age", ("Arin", "twenty", "male"), "Age must be an integer.\n"),
    ("overflow_age", ("Arin", "99999999999999999999999", "male"), "Age is outside i64.\n"),
    ("invalid_gender", ("Arin", "28", "x"), "Gender must be female, male, or unspecified.\n"),
    ("long_name", ("a" * 97, "20", "female"), "Name must contain at most 96 UTF-8 bytes.\n"),
    ("too_many_arguments", ("A", "20", "male", "unused"),
     "Usage: profile_cli [name] [age] [female|male|unspecified]\n"),
)


def run(binary, route, source, arguments=()):
    return subprocess.run(
        [binary, route[0], str(source), *route[1:], "--", *arguments],
        capture_output=True, stdin=subprocess.DEVNULL, timeout=30, check=False
    )


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", default="cerune")
    args = parser.parse_args(argv)
    binary = shutil.which(args.binary)
    if binary is None and Path(args.binary).is_file():
        binary = str(Path(args.binary).resolve())
    if not binary:
        parser.error("Cerune executable not found")
    pure = (ROOT / "src" / "profile_checks.ceru").resolve()
    cli = (ROOT / "src" / "profile_cli.ceru").resolve()
    for source in (pure, cli):
        checked = subprocess.run(
            [binary, "check", str(source)], stdin=subprocess.DEVNULL,
            capture_output=True, timeout=30, check=False
        )
        if checked.returncode or checked.stderr:
            print(f"FAIL check {source}: {checked.stderr!r}", file=sys.stderr)
            return 1
    failed = 0
    for name, route in ROUTES:
        result = run(binary, route, pure)
        if result.returncode or result.stderr or result.stdout != PURE_CHECKS:
            print(f"FAIL pure [{name}]: {result.stdout!r} {result.stderr!r}", file=sys.stderr)
            failed += 1
        else:
            print(f"PASS pure [{name}]")
        for label, arguments, expected in CASES:
            result = run(binary, route, cli, arguments)
            if result.returncode or result.stderr or result.stdout != expected.encode("utf-8"):
                print(f"FAIL {label} [{name}]: {result.stdout!r} {result.stderr!r}",
                      file=sys.stderr)
                failed += 1
            else:
                print(f"PASS {label} [{name}]")
    return int(failed != 0)


if __name__ == "__main__":
    sys.exit(main())
