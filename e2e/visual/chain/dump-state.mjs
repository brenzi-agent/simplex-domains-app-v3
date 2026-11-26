import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { localhost } from 'viem/chains'

const GENESIS_TIMESTAMP = '1767225600'
const ETH_USD = 169664538978n

const here = dirname(fileURLToPath(import.meta.url))
const [namespace] = process.argv.slice(2)
if (!namespace) throw new Error('usage: node dump-state.mjs <simplex-namespace-contract>')

const git = (...args) => execFileSync('git', ['-C', namespace, ...args], { encoding: 'utf8' }).trim()
const termsLinks = JSON.parse(readFileSync(join(namespace, 'terms.simplex.json'), 'utf8'))

const termsFile = async (link) => {
  const url = link.slice(0, link.indexOf('#'))
  const text = Buffer.from(await (await fetch(url)).arrayBuffer())
  const digest = createHash('sha256').update(text).digest('hex')
  if (!link.endsWith(`#sha256=${digest}`)) throw new Error(`${url}: sha256 ${digest}`)
  writeFileSync(join(here, 'terms', basename(new URL(url).pathname)), text)
}

const freePort = () =>
  new Promise((resolve) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })

const port = await freePort()
const transport = http(`http://127.0.0.1:${port}`)
const client = createPublicClient({ chain: localhost, transport })
const anvil = spawn(
  'anvil',
  ['--chain-id', '1337', '--port', `${port}`, '--timestamp', GENESIS_TIMESTAMP, '--silent'],
  { stdio: 'inherit' },
)
try {
  await new Promise((resolve, reject) => {
    const poll = () =>
      client
        .getChainId()
        .then(resolve, () =>
          anvil.exitCode === null ? setTimeout(poll, 200) : reject(new Error('anvil exited')),
        )
    poll()
  })
  execFileSync('node', [join(namespace, 'scripts', 'deploy-local.mjs')], {
    env: { ...process.env, SIMPLEX_TLD: 'simplex', RPC_URL: `http://127.0.0.1:${port}` },
    stdio: 'inherit',
  })
  const addresses = JSON.parse(readFileSync(join(namespace, 'deployments.local.json'), 'utf8'))
  const [owner] = await client.request({ method: 'eth_accounts' })
  const wallet = createWalletClient({ account: owner, chain: localhost, transport })
  const send = async (address, signature, args) => {
    const abi = parseAbi([signature])
    const hash = await wallet.writeContract({ address, abi, functionName: abi[0].name, args })
    await client.waitForTransactionReceipt({ hash })
  }
  await send(addresses.DummyOracle, 'function set(int256 value)', [ETH_USD])
  await send(addresses.ETHRegistrarController, 'function setPublicSalesOpen(bool open)', [false])
  await send(addresses.SimplexNamePolicy, 'function setGeneralTerms(string link)', [
    termsLinks.generalTerms,
  ])
  await send(addresses.SimplexNamePolicy, 'function setCommunityTerms(string link)', [
    termsLinks.communityTerms,
  ])
  for (const link of new Set([termsLinks.generalTerms, termsLinks.communityTerms]))
    await termsFile(link)
  const state = await client.request({ method: 'anvil_dumpState' })
  writeFileSync(join(here, 'state.json.gz'), Buffer.from(state.slice(2), 'hex'))
  copyFileSync(join(namespace, 'deployments.local.json'), join(here, 'addresses.json'))
  writeFileSync(
    join(here, 'source.json'),
    `${JSON.stringify(
      {
        namespace: git('rev-parse', 'HEAD'),
        ensContracts: git('rev-parse', 'HEAD:ens-contracts'),
        anvil: execFileSync('anvil', ['--version'], { encoding: 'utf8' }).split('\n')[0],
      },
      null,
      2,
    )}\n`,
  )
} finally {
  anvil.kill()
}
