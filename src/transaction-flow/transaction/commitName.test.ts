import { decodeFunctionData, zeroAddress, zeroHash } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { makeCommitment } from '@ensdomains/ensjs/utils'
import { commitName as ensCommitName } from '@ensdomains/ensjs/wallet'

import { ClientWithEns, ConnectorClientWithEns } from '@app/types'
import { namePolicyCommunityAbi } from '@app/utils/snrcCommunity'

import commitName from './commitName'

const NAME_POLICY = '0x4444444444444444444444444444444444444444'
const TERMS = `0x${'77'.repeat(32)}` as const

vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getNamePolicyAddress: () => NAME_POLICY,
}))
vi.mock('@ensdomains/ensjs/wallet', () => ({
  commitName: { makeFunctionData: vi.fn(() => ({ to: '0xcontroller', data: '0x' })) },
}))

const client = { chain: { id: 1337 } } as unknown as ClientWithEns
const connectorClient = {} as unknown as ConnectorClientWithEns
const registration = {
  name: 'alice.simplex',
  owner: '0x2222222222222222222222222222222222222222',
  duration: 63072000,
  secret: zeroHash,
  resolverAddress: zeroAddress,
} as const

describe('commitName', () => {
  it('commits to the controller when no terms were accepted', async () => {
    const tx = await commitName.transaction({ client, connectorClient, data: registration })
    expect(ensCommitName.makeFunctionData).toHaveBeenCalledWith(connectorClient, registration)
    expect(tx.to).toBe('0xcontroller')
  })

  it('commits through the name policy with the accepted terms', async () => {
    const tx = await commitName.transaction({
      client,
      connectorClient,
      data: { ...registration, communityTermsHash: TERMS },
    })
    expect(tx.to).toBe(NAME_POLICY)
    expect(decodeFunctionData({ abi: namePolicyCommunityAbi, data: tx.data })).toEqual({
      functionName: 'commitUnderCommunityTerms',
      args: [makeCommitment(registration), TERMS],
    })
  })

  it('shows the terms acceptance in the confirmation of a commit through the name policy', () => {
    const t = ((key: string) => key) as never
    expect(commitName.displayItems(registration, t)).not.toContainEqual(
      expect.objectContaining({ value: 'transaction.description.acceptCommunityTerms' }),
    )
    expect(
      commitName.displayItems({ ...registration, communityTermsHash: TERMS }, t),
    ).toContainEqual({ label: 'action', value: 'transaction.description.acceptCommunityTerms' })
  })
})
