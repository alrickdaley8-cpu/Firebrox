// Dependency-free static server for FIREBROX.
// No build step, no node_modules — just `node server.mjs` (or `npm start`).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 5173;
const HOST = process.env.HOST || '0.0.0.0';

// ---- live reload -----------------------------------------------------
const clients = new Set();
let reloadTimer = null;

const LIVE_RELOAD_CLIENT = `
// FIREBROX live reload: refreshes the preview whenever the source changes.
(function () {
  let es;
  function connect() {
    es = new EventSource('/__events');
    es.addEventListener('reload', function () {
      try { sessionStorage.setItem('firebrox.autoresume', '1'); } catch (e) {}
      location.reload();
    });
    es.onerror = function () {
      es.close();
      setTimeout(connect, 1000);   // server restarting — keep trying
    };
  }
  connect();
})();
`;

function broadcastReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => {
    for (const res of clients) {
      try { res.write('event: reload\ndata: 1\n\n'); } catch (e) { clients.delete(res); }
    }
    if (clients.size) console.log(`[firebrox] source changed — reloaded ${clients.size} preview tab(s)`);
  }, 150);
}

const WATCH_IGNORE = /node_modules|\.git|dist|\.swp|~$/;
try {
  fs.watch(ROOT, { recursive: true }, (evt, name) => {
    if (!name || WATCH_IGNORE.test(name)) return;
    if (!/\.(js|mjs|html|css)$/.test(name)) return;
    broadcastReload();
  });
  console.log('[firebrox] watching for source changes (live reload enabled)');
} catch (err) {
  console.log('[firebrox] live reload unavailable:', err.message);
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (urlPath === '/') urlPath = '/index.html';

  // live-reload endpoints
  if (urlPath === '/__events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (urlPath === '/__livereload.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript; charset=utf-8', 'Cache-Control': 'no-cache' });
    res.end(LIVE_RELOAD_CLIENT);
    return;
  }

  const filePath = path.join(ROOT, path.normalize(urlPath));
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    let body = data;
    if (ext === '.html') {
      // inject the live-reload client so the preview always shows the latest build
      body = Buffer.from(
        data.toString('utf8').replace('</body>', '<script src="/__livereload.js"></script>\n</body>')
      );
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
      'Access-Control-Allow-Origin': '*',
    });
    res.end(body);
  });
});

// Never let a bad request take the preview down.
server.on('clientError', (err, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\n\r\n');
});
process.on('uncaughtException', (err) => {
  console.error('[firebrox] recovered from:', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[firebrox] unhandled rejection:', err?.message || err);
});

server.listen(PORT, HOST, () => {
  console.log(`FIREBROX running at http://${HOST}:${PORT}/  (pid ${process.pid})`);
});

// heartbeat so the log shows the preview is alive
setInterval(() => {
  const mins = Math.round(process.uptime() / 6) / 10;
  console.log(`[firebrox] alive — uptime ${mins} min`);
}, 300000).unref?.();
