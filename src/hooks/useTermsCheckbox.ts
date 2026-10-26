import { useState } from 'react'
import { Hex } from 'viem'

export const useTermsCheckbox = (termsHash?: Hex, initialAcceptedTermsHash?: Hex) => {
  const [acceptedTermsHash, setAcceptedTermsHash] = useState(initialAcceptedTermsHash)
  return {
    acceptedTermsHash: acceptedTermsHash === termsHash ? acceptedTermsHash : undefined,
    setAccepted: (accepted: boolean) => setAcceptedTermsHash(accepted ? termsHash : undefined),
  }
}
