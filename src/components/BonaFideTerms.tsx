import { useState } from 'react'
import styled, { css } from 'styled-components'
import { Hex } from 'viem'

import { CheckboxRow, Helper, Typography } from '@ensdomains/thorin'

import { useBonaFideTerms } from '@app/hooks/useBonaFideTerms'

export const TermsText = styled.pre(
  ({ theme }) => css`
    max-height: ${theme.space['48']};
    overflow-y: auto;
    white-space: pre-wrap;
    font-family: inherit;
  `,
)

export const useTermsAcceptance = (termsHash?: Hex, initialAcceptedTermsHash?: Hex) => {
  const [acceptedTermsHash, setAcceptedTermsHash] = useState(initialAcceptedTermsHash)
  return {
    acceptedTermsHash: acceptedTermsHash === termsHash ? acceptedTermsHash : undefined,
    setAccepted: (accepted: boolean) => setAcceptedTermsHash(accepted ? termsHash : undefined),
  }
}

type Props = {
  terms: ReturnType<typeof useBonaFideTerms>
  accepted: boolean
  onAcceptedChange: (accepted: boolean) => void
}

export const BonaFideTerms = ({ terms, accepted, onAcceptedChange }: Props) => (
  <Helper alert="info" alignment="horizontal" data-testid="bona-fide-terms">
    <div>
      <Typography weight="bold">Bona fide community name</Typography>
      <Typography>
        Registering or receiving this name requires accepting the bona fide community terms.
      </Typography>
      {terms.isLoading && <Typography>Loading the terms…</Typography>}
      {!terms.isLoading && !terms.matches && (
        <Typography color="red" data-testid="bona-fide-terms-mismatch">
          The terms on chain differ from the terms this app can show, so they cannot be accepted
          here.
        </Typography>
      )}
      {terms.matches && (
        <>
          <TermsText data-testid="bona-fide-terms-text">{terms.text}</TermsText>
          <CheckboxRow
            data-testid="bona-fide-terms-accept"
            label="I accept the bona fide community terms"
            checked={accepted}
            onChange={(e) => onAcceptedChange(e.target.checked)}
          />
        </>
      )}
    </div>
  </Helper>
)
