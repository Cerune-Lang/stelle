#!/usr/bin/env python3
"""Exercise the browser bridge with real Cerune, including the full Chapter 1 route."""
import argparse
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "browser_bridge.ceru"
MOVES = "essedddedse"
FRAME_LINES = 10  # protocol + event + finished + six tiles + END


def read_frame(stream):
    raw = [stream.readline() for _ in range(FRAME_LINES)]
    if any(not line for line in raw):
        raise AssertionError(f"incomplete frame: {raw!r}")
    lines = [line.decode("utf-8").rstrip("\r\n") for line in raw]
    assert lines[0] == "STELLE/1", lines
    assert lines[-1] == "END", lines
    assert lines[2] in ("true", "false"), lines
    assert len(lines[3:9]) == 6 and all(len(s) == 7 for s in lines[3:9]), lines
    return lines[1], lines[2] == "true", lines[3:9]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", default="cerune")
    args = parser.parse_args()
    checked = subprocess.run([args.binary, "check", str(SOURCE)], capture_output=True, text=True, timeout=30)
    if checked.returncode:
        raise AssertionError(checked.stderr)
    for scenario, keys, expected in [
        ("exit", "", ["start"]),
        ("blocked", "d", ["start", "blocked"]),
        ("finish", MOVES, ["start", "met_lyuna", "moved", "moved", "found_shard", "moved", "moved", "moved", "bridge_restored", "moved", "moved", "found_diary"]),
        ("restart", "er", ["start", "met_lyuna", "start"]),
        ("invalid", "z", ["start", "invalid"]),
    ]:
        proc = subprocess.Popen([args.binary, "run", str(SOURCE)], stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=ROOT, bufsize=0)
        try:
            events = [read_frame(proc.stdout)]
            for key in keys:
                proc.stdin.write((key + "\n").encode())
                proc.stdin.flush()
                events.append(read_frame(proc.stdout))
            assert [e[0] for e in events] == expected, (scenario, events)
            assert events[0][2][1][1] == "@", events[0]
            if scenario == "finish":
                assert events[-1][1], events[-1]
                assert "=" in "".join(events[-1][2]), events[-1]
            if scenario == "restart":
                assert events[-1][2] == events[0][2], events
            proc.stdin.close()
            assert proc.wait(timeout=10) == 0, proc.stderr.read()
            print("PASS", scenario)
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait()
    print("Browser bridge scenarios: 5 passed")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError, subprocess.TimeoutExpired) as exc:
        print("FAIL browser bridge:", exc, file=sys.stderr)
        sys.exit(1)
