#!/usr/bin/env python3
"""Local-only browser bridge: all gameplay decisions are made by Cerune."""
import argparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
from pathlib import Path
import subprocess
import threading
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "browser"
SOURCE = ROOT / "src" / "browser_bridge.ceru"
WIDTH, HEIGHT = 7, 6
EVENTS = {
    "start", "moved", "blocked", "nothing", "met_lyuna", "already_met",
    "need_lantern", "found_shard", "already_found", "need_shard",
    "bridge_restored", "already_restored", "found_diary", "already_finished",
    "invalid",
}


class WorldProcess:
    def __init__(self, binary):
        self.lock = threading.Lock()
        self.process = subprocess.Popen(
            [binary, "run", str(SOURCE)],
            cwd=ROOT, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.PIPE, bufsize=0,
        )
        self.state = self.read_state()

    def read_state(self):
        def line():
            raw = self.process.stdout.readline()
            if not raw:
                raise RuntimeError("Cerune exited before completing its state frame")
            return raw.decode("utf-8").rstrip("\r\n")
        if line() != "STELLE/1":
            raise RuntimeError("Unsupported Cerune state protocol")
        event = line()
        finished = line()
        tiles = [line() for _ in range(HEIGHT)]
        if (event not in EVENTS or finished not in ("true", "false")
                or any(len(row) != WIDTH or any(c not in "#.@L*B~+=H" for c in row)
                       for row in tiles)
                or line() != "END"):
            raise RuntimeError("Invalid Cerune state frame")
        return {"event": event, "finished": finished == "true", "tiles": tiles}

    def action(self, key):
        with self.lock:
            if self.process.poll() is not None:
                raise RuntimeError("Cerune process exited")
            self.process.stdin.write((key + "\n").encode("ascii"))
            self.process.stdin.flush()
            self.state = self.read_state()
            return self.state

    def close(self):
        self.process.terminate()
        try:
            self.process.wait(timeout=2)
        except subprocess.TimeoutExpired:
            self.process.kill()
            self.process.wait(timeout=2)
        self.process.stdin.close()
        self.process.stdout.close()
        self.process.stderr.close()


def handler_for(world):
    class Handler(BaseHTTPRequestHandler):
        def respond(self, status, content, kind="application/json; charset=utf-8"):
            self.send_response(status)
            self.send_header("Content-Type", kind)
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)

        def api(self, state):
            self.respond(200, json.dumps(state, ensure_ascii=False).encode("utf-8"))

        def do_GET(self):
            route = urlsplit(self.path).path
            if route == "/api/state":
                with world.lock:
                    self.api(world.state)
                return
            routes = {
                "/": ("index.html", "text/html; charset=utf-8"),
                "/index.html": ("index.html", "text/html; charset=utf-8"),
                "/game.js": ("game.js", "text/javascript; charset=utf-8"),
                "/style.css": ("style.css", "text/css; charset=utf-8"),
            }
            if route not in routes:
                self.respond(404, b"Not found", "text/plain; charset=utf-8")
                return
            filename, kind = routes[route]
            self.respond(200, (WEB / filename).read_bytes(), kind)

        def do_POST(self):
            if urlsplit(self.path).path != "/api/action":
                self.respond(404, b"Not found")
                return
            # Browser UI is same-origin, and server binds only to loopback.
            if self.headers.get("Origin") not in (None, f"http://127.0.0.1:{self.server.server_port}"):
                self.respond(403, b"Forbidden")
                return
            if self.headers.get("Content-Type") != "application/json":
                self.respond(415, b"Unsupported media type")
                return
            try:
                size = int(self.headers.get("Content-Length", "-1"))
                if size <= 0 or size > 128:
                    raise ValueError()
                body = json.loads(self.rfile.read(size))
                if not isinstance(body, dict) or set(body) != {"key"} or body["key"] not in "wasder":
                    raise ValueError()
            except (ValueError, TypeError, json.JSONDecodeError):
                self.respond(400, b"Invalid action")
                return
            try:
                self.api(world.action(body["key"]))
            except (BrokenPipeError, RuntimeError, UnicodeDecodeError) as exc:
                self.respond(503, json.dumps({"error": str(exc)}).encode())
        def log_message(self, fmt, *args):
            pass

    return Handler


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--binary", default="cerune", help="Cerune binary path")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    world = WorldProcess(args.binary)
    try:
        with ThreadingHTTPServer(("127.0.0.1", args.port), handler_for(world)) as server:
            print(f"Stelle: http://127.0.0.1:{server.server_port}/", flush=True)
            server.serve_forever()
    finally:
        world.close()


if __name__ == "__main__":
    main()
