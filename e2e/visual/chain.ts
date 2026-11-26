import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  bytesToHex,
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  isAddress,
  keccak256,
  labelhash,
  namehash,
  parseAbi,
  parseEther,
  toBytes,
  zeroAddress,
  zeroHash,
  type Address,
  type Hex,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { localhost } from 'viem/chains'

import { MIN_DISPUTE_DAYS, MIN_REGISTRATION_DURATION } from '@app/constants/simplex'
import { namePolicyTermsAbi } from '@app/utils/snrcNameTerms'
import { sponsorAbi } from '@app/utils/snrcSponsor'

import { createAccounts } from '../../playwright/fixtures/accounts'

export const RPC_URL = process.env.NEXT_PUBLIC_PROVIDER ?? 'http://127.0.0.1:8545'
export const APP_URL = `http://127.0.0.1:${process.env.E2E_PORT ?? 3000}`
export const TLD = 'simplex'
export const DISPUTE_DAYS = BigInt(MIN_DISPUTE_DAYS)
export const ONE_DAY = 86400n

const START = Date.UTC(2026, 2, 2, 12) / 1000
const STATE = bytesToHex(readFileSync(join(__dirname, 'chain', 'state.json.gz')))
const TWO_YEARS = BigInt(MIN_REGISTRATION_DURATION)
const MIN_COMMITMENT_AGE = 60n

export const KEYS = createAccounts().getAllPrivateKeys()
export const ACCOUNTS = KEYS.map((key) => privateKeyToAccount(key))
export const OWNER = 0

const CONTRACT_NAMES = [
  'BaseRegistrarImplementation',
  'ENSRegistry',
  'ETHRegistrarController',
  'PublicResolver',
  'SimplexNamePolicy',
  'SimplexSponsor',
  'SubnameRegistrar',
] as const

const parseContracts = (deployment: Record<string, unknown>) =>
  Object.fromEntries(
    CONTRACT_NAMES.map((name) => {
      const address = deployment[name]
      if (typeof address !== 'string' || !isAddress(address))
        throw new Error(`addresses.json: ${name} is not an address`)
      return [name, address]
    }),
  ) as Record<(typeof CONTRACT_NAMES)[number], Address>

const CONTRACTS = parseContracts(
  JSON.parse(readFileSync(join(__dirname, 'chain', 'addresses.json'), 'utf8')),
)

export const chain = { ...localhost, rpcUrls: { default: { http: [RPC_URL] } } }
const transport = http(RPC_URL)
const client = createPublicClient({ chain, transport })
const anvil = createTestClient({ chain, transport, mode: 'anvil' })
const walletOf = (account: number) =>
  createWalletClient({ account: ACCOUNTS[account], chain, transport })

const registrationStruct =
  'struct Registration { string label; address owner; uint256 duration; bytes32 secret; address resolver; bytes[] data; uint8 reverseRecord; bytes32 referrer; }'
const controllerAbi = parseAbi([
  registrationStruct,
  'function makeCommitment(Registration registration) pure returns (bytes32)',
  'function commitments(bytes32 commitment) view returns (uint256)',
  'function register(Registration registration) payable',
  'function rentPrice(string label, uint256 duration) view returns ((uint256 base, uint256 premium))',
  'function minCharLength() view returns (uint8)',
  'function setPublicSalesOpen(bool open)',
  'function unregister(string label, uint256 until)',
])
const sponsorAdminAbi = parseAbi([
  'function setRegistrarAllowance(address registrar, uint256 allowanceUSD)',
])
const policyAdminAbi = parseAbi(['function reservedNames(bytes32 label) view returns (uint8)'])
const registrarAbi = parseAbi([
  'function approve(address to, uint256 tokenId)',
  'function ownerOf(uint256 tokenId) view returns (address)',
  'function getApproved(uint256 tokenId) view returns (address)',
  'function disputeUntil(uint256 tokenId) view returns (uint256)',
  'function nameExpires(uint256 tokenId) view returns (uint256)',
])
const registryAbi = parseAbi(['function setApprovalForAll(address operator, bool approved)'])
const resolverAbi = parseAbi([
  'function setText(bytes32 node, string key, string value)',
  'function text(bytes32 node, string key) view returns (string)',
])
const subnameRegistrarAbi = parseAbi([
  'function createSubname(bytes32 parentNode, string label) returns (bytes32)',
  'function ownerOf(uint256 node) view returns (address)',
])

