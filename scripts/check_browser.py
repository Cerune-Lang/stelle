#!/usr/bin/env python3
"""Exercise the browser bridge with real Cerune, including the full Chapter 1 route."""
import argparse
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "src" / "browser_bridge.ceru"
MOVES = "e" + "s" * 20 + "e" + "d" * 30 + "e" + "d" * 10 + "s" * 10 + "e"
FRAME_LINES = 13  # protocol + event + finished + px + py + six tiles + END


def read_frame(stream):
    raw = [stream.readline() for _ in range(FRAME_LINES)]
    if any(not line for line in raw):
        raise AssertionError(f"incomplete frame: {raw!r}")
    lines = [line.decode("utf-8").rstrip("\r\n") for line in raw]
    assert lines[0] == "STELLE/3", lines
    assert lines[-1] == "END", lines
    assert lines[2] in ("true", "false"), lines
    assert len(lines[6:12]) == 6 and all(len(s) == 7 for s in lines[6:12]), lines
    return lines[1], lines[2] == "true", lines[6:12], int(lines[3]), int(lines[4]), int(lines[5])


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", default="cerune")
    args = parser.parse_args()
    binary = str(Path(args.binary).resolve()) if Path(args.binary).is_file() else args.binary
    checked = subprocess.run([binary, "check", str(SOURCE)], capture_output=True, text=True, timeout=30)
    if checked.returncode:
        raise AssertionError(checked.stderr)
    for scenario, keys, expected in [
        ("exit", "", ["start"]),
        ("blocked", "d" * 4, None),
        ("diagonal", "n", ["start", "moved"]),
        ("face_block", "aaaae", None),
        ("turn_to_lyuna", "we", ["start", "moved", "nothing"]),
        ("finish", MOVES, None),
        ("restart", "er", ["start", "met_lyuna", "start"]),
        ("invalid", "z", ["start", "invalid"]),
    ]:
        proc = subprocess.Popen([binary, "run", str(SOURCE)], stdin=subprocess.PIPE,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, cwd=ROOT, bufsize=0)
        try:
            events = [read_frame(proc.stdout)]
            for key in keys:
                proc.stdin.write((key + "\n").encode())
                proc.stdin.flush()
                events.append(read_frame(proc.stdout))
            if expected is not None:
                assert [e[0] for e in events] == expected, (scenario, events)
            if scenario == "turn_to_lyuna":
                assert events[-2][5] == 3 and events[-1][0] == "nothing", events
            if scenario == "diagonal":
                assert events[-1][3] > events[0][3], events
                assert events[-1][4] > events[0][4], events
            if scenario == "face_block":
                assert events[-1][0] == "nothing" and events[-1][5] == 1, events
            if scenario == "blocked":
                assert events[-1][0] == "blocked" and events[-1][3] < 2000, events[-1]
            assert events[0][2][1][1] == "@", events[0]
            if scenario == "finish":
                assert any(e[0] == "found_diary" for e in events), events[-12:]
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
    print("Browser bridge scenarios: 8 passed")


if __name__ == "__main__":
    try:
        main()
    except (AssertionError, OSError, subprocess.TimeoutExpired) as exc:
        print("FAIL browser bridge:", exc, file=sys.stderr)
        sys.exit(1)
