import { spawn } from 'node:child_process'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'

const SKIP_HEADERS = new Set([
  'host',
  'connection',
  'content-length',
  'origin',
  'referer',
  'accept-encoding',
])

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)))
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

function runCurl(args: string[], stdin: Buffer): Promise<{ stdout: Buffer; stderr: Buffer; code: number }> {
  return new Promise((resolve) => {
    const child = spawn('curl', args)
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    child.stdout.on('data', (d) => stdout.push(d))
    child.stderr.on('data', (d) => stderr.push(d))
    child.on('close', (code) => {
      resolve({
        stdout: Buffer.concat(stdout),
        stderr: Buffer.concat(stderr),
        code: code ?? 1,
      })
    })
    child.on('error', (err) => {
      resolve({ stdout: Buffer.alloc(0), stderr: Buffer.from(String(err)), code: 1 })
    })
    if (stdin.length) child.stdin.write(stdin)
    child.stdin.end()
  })
}

async function proxyRequest(req: IncomingMessage, res: ServerResponse, base: string) {
  const body = await readBody(req)
  const target = `${base}${req.url ?? ''}`
  const args = ['-sS', '--max-time', '30', '-X', req.method || 'GET', target, '-w', '\n__HTTP_STATUS__:%{http_code}']
  for (const [key, value] of Object.entries(req.headers)) {
    if (!value || SKIP_HEADERS.has(key.toLowerCase())) continue
    const headerVal = Array.isArray(value) ? value.join(', ') : value
    args.push('-H', `${key}: ${headerVal}`)
  }
  if (body.length) args.push('--data-binary', '@-')
  const result = await runCurl(args, body)
  const text = result.stdout.toString('utf8')
  const marker = '\n__HTTP_STATUS__:'
  const idx = text.lastIndexOf(marker)
  const status = idx >= 0 ? Number(text.slice(idx + marker.length).trim()) : NaN
  const payload = idx >= 0 ? text.slice(0, idx) : text
  if (result.code !== 0 && !payload) {
    res.statusCode = 502
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({
      success: false,
      status: 502,
      message: result.stderr.toString('utf8').trim() || 'API proxy failed',
    }))
    return
  }
  res.statusCode = Number.isFinite(status) && status > 0 ? status : 200
  res.setHeader('Content-Type', 'application/json')
  res.end(payload)
}

export function apiCurlProxy(targetBase: string): Plugin {
  const base = targetBase.replace(/\/$/, '')
  return {
    name: 'api-curl-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!(req.url ?? '').startsWith('/api')) {
          next()
          return
        }
        void proxyRequest(req, res, base).catch((err) => {
          if (res.headersSent) return
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({
            success: false,
            status: 502,
            message: err instanceof Error ? err.message : 'API proxy failed',
          }))
        })
      })
    },
  }
}
