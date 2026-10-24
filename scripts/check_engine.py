#!/usr/bin/env python3
"""Check Stelle's pure engine on all Cerune execution routes."""
import argparse
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
ROUTES = (("IR", ("run",)), ("MIR", ("run-mir",)),
          ("SSA", ("run-mir", "--ssa")), ("VM", ("run-vm",)))

def check(binary, source, expected, timeout=30):
    failed = False
    for name, route in ROUTES:
        cmd = [str(binary), route[0], str(source.resolve()), *route[1:]]
        try:
            result = subprocess.run(cmd, stdin=subprocess.DEVNULL,
                                    capture_output=True, timeout=timeout, check=False)
        except (OSError,subprocess.TimeoutExpired) as error:
            print(f"FAIL {name}: {error}",file=sys.stderr)
            failed = True
            continue
        if result.returncode != 0 or result.stdout != expected or result.stderr:
            print(f"FAIL {name}: exit={result.returncode} stdout={result.stdout!r} stderr={result.stderr[:500]!r}",file=sys.stderr)
            failed = True
        else:
            print(f"PASS {name}")
    return failed

def main(argv=None):
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary",default="cerune")
    args=parser.parse_args(argv)
    binary=shutil.which(args.binary)
    if binary is None and Path(args.binary).is_file():
        binary=str(Path(args.binary).resolve())
    if not binary:
        parser.error("Cerune executable not found")
    source=ROOT/"src"/"engine_checks.ceru"
    expected=b"true\n"*21
    result=subprocess.run([str(binary),"check",str(source.resolve())],
                          stdin=subprocess.DEVNULL,capture_output=True,timeout=30,check=False)
    if result.returncode != 0:
        print(f"FAIL check: {result.stderr!r}",file=sys.stderr)
        return 1
    return int(check(binary,source,expected))

if __name__=="__main__":
    sys.exit(main())
