import { mockFunction } from '@app/test-utils'

import {
  decodeFunctionData,
  encodeAbiParameters,
  keccak256,
  parseAbi,
  parseAbiParameters,
} from 'viem'
import { expect, it, vi } from 'vitest'

import { getPrice } from '@ensdomains/ensjs/public'
import { makeCommitment, RegistrationParameters } from '@ensdomains/ensjs/utils'
import { registerName } from '@ensdomains/ensjs/wallet'

import { getSponsorAddress } from '@app/constants/chains'
import { ClientWithEns, ConnectorClientWithEns } from '@app/types'

import registerNameFlowTransaction from './registerName'

vi.mock('@ensdomains/ensjs/public')
vi.mock('@ensdomains/ensjs/wallet')
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSponsorAddress: vi.fn(() => SPONSOR),
}))

const SPONSOR = '0x5555555555555555555555555555555555555555'

const mockGetPrice = mockFunction(getPrice)
const mockRegisterName = mockFunction(registerName.makeFunctionData)

mockGetPrice.mockImplementation(async () => ({ base: 100n, premium: 0n }))
mockRegisterName.mockImplementation((...args: any[]) => args as any)

it('adds a 2% value buffer to the transaction from the real price', async () => {
  const result = (await registerNameFlowTransaction.transaction({
    client: {} as any,
    connectorClient: { walletClient: true } as any,
    data: { name: 'test.eth' } as any,
  })) as unknown as [{ walletClient: true }, { name: string; value: bigint }]
  const data = result[1]
  expect(data.value).toEqual(102n)
})

const sponsorAbi = parseAbi([
  'function registerWithCredit((string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer) registration, uint256 disputeDays, uint256 nonce, uint256 deadline, bytes sig)',
])
const registrationParameters = parseAbiParameters(
  '(string label, address owner, uint256 duration, bytes32 secret, address resolver, bytes[] data, uint8 reverseRecord, bytes32 referrer)',
)

it('registers the committed registration through the sponsor, paid from the allowance', async () => {
  const registration: RegistrationParameters = {
    name: 'alicebob.simplex',
    owner: '0x2222222222222222222222222222222222222222',
    duration: 63072000,
    secret: `0x${'33'.repeat(32)}` as const,
    resolverAddress: '0x4444444444444444444444444444444444444444',
    records: { texts: [{ key: 'simplex.contact', value: 'https://smp16.simplex.im/a#Q_abc' }] },
  }
  const tx = await registerNameFlowTransaction.transaction({
    client: { chain: { id: 1 } } as unknown as ClientWithEns,
    connectorClient: {} as unknown as ConnectorClientWithEns,
    data: { ...registration, credit: { owner: registration.owner } },
  })

  expect(tx).toEqual({ to: SPONSOR, data: expect.any(String) })
  const { functionName, args } = decodeFunctionData({ abi: sponsorAbi, data: tx.data })
  expect(functionName).toBe('registerWithCredit')
  expect(keccak256(encodeAbiParameters(registrationParameters, [args[0]]))).toBe(
    makeCommitment(registration),
  )
  expect(args.slice(1)).toEqual([14n, 0n, 0n, '0x'])
})

const temporaryOwner ='0x7777777777777777777777777777777777777777'
const temporaryOwnerRegistration: RegistrationParameters = {
  name: 'alicebob.simplex',
  owner: temporaryOwner,
  duration: 63072000,
  secret: `0x${'33'.repeat(32)}` as const,
}
const signed = { deadline: 1_900_000_000n, signature: `0x${'ab'.repeat(65)}` as const }
const temporaryOwnerCredit = {
  owner: temporaryOwner,
  intents: {
    commitment: makeCommitment(temporaryOwnerRegistration),
    terms: {
      kind: 'general',
      hash: `0x${'77'.repeat(32)}`,
      intent: { ...signed, nonce: 0n },
    },
    register: { ...signed, nonce: 2n },
  },
} as const

it('registers to the temporary owner with the registration it signed, paid from the allowance', async () => {
  const tx = await registerNameFlowTransaction.transaction({
    client: { chain: { id: 1 } } as unknown as ClientWithEns,
    connectorClient: {} as unknown as ConnectorClientWithEns,
    data: { ...temporaryOwnerRegistration, credit: temporaryOwnerCredit },
  })

  const { args } = decodeFunctionData({ abi: sponsorAbi, data: tx.data })
  expect(args[0].owner).toBe(temporaryOwner)
  expect(args.slice(1)).toEqual([14n, 2n, 1_900_000_000n, signed.signature])
})

it('shows the owner in the confirmation of a register to a temporary owner', () => {
  const t = ((key: string) => key) as never
  const owner = { label: 'owner', value: temporaryOwner, type: 'address' }
  expect(
    registerNameFlowTransaction.displayItems(
      { ...temporaryOwnerRegistration, credit: { owner: temporaryOwner } },
      t,
    ),
  ).not.toContainEqual(owner)
  expect(
    registerNameFlowTransaction.displayItems(
      { ...temporaryOwnerRegistration, credit: temporaryOwnerCredit },
      t,
    ),
  ).toContainEqual(owner)
})

it('refuses a registration from the allowance on a chain without a SimplexSponsor address', async () => {
  mockFunction(getSponsorAddress).mockReturnValueOnce(undefined)
  const owner = '0x2222222222222222222222222222222222222222'
  await expect(
    registerNameFlowTransaction.transaction({
      client: { chain: { id: 1 } } as unknown as ClientWithEns,
      connectorClient: {} as unknown as ConnectorClientWithEns,
      data: {
        name: 'alicebob.simplex',
        owner,
        duration: 63072000,
        secret: `0x${'33'.repeat(32)}`,
        credit: { owner },
      },
    }),
  ).rejects.toThrow('SimplexSponsor')
})
