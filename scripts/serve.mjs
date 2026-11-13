import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const root = resolve(fileURLToPath(new URL('../', import.meta.url)), option('--dir', '.'));
const port = Number(option('--port', process.env.PORT || 4173));
const base = option('--base', '').replace(/\/$/, '');
const mime = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.txt':'text/plain; charset=utf-8', '.svg':'image/svg+xml', '.pdf':'application/pdf' };
const server = http.createServer(async (req, res) => {
  try {
    const path = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (base && path === base) { res.writeHead(302, { Location:`${base}/` }); res.end(); return; }
    if (base && !path.startsWith(`${base}/`)) { res.writeHead(404); res.end('Not found'); return; }
    const relative = path.slice(base.length).replace(/^\/+/, '') || 'index.html';
    const file = resolve(root, relative);
    if (!file.startsWith(`${root}${sep}`) || !(await stat(file)).isFile()) { res.writeHead(404); res.end('Not found'); return; }
    const content = await readFile(file);
    res.writeHead(200, { 'Content-Type':mime[extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store' });
    res.end(content);
  } catch (error) {
    const code = error.code === 'ENOENT' || error.code === 'ENOTDIR' ? 404 : error instanceof URIError ? 400 : 500;
    if (code === 500) console.error(error);
    res.writeHead(code); res.end(code === 404 ? 'Not found' : 'Request could not be served');
  }
});
server.listen(port, '127.0.0.1', () => console.log(`Study space: http://127.0.0.1:${port}${base}/`));
