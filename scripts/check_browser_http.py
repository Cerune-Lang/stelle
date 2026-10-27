#!/usr/bin/env python3
"""Smoke-test the actual local HTTP server with a Cerune child process."""
import argparse
import json
import xml.etree.ElementTree as ET
from pathlib import Path
import subprocess
import sys
import time
from urllib import request

ROOT = Path(__file__).resolve().parents[1]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--binary", default="cerune")
    args = parser.parse_args()
    binary = str(Path(args.binary).resolve()) if Path(args.binary).is_file() else args.binary
    proc = subprocess.Popen(
        [sys.executable, str(ROOT / "browser" / "server.py"), "--binary", binary, "--port", "0"],
        stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        cwd=ROOT,
    )
    try:
        # A local ephemeral port avoids collisions with developers' servers.
        # The first line is emitted as soon as the HTTP server starts.
        import selectors
        sel = selectors.DefaultSelector()
        sel.register(proc.stdout, selectors.EVENT_READ)
        if not sel.select(timeout=15):
            raise AssertionError("HTTP server did not announce an address")
        line = proc.stdout.readline().strip()
        assert line.startswith("Stelle: http://127.0.0.1:"), line
        base = line.removeprefix("Stelle: ").rstrip("/")
        with request.urlopen(base + "/", timeout=5) as reply:
            assert reply.status == 200
            assert b'<canvas id="map"' in reply.read()
        with request.urlopen(base + "/game.js", timeout=5) as reply:
            assert reply.status == 200
            assert b"render(state)" in reply.read()
        for name in ("hero", "lyuna"):
            with request.urlopen(base + "/assets/" + name + ".svg", timeout=5) as reply:
                assert reply.status == 200
                assert reply.headers.get_content_type() == "image/svg+xml"
                sprite = ET.fromstring(reply.read())
                assert sprite.attrib.get("viewBox") == "0 0 128 160"
        with request.urlopen(base + "/api/state", timeout=5) as reply:
            before = json.load(reply)
        assert before["event"] == "start"
        assert before["tiles"][1][1] == "@"
        assert before["px"] == 1500 and before["py"] == 1500
        body = json.dumps({"key": "e"}).encode()
        req = request.Request(base + "/api/action", data=body,
                              headers={"Content-Type": "application/json"}, method="POST")
        with request.urlopen(req, timeout=5) as reply:
            after = json.load(reply)
        assert after["event"] == "met_lyuna", after
        assert len(after["tiles"]) == 6
        print("PASS browser HTTP: HTML, JS, sprite sheets, initial state, Cerune interaction")
    finally:
        proc.terminate()
        try:
            proc.communicate(timeout=5)
        except subprocess.TimeoutExpired:
            proc.kill()
            proc.communicate()


if __name__ == "__main__":
    main()
