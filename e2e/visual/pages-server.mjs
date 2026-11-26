import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize } from 'node:path'

const [root, notFoundPage, port] = process.argv.slice(2)
if (!port) throw new Error('usage: node pages-server.mjs <export folder> <404 page> <port>')

const CONTENT_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.md': 'text/markdown; charset=utf-8',
  '.otf': 'font/otf',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml',
}

const isFile = async (path) => (await stat(path).catch(() => undefined))?.isFile() ?? false

const fileOf = async (pathname) => {
  const base = join(root, normalize(decodeURIComponent(pathname)))
  for (const candidate of [base, `${base}.html`, join(base, 'index.html')])
    if (await isFile(candidate)) return candidate
  return undefined
}

createServer(async (request, response) => {
  const file = await fileOf(new URL(request.url, 'http://127.0.0.1').pathname)
  const [status, path] = file ? [200, file] : [404, notFoundPage]
  response.writeHead(status, {
    'content-type': CONTENT_TYPES[extname(path)] ?? 'application/octet-stream',
  })
  response.end(await readFile(path))
}).listen(Number(port), '127.0.0.1')