const confirm = async (hash: Hex) => {
  const receipt = await client.waitForTransactionReceipt({ hash })
  if (receipt.status !== 'success') throw new Error(`transaction ${hash} reverted`)
}

export const latestTimestamp = async () => (await client.getBlock()).timestamp

export const advance = async (seconds: bigint) => {
  await anvil.setNextBlockTimestamp({ timestamp: (await latestTimestamp()) + seconds })
  await anvil.mine({ blocks: 1 })
}

export const resetChain = async () => {
  await anvil.request<{ Method: 'anvil_reset'; Parameters: []; ReturnType: null }>({
    method: 'anvil_reset',
    params: [],
  })
  await anvil.loadState({ state: STATE })
  await anvil.setBalance({ address: zeroAddress, value: parseEther('1000') })
  await anvil.setBlockTimestampInterval({ interval: 1 })
  await anvil.request<{ Method: 'anvil_setTime'; Parameters: [number]; ReturnType: number }>({
    method: 'anvil_setTime',
    params: [START],
  })
  await anvil.mine({ blocks: 1 })
}

export const setPublicSalesOpen = async (open: boolean) =>
  confirm(
    await walletOf(OWNER).writeContract({
      address: CONTRACTS.ETHRegistrarController,
      abi: controllerAbi,
      functionName: 'setPublicSalesOpen',
      args: [open],
    }),
  )

export const isCommunityName = (label: string) =>
  client.readContract({
    address: CONTRACTS.SimplexNamePolicy,
    abi: namePolicyTermsAbi,
    functionName: 'communityNames',
    args: [labelhash(label)],
  })

export const generalTermsLink = () =>
  client.readContract({
    address: CONTRACTS.SimplexNamePolicy,
    abi: namePolicyTermsAbi,
    functionName: 'generalTermsLink',
  })

export const reservationOf = (label: string) =>
  client.readContract({
    address: CONTRACTS.SimplexNamePolicy,
    abi: policyAdminAbi,
    functionName: 'reservedNames',
    args: [keccak256(toBytes(label))],
  })

export const minCharLength = () =>
  client.readContract({
    address: CONTRACTS.ETHRegistrarController,
    abi: controllerAbi,
    functionName: 'minCharLength',
  })

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
    abi: controllerAbi,
    functionName: 'makeCommitment',
    args: [request],
  })
  const community = await isCommunityName(label)
  const terms = await client.readContract({
    address: CONTRACTS.SimplexNamePolicy,
    abi: namePolicyTermsAbi,
    functionName: community ? 'communityTermsHash' : 'generalTermsHash',
  })
  await confirm(
    await walletOf(owner).writeContract({
      address: CONTRACTS.SimplexNamePolicy,
      abi: namePolicyTermsAbi,
      functionName: community ? 'commitUnderCommunityTerms' : 'commitUnderGeneralTerms',
      args: [commitment, terms],
    }),
  )
  await advance(MIN_COMMITMENT_AGE)
  return request
}

export const committedAt = (commitment: Hex) =>
  client.readContract({
    address: CONTRACTS.ETHRegistrarController,
    abi: controllerAbi,
    functionName: 'commitments',
    args: [commitment],
  })

export const register = async (label: string, owner: number) => {
  const request = await commit(label, owner)
  const { base, premium } = await client.readContract({
    address: CONTRACTS.ETHRegistrarController,
    abi: controllerAbi,
    functionName: 'rentPrice',
    args: [label, TWO_YEARS],
  })
  await setPublicSalesOpen(true)
  await confirm(
    await walletOf(owner).writeContract({
      address: CONTRACTS.ETHRegistrarController,
      abi: controllerAbi,
      functionName: 'register',
      args: [request],
      value: base + premium,
    }),
  )
  await setPublicSalesOpen(false)
}

