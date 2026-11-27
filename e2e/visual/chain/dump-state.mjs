import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createPublicClient, createWalletClient, http, parseAbi } from 'viem'
import { localhost, mainnet } from 'viem/chains'

const GENESIS_TIMESTAMP = '1767225600'
const ETH_USD = 169664538978n
const BATCH = 200
const COMMUNITY_TERMS_URL =
  'https://raw.githubusercontent.com/simplex-chat/simplex-chat/d94981224a366a433f2d42388effff720419f9fd/docs/NAMES-CONDITIONS.md'
const POLICY_EVENTS = parseAbi([
  'event ReservedNameAdded(string name, uint8 reason)',
  'event ReservedNameReasonChanged(string name, uint8 reason)',
  'event ReservedNameRemoved(string name)',
  'event CommunityNameAdded(string name)',
  'event CommunityNameRemoved(string name)',
])

const here = dirname(fileURLToPath(import.meta.url))
const [namespace, mainnetRpc] = process.argv.slice(2)
if (!mainnetRpc)
  throw new Error('usage: node dump-state.mjs <simplex-namespace-contract> <mainnet RPC URL>')

const git = (...args) =>
  execFileSync('git', ['-C', namespace, ...args], { encoding: 'utf8' }).trim()
const mainnetTerms = JSON.parse(readFileSync(join(namespace, 'terms.simplex.json'), 'utf8'))

const fetchTerms = async (url) => {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`${url}: status ${response.status}`)
  const text = Buffer.from(await response.arrayBuffer())
  const digest = createHash('sha256').update(text).digest('hex')
  return {
    url,
    text,
    contentType: response.headers.get('content-type'),
    link: `${url}#sha256=${digest}`,
  }
}

const writeTermsFiles = (terms) => {
  const files = {}
  for (const { url, text, contentType } of terms) {
    const { host, pathname } = new URL(url)
    const file = join('terms', host, pathname)
    mkdirSync(dirname(join(here, file)), { recursive: true })
    writeFileSync(join(here, file), text)
    files[url] = { file, contentType }
  }
  writeFileSync(join(here, 'terms.json'), `${JSON.stringify(files, null, 2)}\n`)
}

const generalTerms = await fetchTerms(
  mainnetTerms.generalTerms.slice(0, mainnetTerms.generalTerms.indexOf('#')),
)
if (generalTerms.link !== mainnetTerms.generalTerms)
  throw new Error(`${generalTerms.url}: ${generalTerms.link} differs from the mainnet link`)
const communityTerms = await fetchTerms(COMMUNITY_TERMS_URL)

const policyDeployment = readFileSync(
  join(namespace, 'deployments.mainnet.simplex.journal.jsonl'),
  'utf8',
)
  .trim()
  .split('\n')
  .map((line) => JSON.parse(line))
  .findLast(({ step }) => step === 'deploy:SimplexNamePolicyProxy')
const mainnetClient = createPublicClient({ chain: mainnet, transport: http(mainnetRpc) })

const policyLogsBetween = async (fromBlock, toBlock) => {
  try {
    return await mainnetClient.getLogs({
      address: policyDeployment.address,
      events: POLICY_EVENTS,
      fromBlock,
      toBlock,
      strict: true,
    })
  } catch (error) {
    if (fromBlock === toBlock) throw error
    const middle = (fromBlock + toBlock) / 2n
    return [
      ...(await policyLogsBetween(fromBlock, middle)),
      ...(await policyLogsBetween(middle + 1n, toBlock)),
    ]
  }
}

const mainnetPolicyNames = async (block) => {
  const logs = await policyLogsBetween(BigInt(policyDeployment.blockNumber), block)
  const reserved = new Map()
  const community = new Set()
  for (const { eventName, args } of logs) {
    switch (eventName) {
      case 'ReservedNameAdded':
      case 'ReservedNameReasonChanged':
        reserved.set(args.name, args.reason)
        break
      case 'ReservedNameRemoved':
        reserved.delete(args.name)
        break
      case 'CommunityNameAdded':
        community.add(args.name)
        break
      case 'CommunityNameRemoved':
        community.delete(args.name)
        break
      default:
    }
  }
  return { reserved, community }
}

const batches = (names) =>
  Array.from({ length: Math.ceil(names.length / BATCH) }, (_, index) =>
    names.slice(index * BATCH, (index + 1) * BATCH),
  )

const freePort = () =>
  new Promise((resolve) => {
    const server = createServer()
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      server.close(() => resolve(port))
    })
  })

const mainnetBlock = await mainnetClient.getBlockNumber()
const { reserved, community } = await mainnetPolicyNames(mainnetBlock)
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
    generalTerms.link,
  ])
  await send(addresses.SimplexNamePolicy, 'function setCommunityTerms(string link)', [
    communityTerms.link,
  ])
  for (const reason of new Set(reserved.values())) {
    const names = [...reserved.keys()].filter((name) => reserved.get(name) === reason)
    for (const batch of batches(names)) {
      await send(
        addresses.SimplexNamePolicy,
        'function addReservedNames(string[] names, uint8 reason)',
        [batch, reason],
      )
    }
  }
  for (const batch of batches([...community])) {
    await send(addresses.SimplexNamePolicy, 'function addCommunityNames(string[] names)', [batch])
  }
  writeTermsFiles([generalTerms, communityTerms])
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
        mainnetNamesBlock: `${mainnetBlock}`,
      },
      null,
      2,
    )}\n`,
  )
} finally {
  anvil.kill()
}
