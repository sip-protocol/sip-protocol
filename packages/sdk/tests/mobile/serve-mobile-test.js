#!/usr/bin/env node

/**
 * Mobile Test Harness Server
 *
 * Serves the mobile test harness with proper COOP/COEP headers
 * required for SharedArrayBuffer support.
 *
 * Usage:
 *   node tests/mobile/serve-mobile-test.js [port]
 *
 * Then open on your mobile device:
 *   http://<your-ip>:3142
 *
 * @see https://github.com/sip-protocol/sip-protocol/issues/142
 */

const http = require('http')
const fs = require('fs')
const path = require('path')

const PORT = process.argv[2] || 3142
const HOST = '0.0.0.0' // Listen on all interfaces for mobile access

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
}

// CRITICAL: These headers enable SharedArrayBuffer
const SECURITY_HEADERS = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
  'Cross-Origin-Resource-Policy': 'cross-origin',
  'Access-Control-Allow-Origin': '*',
}

const server = http.createServer((req, res) => {
  // Log request
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`)

  // Default to test harness
  let filePath = req.url === '/' ? '/mobile-test-harness.html' : req.url

  // Remove query string
  filePath = filePath.split('?')[0]

  // Resolve path relative to this directory
  const fullPath = path.join(__dirname, filePath)

  // Security: prevent directory traversal
  if (!fullPath.startsWith(__dirname)) {
    res.writeHead(403)
    res.end('Forbidden')
    return
  }

  // Get file extension and MIME type
  const ext = path.extname(fullPath).toLowerCase()
  const mimeType = MIME_TYPES[ext] || 'application/octet-stream'

  // Read and serve file
  fs.readFile(fullPath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('404 Not Found')
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`500 Server Error: ${err.message}`)
      }
      return
    }

    // Send response with COOP/COEP headers
    res.writeHead(200, {
      'Content-Type': mimeType,
      ...SECURITY_HEADERS,
    })
    res.end(data)
  })
})

server.listen(PORT, HOST, () => {
  // Get local IP addresses for mobile testing
  const os = require('os')
  const interfaces = os.networkInterfaces()
  const addresses = []

  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address)
      }
    }
  }

  console.log('')
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║        SIP Protocol Mobile WASM Test Server                ║')
  console.log('╠════════════════════════════════════════════════════════════╣')
  console.log('║                                                            ║')
  console.log(`║  Local:     http://localhost:${PORT}                        ║`)

  if (addresses.length > 0) {
    console.log('║                                                            ║')
    console.log('║  On your mobile device, open one of these URLs:           ║')
    for (const addr of addresses) {
      const url = `http://${addr}:${PORT}`
      console.log(`║    → ${url.padEnd(47)}║`)
    }
  }

  console.log('║                                                            ║')
  console.log('╠════════════════════════════════════════════════════════════╣')
  console.log('║  COOP/COEP headers enabled for SharedArrayBuffer support   ║')
  console.log('╚════════════════════════════════════════════════════════════╝')
  console.log('')
})
