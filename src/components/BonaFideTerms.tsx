import styled, { css } from 'styled-components'
import { match } from 'ts-pattern'

import { CheckboxRow, Helper, Typography } from '@ensdomains/thorin'

import { useBonaFideTerms } from '@app/hooks/useBonaFideTerms'
import { useTermsAcceptance } from '@app/hooks/useTermsAcceptance'

export const TermsText = styled.pre(
  ({ theme }) => css`
    max-height: ${theme.space['48']};
    overflow-y: auto;
    white-space: pre-wrap;
    font-family: inherit;
  `,
)

type Props = {
  terms: ReturnType<typeof useBonaFideTerms>
  acceptance: ReturnType<typeof useTermsAcceptance>
}

export const BonaFideTerms = ({ terms, acceptance }: Props) => (
  <Helper alert="info" alignment="horizontal" data-testid="bona-fide-terms">
    <div>
      <Typography weight="bold">Bona fide community name</Typography>
      <Typography>
        Registering or receiving this name requires accepting the bona fide community terms.
      </Typography>
      {match(terms)
        .with({ isLoading: true }, () => <Typography>Loading the terms…</Typography>)
        .with({ matches: true }, () => (
          <>
            <TermsText data-testid="bona-fide-terms-text">{terms.text}</TermsText>
            <CheckboxRow
              data-testid="bona-fide-terms-accept"
              label="I accept the bona fide community terms"
              checked={!!acceptance.acceptedTermsHash}
              onChange={(e) => acceptance.setAccepted(e.target.checked)}
            />
          </>
        ))
        .otherwise(() => (
          <Typography color="red" data-testid="bona-fide-terms-mismatch">
            This app cannot show the current terms, so they cannot be accepted here.
          </Typography>
        ))}
    </div>
  </Helper>
)