export const setAllowance = async (account: number, dollars: number) =>
  confirm(
    await walletOf(OWNER).writeContract({
      address: CONTRACTS.SimplexSponsor,
      abi: sponsorAdminAbi,
      functionName: 'setRegistrarAllowance',
      args: [ACCOUNTS[account].address, BigInt(dollars) * 10n ** 18n],
    }),
  )

export const registerWithAllowance = async (label: string, owner: number) => {
  const request = await commit(label, owner)
  await confirm(
    await walletOf(owner).writeContract({
      address: CONTRACTS.SimplexSponsor,
      abi: sponsorAbi,
      functionName: 'registerWithCredit',
      args: [request, DISPUTE_DAYS, 0n, 0n, '0x'],
    }),
  )
}

const tokenOf = (label: string) => BigInt(labelhash(label))

export const disputeUntil = (label: string) =>
  client.readContract({
    address: CONTRACTS.BaseRegistrarImplementation,
    abi: registrarAbi,
    functionName: 'disputeUntil',
    args: [tokenOf(label)],
  })

export const unregister = async (label: string) =>
  confirm(
    await walletOf(OWNER).writeContract({
      address: CONTRACTS.ETHRegistrarController,
      abi: controllerAbi,
      functionName: 'unregister',
      args: [label, await disputeUntil(label)],
    }),
  )

export const offer = async (label: string, holder: number, recipient: number) =>
  confirm(
    await walletOf(holder).writeContract({
      address: CONTRACTS.BaseRegistrarImplementation,
      abi: registrarAbi,
      functionName: 'approve',
      args: [ACCOUNTS[recipient].address, tokenOf(label)],
    }),
  )

export const holderOf = (label: string) =>
  client.readContract({
    address: CONTRACTS.BaseRegistrarImplementation,
    abi: registrarAbi,
    functionName: 'ownerOf',
    args: [tokenOf(label)],
  })

export const offeredTo = async (label: string) => {
  const recipient = await client.readContract({
    address: CONTRACTS.BaseRegistrarImplementation,
    abi: registrarAbi,
    functionName: 'getApproved',
    args: [tokenOf(label)],
  })
  return recipient === zeroAddress ? undefined : recipient
}

export const expiryOf = (label: string) =>
  client.readContract({
    address: CONTRACTS.BaseRegistrarImplementation,
    abi: registrarAbi,
    functionName: 'nameExpires',
    args: [tokenOf(label)],
  })

export const setText = async (name: string, holder: number, key: string, value: string) =>
  confirm(
    await walletOf(holder).writeContract({
      address: CONTRACTS.PublicResolver,
      abi: resolverAbi,
      functionName: 'setText',
      args: [namehash(name), key, value],
    }),
  )

export const textOf = (name: string, key: string) =>
  client.readContract({
    address: CONTRACTS.PublicResolver,
    abi: resolverAbi,
    functionName: 'text',
    args: [namehash(name), key],
  })

export const createSubname = async (parent: string, label: string, holder: number) => {
  await confirm(
    await walletOf(holder).writeContract({
      address: CONTRACTS.ENSRegistry,
      abi: registryAbi,
      functionName: 'setApprovalForAll',
      args: [CONTRACTS.SubnameRegistrar, true],
    }),
  )
  await confirm(
    await walletOf(holder).writeContract({
      address: CONTRACTS.SubnameRegistrar,
      abi: subnameRegistrarAbi,
      functionName: 'createSubname',
      args: [namehash(parent), label],
    }),
  )
}

export const subnameHolderOf = (name: string) =>
  client.readContract({
    address: CONTRACTS.SubnameRegistrar,
    abi: subnameRegistrarAbi,
    functionName: 'ownerOf',
    args: [BigInt(namehash(name))],
  })
