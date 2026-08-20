#!/usr/bin/env python3
"""Static server that can be embedded in the Arena preview iframe."""

import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

HOST = "0.0.0.0"
PORT = 8080


class Handler(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript",
        ".mjs": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".json": "application/json",
        ".wasm": "application/wasm",
        ".html": "text/html",
    }

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cross-Origin-Resource-Policy", "cross-origin")
        self.send_header("Content-Security-Policy", "frame-ancestors *")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    httpd = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"FIREBROX serving on http://{HOST}:{PORT}", flush=True)
    httpd.serve_forever()
