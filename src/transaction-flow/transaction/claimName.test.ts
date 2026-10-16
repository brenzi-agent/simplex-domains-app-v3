import { decodeFunctionData, labelhash } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { ClientWithEns, ConnectorClientWithEns } from '@app/types'
import { getClaimChecks } from '@app/utils/snrcClaimChecks'
import { registrarOfferAbi } from '@app/utils/snrcOffers'

import claimName from './claimName'

const REGISTRAR = '0x1111111111111111111111111111111111111111'
const HOLDER = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x3333333333333333333333333333333333333333'
const DIGEST = `0x${'ab'.repeat(32)}` as const

vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSnrcAddresses: () => ({ BaseRegistrarImplementation: REGISTRAR }),
}))
vi.mock('@app/utils/snrcClaimChecks')

const mockGetClaimChecks = vi.mocked(getClaimChecks)

const client = { chain: { id: 1337 } } as unknown as ClientWithEns
const connectorClient = { account: { address: RECIPIENT } } as unknown as ConnectorClientWithEns
const data = { name: 'alice.testing', holder: HOLDER, digest: DIGEST } as const

describe('claimName', () => {
  it('encodes transferFrom from the holder to the connected account', async () => {
    mockGetClaimChecks.mockResolvedValueOnce({ nodes: [], complete: true, digest: DIGEST })
    const tx = await claimName.transaction({ client, connectorClient, data })
    expect(mockGetClaimChecks).toHaveBeenCalledWith(client, 'alice.testing')
    expect(tx.to).toBe(REGISTRAR)
    expect(decodeFunctionData({ abi: registrarOfferAbi, data: tx.data })).toEqual({
      functionName: 'transferFrom',
      args: [HOLDER, RECIPIENT, BigInt(labelhash('alice'))],
    })
  })

  it('throws when the name changed after the review', async () => {
    mockGetClaimChecks.mockResolvedValueOnce({
      nodes: [],
      complete: true,
      digest: `0x${'cd'.repeat(32)}`,
    })
    await expect(claimName.transaction({ client, connectorClient, data })).rejects.toThrow(
      'The name changed after you reviewed it',
    )
  })

  it('displays the name, the action and the holder', () => {
    expect(claimName.displayItems(data, ((key: string) => key) as never)).toEqual([
      { label: 'name', value: 'alice.testing', type: 'name' },
      { label: 'action', value: 'transaction.description.claimName' },
      { label: 'from', value: HOLDER, type: 'address' },
    ])
  })
})
