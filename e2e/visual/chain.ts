import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  bytesToHex,
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  labelhash,
  namehash,
  parseAbi,
  toBytes,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from 'viem'
import { mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { localhost } from 'viem/chains'

export const RPC_URL = process.env.NEXT_PUBLIC_PROVIDER ?? 'http://127.0.0.1:8545'
export const APP_URL = `http://localhost:${process.env.E2E_PORT ?? 3000}`
export const TLD = 'simplex'

const START = Date.UTC(2026, 2, 2, 12) / 1000
const STATE = bytesToHex(readFileSync(join(__dirname, 'chain', 'state.json.gz')))

const MNEMONIC = 'test test test test test test test test test test test junk'
export const KEYS = [0, 1, 2, 3].map((addressIndex) =>
  bytesToHex(mnemonicToAccount(MNEMONIC, { addressIndex }).getHdKey().privateKey!),
)
export const ACCOUNTS = KEYS.map((key) => privateKeyToAccount(key))
export const OWNER = 0

const CONTRACTS = JSON.parse(
  readFileSync(join(__dirname, 'chain', 'addresses.json'), 'utf8'),
) as Record<
  | 'ENSRegistry'
  | 'BaseRegistrarImplementation'
  | 'ETHRegistrarController'
  | 'PublicResolver'
  | 'SimplexNamePolicy'
  | 'SimplexSponsor'
  | 'SubnameRegistrar',
  Address
>

export const chain = { ...localhost, rpcUrls: { default: { http: [RPC_URL] } } }
const client = createPublicClient({ chain, transport: http(RPC_URL) })
const walletOf = (account: number) =>
  createWalletClient({ account: ACCOUNTS[account], chain, transport: http(RPC_URL) })

const rpc = async (method: string, params: unknown[] = []) => {
  const response = await fetch(RPC_URL, {
    method: 'POST',
    headers: [['content-type', 'application/json']],
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const { result, error } = await response.json()
  if (error) throw new Error(`${method}: ${error.message}`)
  return result
}

export const latestTimestamp = async () => (await client.getBlock()).timestamp

export const advance = async (seconds: bigint) => {
  await rpc('evm_setNextBlockTimestamp', [Number((await latestTimestamp()) + seconds)])
  await rpc('evm_mine')
}

export const resetChain = async () => {
  await rpc('anvil_reset')
  await rpc('anvil_loadState', [STATE])
  await rpc('anvil_setBlockTimestampInterval', [1])
  await rpc('anvil_setTime', [START])
  await rpc('evm_mine')
}

const registration = parseAbi([
  'struct Registration { string label; address owner; uint256 duration; bytes32 secret; address resolver; bytes[] data; uint8 reverseRecord; bytes32 referrer; }',
  'function makeCommitment(Registration registration) pure returns (bytes32)',
  'function commitments(bytes32 commitment) view returns (uint256)',
  'function register(Registration registration) payable',
  'function rentPrice(string label, uint256 duration) view returns ((uint256 base, uint256 premium))',
  'function setPublicSalesOpen(bool open)',
  'function unregister(string label, uint256 until)',
  'function registerWithCredit(Registration registration, uint256 disputeDays, uint256 nonce, uint256 deadline, bytes sig)',
  'function setRegistrarAllowance(address registrar, uint256 allowanceUSD)',
])
const policy = parseAbi([
  'function communityNames(bytes32 label) view returns (bool)',
  'function generalTermsHash() view returns (bytes32)',
  'function communityTermsHash() view returns (bytes32)',
  'function commitUnderGeneralTerms(bytes32 commitment, bytes32 acceptedTermsHash)',
  'function commitUnderCommunityTerms(bytes32 commitment, bytes32 acceptedTermsHash)',
])
const registrar = parseAbi([
  'function approve(address to, uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function disputeUntil(uint256 tokenId) view returns (uint256)',
  'function nameExpires(uint256 tokenId) view returns (uint256)',
])
const registry = parseAbi([
  'function setApprovalForAll(address operator, bool approved)',
  'function owner(bytes32 node) view returns (address)',
])
const resolver = parseAbi([
  'function setText(bytes32 node, string key, string value)',
  'function text(bytes32 node, string key) view returns (string)',
])
const subnames = parseAbi([
  'function createSubname(bytes32 parentNode, string label) returns (bytes32)',
  'function ownerOf(uint256 node) view returns (address)',
])

const TWO_YEARS = 730n * 86400n
const MIN_COMMITMENT_AGE = 60n

const confirm = async (hash: Hex) => {
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`transaction ${hash} reverted`)
}

const commit = async (label: string, owner: number) => {
  const request = {
    label,
    owner: ACCOUNTS[owner].address,
    duration: TWO_YEARS,
    secret: keccak256(toBytes(label)),
    resolver: CONTRACTS.PublicResolver,
    data: [],
    reverseRecord: 0,
    referrer: zeroHash,
  }
  const commitment = await client.readContract({
    address: CONTRACTS.ETHRegistrarController,
    abi: registration,
    functionName: 'makeCommitment',
    args: [request],
  })
  const community = await client.readContract({
    address: CONTRACTS.SimplexNamePolicy,
    abi: policy,
    functionName: 'communityNames',
    args: [labelhash(label)],
  })
  const terms = await client.readContract({
    address: CONTRACTS.SimplexNamePolicy,
    abi: policy,
    functionName: community ? 'communityTermsHash' : 'generalTermsHash',
  })
  await confirm(
    await walletOf(owner).writeContract({
      address: CONTRACTS.SimplexNamePolicy,
      abi: policy,
      functionName: community ? 'commitUnderCommunityTerms' : 'commitUnderGeneralTerms',
      args: [commitment, terms],
    }),
  )
  await advance(MIN_COMMITMENT_AGE)
  return request
}

export const register = async (label: string, owner: number) => {
  const request = await commit(label, owner)
  const { base, premium } = await client.readContract({
    address: CONTRACTS.ETHRegistrarController,
    abi: registration,
    functionName: 'rentPrice',
    args: [label, TWO_YEARS],
  })
  await confirm(
    await walletOf(owner).writeContract({
      address: CONTRACTS.ETHRegistrarController,
      abi: registration,
      functionName: 'register',
      args: [request],
      value: base + premium,
    }),
  )
}

export const committedAt = (commitment: Hex) =>
  client.readContract({
    address: CONTRACTS.ETHRegistrarController,
    abi: registration,
    functionName: 'commitments',
    args: [commitment],
  })

const usd = (dollars: number) => BigInt(dollars) * 10n ** 18n

export const setAllowance = async (account: number, dollars: number) =>
  confirm(
    await walletOf(OWNER).writeContract({
      address: CONTRACTS.SimplexSponsor,
      abi: registration,
      functionName: 'setRegistrarAllowance',
      args: [ACCOUNTS[account].address, usd(dollars)],
    }),
  )

export const registerWithAllowance = async (label: string, owner: number, disputeDays: bigint) => {
  const request = await commit(label, owner)
  await confirm(
    await walletOf(owner).writeContract({
      address: CONTRACTS.SimplexSponsor,
      abi: registration,
      functionName: 'registerWithCredit',
      args: [request, disputeDays, 0n, 0n, '0x'],
    }),
  )
}

export const disputeUntil = (label: string) =>
  client.readContract({
    address: CONTRACTS.BaseRegistrarImplementation,
    abi: registrar,
    functionName: 'disputeUntil',
    args: [BigInt(labelhash(label))],
  })

export const unregister = async (label: string) =>
  confirm(
    await walletOf(OWNER).writeContract({
      address: CONTRACTS.ETHRegistrarController,
      abi: registration,
      functionName: 'unregister',
      args: [label, await disputeUntil(label)],
    }),
  )

export const setPublicSalesOpen = async (open: boolean) =>
  confirm(
    await walletOf(OWNER).writeContract({
      address: CONTRACTS.ETHRegistrarController,
      abi: registration,
      functionName: 'setPublicSalesOpen',
      args: [open],
    }),
  )

export const offer = async (label: string, holder: number, recipient: number) =>
  confirm(
    await walletOf(holder).writeContract({
      address: CONTRACTS.BaseRegistrarImplementation,
      abi: registrar,
      functionName: 'approve',
      args: [ACCOUNTS[recipient].address, BigInt(labelhash(label))],
    }),
  )

export const holderOf = (label: string) =>
  client.readContract({
    address: CONTRACTS.BaseRegistrarImplementation,
    abi: registrar,
    functionName: 'ownerOf',
    args: [BigInt(labelhash(label))],
  })

export const offeredTo = async (label: string) => {
  const recipient = await client.readContract({
    address: CONTRACTS.BaseRegistrarImplementation,
    abi: registrar,
    functionName: 'getApproved',
    args: [BigInt(labelhash(label))],
  })
  return recipient === zeroAddress ? undefined : recipient
}

export const expiryOf = (label: string) =>
  client.readContract({
    address: CONTRACTS.BaseRegistrarImplementation,
    abi: registrar,
    functionName: 'nameExpires',
    args: [BigInt(labelhash(label))],
  })

export const setText = async (name: string, holder: number, key: string, value: string) =>
  confirm(
    await walletOf(holder).writeContract({
      address: CONTRACTS.PublicResolver,
      abi: resolver,
      functionName: 'setText',
      args: [namehash(name), key, value],
    }),
  )

export const textOf = (name: string, key: string) =>
  client.readContract({
    address: CONTRACTS.PublicResolver,
    abi: resolver,
    functionName: 'text',
    args: [namehash(name), key],
  })

export const createSubname = async (parent: string, label: string, holder: number) => {
  await confirm(
    await walletOf(holder).writeContract({
      address: CONTRACTS.ENSRegistry,
      abi: registry,
      functionName: 'setApprovalForAll',
      args: [CONTRACTS.SubnameRegistrar, true],
    }),
  )
  await confirm(
    await walletOf(holder).writeContract({
      address: CONTRACTS.SubnameRegistrar,
      abi: subnames,
      functionName: 'createSubname',
      args: [namehash(parent), label],
    }),
  )
}

export const subnameHolderOf = (name: string) =>
  client.readContract({
    address: CONTRACTS.SubnameRegistrar,
    abi: subnames,
    functionName: 'ownerOf',
    args: [BigInt(namehash(name))],
  })
