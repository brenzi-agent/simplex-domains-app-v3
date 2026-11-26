import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const GENESIS_TIMESTAMP = '1767225600'
const TERMS = ['general-terms.md', 'community-terms.md']

const here = dirname(fileURLToPath(import.meta.url))
const [namespace] = process.argv.slice(2)
if (!namespace) throw new Error('usage: node dump-state.mjs <simplex-namespace-contract>')

const freePort = () =>
  new Promise((resolve) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })

const port = await freePort()
const rpcUrl = `http://127.0.0.1:${port}`
const rpc = async (method, params = []) => {
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const { result, error } = await response.json()
  if (error) throw new Error(`${method}: ${error.message}`)
  return result
}

const anvil = spawn(
  'anvil',
  ['--chain-id', '1337', '--port', `${port}`, '--timestamp', GENESIS_TIMESTAMP, '--silent'],
  { stdio: 'inherit' },
)
try {
  await new Promise((resolve, reject) => {
    const poll = () =>
      rpc('eth_chainId').then(resolve, () =>
        anvil.exitCode === null ? setTimeout(poll, 200) : reject(new Error('anvil exited')),
      )
    poll()
  })
  execFileSync('node', [join(namespace, 'scripts', 'deploy-local.mjs')], {
    env: { ...process.env, SIMPLEX_TLD: 'simplex', RPC_URL: rpcUrl },
    stdio: 'inherit',
  })
  const state = await rpc('anvil_dumpState')
  writeFileSync(join(here, 'state.json.gz'), Buffer.from(state.slice(2), 'hex'))
  copyFileSync(join(namespace, 'deployments.local.json'), join(here, 'addresses.json'))
  for (const file of TERMS)
    copyFileSync(join(namespace, 'test', 'fixtures', 'terms', file), join(here, 'terms', file))
} finally {
  anvil.kill()
}
