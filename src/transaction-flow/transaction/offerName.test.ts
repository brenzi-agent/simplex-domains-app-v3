import { decodeFunctionData, labelhash, parseAbi } from 'viem'
import { describe, expect, it, vi } from 'vitest'

import { ClientWithEns, ConnectorClientWithEns } from '@app/types'
import { registrarOfferAbi } from '@app/utils/snrcOffers'

import offerName from './offerName'

const REGISTRAR = '0x1111111111111111111111111111111111111111'
const RECIPIENT = '0x3333333333333333333333333333333333333333'

vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSnrcAddresses: () => ({ BaseRegistrarImplementation: REGISTRAR }),
}))

const client = { chain: { id: 1337 } } as unknown as ClientWithEns
const connectorClient = {} as ConnectorClientWithEns

describe('offerName', () => {
  it('approves the recipient on the registrar', () => {
    const tx = offerName.transaction({
      client,
      connectorClient,
      data: { name: 'alice.testing', recipient: RECIPIENT },
    })
    expect(tx.to).toBe(REGISTRAR)
    expect(decodeFunctionData({ abi: registrarOfferAbi, data: tx.data })).toEqual({
      functionName: 'approve',
      args: [RECIPIENT, BigInt(labelhash('alice'))],
    })
  })

  it('relays the offer that the holder signed, without an announcement', () => {
    const intent = {
      signer: '0x2222222222222222222222222222222222222222',
      nonce: 1n,
      deadline: 1_900_000_000n,
      signature: `0x${'ab'.repeat(65)}`,
    } as const
    const tx = offerName.transaction({
      client,
      connectorClient,
      data: { name: 'alice.testing', recipient: RECIPIENT, intent },
    })
    expect(tx.to).toBe(REGISTRAR)
    expect(
      decodeFunctionData({
        abi: parseAbi([
          'function approveWithSig(address from, address to, uint256 tokenId, uint256 nonce, uint256 deadline, bytes sig, bytes ephemeralPubKey, bytes1 viewTag)',
        ]),
        data: tx.data,
      }),
    ).toEqual({
      functionName: 'approveWithSig',
      args: [
        intent.signer,
        RECIPIENT,
        BigInt(labelhash('alice')),
        intent.nonce,
        intent.deadline,
        intent.signature,
        '0x',
        '0x00',
      ],
    })
  })

  it('displays the name, the action, the recipient and a note', () => {
    const t = ((key: string) => key) as never
    expect(offerName.displayItems({ name: 'alice.testing', recipient: RECIPIENT }, t)).toEqual([
      { label: 'name', value: 'alice.testing', type: 'name' },
      { label: 'action', value: 'transaction.description.offerName' },
      { label: 'to', value: RECIPIENT, type: 'address' },
      { label: 'info', value: 'transaction.info.offerName' },
    ])
  })
})
