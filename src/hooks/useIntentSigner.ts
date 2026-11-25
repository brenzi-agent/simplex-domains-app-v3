import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Address, Hex, parseAbi, TypedDataDefinition } from 'viem'
import { usePublicClient, useSignTypedData } from 'wagmi'

import { makeCommitment, RegistrationParameters } from '@ensdomains/ensjs/utils'

import { getNamePolicyAddress, getSnrcAddresses, getSponsorAddress } from '@app/constants/chains'
import {
  Intent,
  intentDeadline,
  makeAcceptTermsTypedData,
  makeApproveNameTypedData,
  makeRegisterNameTypedData,
  noncesAbi,
  normalizeSignature,
  SignedIntent,
} from '@app/utils/snrcIntents'
import { Terms } from '@app/utils/snrcNameTerms'
import { getSnrcTokenId } from '@app/utils/snrcOffers'
import { SignedCredit, SigningState } from '@app/utils/snrcSponsor'

type Acceptance = { owner: Address; commitment: Hex; terms: Terms }

const maxCommitmentAgeAbi = parseAbi(['function maxCommitmentAge() view returns (uint256)'])

export const useSigningState = (owner?: Address) => {
  const client = usePublicClient()
  const chainId = client.chain.id

  return useQuery({
    queryKey: ['signingState', chainId, owner],
    enabled: !!owner,
    queryFn: async (): Promise<SigningState> => {
      const readNonce = (address: Address) =>
        client.readContract({ address, abi: noncesAbi, functionName: 'nonces', args: [owner!] })
      const [policyNonce, sponsorNonce, maxCommitmentAge] = await Promise.all([
        readNonce(getNamePolicyAddress(chainId)!),
        readNonce(getSponsorAddress(chainId)!),
        client.readContract({
          address: getSnrcAddresses(chainId).ETHRegistrarController as Address,
          abi: maxCommitmentAgeAbi,
          functionName: 'maxCommitmentAge',
        }),
      ])
      return { policyNonce, sponsorNonce, maxCommitmentAge }
    },
  }).data
}

export const useIntentSigner = () => {
  const { t } = useTranslation('common')
  const client = usePublicClient()
  const { signTypedDataAsync } = useSignTypedData()
  const chainId = client.chain.id

  const signIntent = async ({
    signer,
    contract,
    typedData,
  }: {
    signer: Address
    contract: Address
    typedData: (nonce: bigint, deadline: bigint) => TypedDataDefinition
  }): Promise<Intent> => {
    const nonce = await client.readContract({
      address: contract,
      abi: noncesAbi,
      functionName: 'nonces',
      args: [signer],
    })
    const deadline = intentDeadline()
    const definition = typedData(nonce, deadline)
    const signature = normalizeSignature(
      await signTypedDataAsync({ account: signer, ...definition }),
    )
    if (!(await client.verifyTypedData({ address: signer, signature, ...definition })))
      throw new Error(t('errors.signedByAnotherAccount', { signer }))
    return { nonce, deadline, signature }
  }

  const signTermsIntent = ({ owner, commitment, terms }: Acceptance) => {
    const namePolicy = getNamePolicyAddress(chainId)!
    return signIntent({
      signer: owner,
      contract: namePolicy,
      typedData: (nonce, deadline) =>
        makeAcceptTermsTypedData({ chainId, namePolicy, commitment, terms, nonce, deadline }),
    })
  }

  const signCredit = async ({
    registrationParams,
    terms,
  }: {
    registrationParams: RegistrationParameters
    terms?: Terms
  }): Promise<SignedCredit> => {
    const { owner } = registrationParams
    const commitment = makeCommitment(registrationParams)
    const sponsor = getSponsorAddress(chainId)!
    const acceptance = terms && {
      ...terms,
      intent: await signTermsIntent({ owner, commitment, terms }),
    }
    const register = await signIntent({
      signer: owner,
      contract: sponsor,
      typedData: (nonce, deadline) =>
        makeRegisterNameTypedData({ chainId, sponsor, registrationParams, nonce, deadline }),
    })
    return { owner, intents: { commitment, terms: acceptance, register } }
  }

  const signAcceptTerms = async (acceptance: Acceptance): Promise<SignedIntent> => ({
    ...(await signTermsIntent(acceptance)),
    signer: acceptance.owner,
  })

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
    const intent = await signIntent({
      signer: holder,
      contract: registrar,
      typedData: (nonce, deadline) =>
        makeApproveNameTypedData({
          chainId,
          registrar,
          from: holder,
          to: recipient,
          tokenId: getSnrcTokenId(name)!,
          nonce,
          deadline,
        }),
    })
    return { ...intent, signer: holder }
  }

  return { signCredit, signAcceptTerms, signApproveName }
}
