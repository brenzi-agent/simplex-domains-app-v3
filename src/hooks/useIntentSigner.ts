import { Address, Hex } from 'viem'
import { readContract } from 'viem/actions'
import { usePublicClient, useSignTypedData } from 'wagmi'

import { RegistrationParameters } from '@ensdomains/ensjs/utils'

import { getNamePolicyAddress, getSnrcAddresses } from '@app/constants/chains'
import {
  intentDeadline,
  makeAcceptTermsTypedData,
  makeApproveNameTypedData,
  makeRegisterNameTypedData,
  noncesAbi,
  SignedIntent,
} from '@app/utils/snrcIntents'
import { Terms } from '@app/utils/snrcNameTerms'
import { getSnrcTokenId } from '@app/utils/snrcOffers'

export const useIntentSigner = () => {
  const client = usePublicClient()
  const { signTypedDataAsync } = useSignTypedData()
  const chainId = client.chain.id

  const readNonce = (contract: Address, signer: Address) =>
    readContract(client, {
      address: contract,
      abi: noncesAbi,
      functionName: 'nonces',
      args: [signer],
    })

  const signAcceptTerms = async ({
    owner,
    commitment,
    terms,
  }: {
    owner: Address
    commitment: Hex
    terms: Terms
  }): Promise<SignedIntent> => {
    const namePolicy = getNamePolicyAddress(chainId)!
    const nonce = await readNonce(namePolicy, owner)
    const deadline = intentDeadline()
    const signature = await signTypedDataAsync({
      account: owner,
      ...makeAcceptTermsTypedData({ chainId, namePolicy, commitment, terms, nonce, deadline }),
    })
    return { signer: owner, nonce, deadline, signature }
  }

  const signRegisterName = async ({
    registrationParams,
    disputeDays,
  }: {
    registrationParams: RegistrationParameters
    disputeDays: number
  }): Promise<SignedIntent> => {
    const { owner } = registrationParams
    const sponsor = getSnrcAddresses(chainId).SimplexSponsor as Address
    const nonce = await readNonce(sponsor, owner)
    const deadline = intentDeadline()
    const signature = await signTypedDataAsync({
      account: owner,
      ...makeRegisterNameTypedData({
        chainId,
        sponsor,
        registrationParams,
        disputeDays,
        nonce,
        deadline,
      }),
    })
    return { signer: owner, nonce, deadline, signature }
  }

  const signApproveName = async ({
    name,
    holder,
    recipient,
  }: {
    name: string
    holder: Address
    recipient: Address
  }): Promise<SignedIntent> => {
    const registrar = getSnrcAddresses(chainId).BaseRegistrarImplementation as Address
    const nonce = await readNonce(registrar, holder)
    const deadline = intentDeadline()
    const signature = await signTypedDataAsync({
      account: holder,
      ...makeApproveNameTypedData({
        chainId,
        registrar,
        from: holder,
        to: recipient,
        tokenId: getSnrcTokenId(name)!,
        nonce,
        deadline,
      }),
    })
    return { signer: holder, nonce, deadline, signature }
  }

  return { signAcceptTerms, signRegisterName, signApproveName }
}
