import { decodeFunctionData, labelhash, zeroAddress } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { ClientWithEns, ConnectorClientWithEns } from '@app/types'
import { registrarOfferAbi } from '@app/utils/snrcOffers'

import withdrawOffer from './withdrawOffer'

const REGISTRAR = '0x1111111111111111111111111111111111111111'

vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSnrcAddresses: () => ({ BaseRegistrarImplementation: REGISTRAR }),
}))

const client = { chain: { id: 1337 } } as unknown as ClientWithEns
const connectorClient = {} as ConnectorClientWithEns

describe('withdrawOffer', () => {
  it('approves nobody on the registrar', () => {
    const tx = withdrawOffer.transaction({
      client,
      connectorClient,
      data: { name: 'alice.testing' },
    })
    expect(tx.to).toBe(REGISTRAR)
    expect(decodeFunctionData({ abi: registrarOfferAbi, data: tx.data })).toEqual({
      functionName: 'approve',
      args: [zeroAddress, BigInt(labelhash('alice'))],
    })
  })

  it('displays the name and the action', () => {
    const t = ((key: string) => key) as never
    expect(withdrawOffer.displayItems({ name: 'alice.testing' }, t)).toEqual([
      { label: 'name', value: 'alice.testing', type: 'name' },
      { label: 'action', value: 'transaction.description.withdrawOffer' },
    ])
  })
})
