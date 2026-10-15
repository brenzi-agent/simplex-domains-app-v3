import { decodeFunctionData, labelhash, zeroAddress } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { ClientWithEns, ConnectorClientWithEns } from '@app/types'
import { registrarOfferAbi } from '@app/utils/snrcOffers'

import claimName from './claimName'
import offerName from './offerName'
import withdrawOffer from './withdrawOffer'

const REGISTRAR = '0x1111111111111111111111111111111111111111'
const HOLDER = '0x2222222222222222222222222222222222222222'
const RECIPIENT = '0x3333333333333333333333333333333333333333'

vi.mock('@app/constants/chains', () => ({
  getSnrcAddresses: () => ({ BaseRegistrarImplementation: REGISTRAR }),
}))

const client = { chain: { id: 1337 } } as unknown as ClientWithEns
const connectorClient = { account: { address: RECIPIENT } } as unknown as ConnectorClientWithEns
const tokenId = BigInt(labelhash('alice'))
const decode = (data: `0x${string}`) => decodeFunctionData({ abi: registrarOfferAbi, data })

describe('offer and claim transactions', () => {
  it('offerName approves the recipient on the registrar', () => {
    const tx = offerName.transaction({
      client,
      connectorClient,
      data: { name: 'alice.testing', recipient: RECIPIENT },
    })
    expect(tx.to).toBe(REGISTRAR)
    expect(decode(tx.data)).toEqual({ functionName: 'approve', args: [RECIPIENT, tokenId] })
  })

  it('withdrawOffer approves nobody', () => {
    const tx = withdrawOffer.transaction({ client, connectorClient, data: { name: 'alice.testing' } })
    expect(decode(tx.data)).toEqual({ functionName: 'approve', args: [zeroAddress, tokenId] })
  })

  it('claimName takes the name from its holder to the connected account', () => {
    const tx = claimName.transaction({
      client,
      connectorClient,
      data: { name: 'alice.testing', holder: HOLDER },
    })
    expect(tx.to).toBe(REGISTRAR)
    expect(decode(tx.data)).toEqual({
      functionName: 'transferFrom',
      args: [HOLDER, RECIPIENT, tokenId],
    })
  })
})
