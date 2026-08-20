#!/usr/bin/env python3
"""J.A.R.V.I.S. HUD static server — bind all interfaces for preview."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", "8080"))


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        print("[jarvis]", self.address_string(), "-", fmt % args)


if __name__ == "__main__":
    httpd = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"J.A.R.V.I.S. 12 Titanium  →  http://0.0.0.0:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStandby.")
        httpd.server_close()
