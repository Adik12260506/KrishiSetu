/**
 * KrishiSetu HTTP Server (MongoDB-Powered)
 * Built with standard Node.js libraries and MongoDB persistence.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { setupRoutes } = require('./backend/routes');
const { dbManager } = require('./backend/db');

const PORT = process.env.PORT || 3000;
const FRONTEND_DIR = path.join(__dirname, 'frontend');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

class MiniApp {
  constructor() {
    this.routes = {
      GET: new Map(),
      POST: new Map(),
      PUT: new Map(),
      DELETE: new Map()
    };
  }

  get(pathStr, handler) {
    this.routes.GET.set(pathStr, handler);
  }

  post(pathStr, handler) {
    this.routes.POST.set(pathStr, handler);
  }

  handle(req, res) {
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;
    const method = req.method.toUpperCase();

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-farmer-id, x-device-id');

    if (method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    req.query = parsedUrl.query;

    res.json = (data) => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data, null, 2));
    };

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };

    res.send = (text) => {
      res.end(text);
    };

    const handler = this.routes[method] && this.routes[method].get(pathname);
    if (handler) {
      if (method === 'POST' || method === 'PUT') {
        const chunks = [];
        req.on('data', chunk => chunks.push(chunk));
        req.on('end', () => {
          const rawBuffer = Buffer.concat(chunks);
          const contentType = req.headers['content-type'] || '';
          if (contentType.includes('application/json')) {
            try {
              req.body = JSON.parse(rawBuffer.toString('utf8') || '{}');
            } catch (e) {
              req.body = {};
            }
          } else if (contentType.includes('application/octet-stream')) {
            req.body = rawBuffer;
          } else {
            try {
              req.body = JSON.parse(rawBuffer.toString('utf8') || '{}');
            } catch (e) {
              req.body = rawBuffer.toString('utf8');
            }
          }
          handler(req, res);
        });
      } else {
        handler(req, res);
      }
      return;
    }

    if (method === 'GET' && pathname.startsWith('/api/payout/reconstruction/')) {
      const id = pathname.replace('/api/payout/reconstruction/', '');
      req.params = { id };
      const recHandler = this.routes.GET.get('/api/payout/reconstruction/:id');
      if (recHandler) {
        recHandler(req, res);
        return;
      }
    }

    let filePath = path.join(FRONTEND_DIR, pathname === '/' ? 'index.html' : pathname);
    fs.stat(filePath, (err, stats) => {
      if (!err && stats.isFile()) {
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': contentType });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Not Found: ${pathname}` }));
      }
    });
  }
}

const app = new MiniApp();
setupRoutes(app);

const server = http.createServer((req, res) => {
  app.handle(req, res);
});

async function startServer() {
  await dbManager.connect();
  server.listen(PORT, () => {
    console.log(`[KrishiSetu] Server running at http://localhost:${PORT}`);
    console.log(`[KrishiSetu] Health check at http://localhost:${PORT}/healthz`);
    console.log(`[KrishiSetu] Database status at http://localhost:${PORT}/api/db/status`);
    console.log(`[KrishiSetu] Prometheus metrics at http://localhost:${PORT}/metrics`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = { server, app, startServer };
