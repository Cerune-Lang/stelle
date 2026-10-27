#!/usr/bin/env python3
"""Check the pure, directed relationship graph on all Cerune execution routes."""
import argparse
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ROUTES = (("IR", ("run",)), ("MIR", ("run-mir",)),
          ("SSA", ("run-mir", "--ssa")), ("VM", ("run-vm",)))
EXPECTED = b"true\n" * 31


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", default="cerune")
    args = parser.parse_args(argv)
    binary = shutil.which(args.binary)
    if binary is None and Path(args.binary).is_file():
        binary = str(Path(args.binary).resolve())
    if not binary:
        parser.error("Cerune executable not found")
    source = (ROOT / "src" / "relationship_checks.ceru").resolve()
    checked = subprocess.run([binary, "check", str(source)],
                             capture_output=True, stdin=subprocess.DEVNULL,
                             timeout=30, check=False)
    if checked.returncode or checked.stderr:
        print(f"FAIL check: {checked.stderr!r}", file=sys.stderr)
        return 1
    failed = 0
    for name, route in ROUTES:
        try:
            result = subprocess.run([binary, route[0], str(source), *route[1:]],
                                    capture_output=True, stdin=subprocess.DEVNULL,
                                    timeout=30, check=False)
            if result.returncode or result.stderr or result.stdout != EXPECTED:
                print(f"FAIL {name}: exit={result.returncode} "
                      f"stdout={result.stdout!r} stderr={result.stderr[:500]!r}",
                      file=sys.stderr)
                failed += 1
            else:
                print(f"PASS {name}")
        except (OSError, subprocess.TimeoutExpired) as error:
            print(f"FAIL {name}: {error}", file=sys.stderr)
            failed += 1
    return int(failed != 0)


if __name__ == "__main__":
    sys.exit(main())
