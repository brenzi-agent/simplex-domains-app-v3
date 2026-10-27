import Markdown from 'markdown-to-jsx'
import type { ComponentPropsWithoutRef } from 'react'
import styled, { css } from 'styled-components'
import { match } from 'ts-pattern'

import { CheckboxRow, Helper, Typography } from '@ensdomains/thorin'

import { useBonaFideTerms } from '@app/hooks/useBonaFideTerms'
import { useTermsAcceptance } from '@app/hooks/useTermsAcceptance'

const TermsBox = styled.div(
  ({ theme }) => css`
    max-height: ${theme.space['48']};
    overflow-y: auto;
    h1,
    h2 {
      font-weight: ${theme.fontWeights.bold};
      margin: ${theme.space['2']} 0 ${theme.space['1']};
    }
    h1 {
      font-size: ${theme.fontSizes.large};
    }
    h2 {
      font-size: ${theme.fontSizes.body};
    }
    p,
    ul {
      margin-bottom: ${theme.space['2']};
    }
    ul {
      list-style: disc;
      padding-left: ${theme.space['5']};
    }
  `,
)

// The terms as kept on chain, rendered from their markdown; HTML in them shows as text.
export const TermsText = ({
  text,
  ...props
}: { text: string } & ComponentPropsWithoutRef<'div'>) => (
  <TermsBox {...props}>
    <Markdown options={{ disableParsingRawHTML: true }}>{text}</Markdown>
  </TermsBox>
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
        .with({ hasTerms: true }, () => (
          <>
            <TermsText data-testid="bona-fide-terms-text" text={terms.text ?? ''} />
            <CheckboxRow
              data-testid="bona-fide-terms-accept"
              label="I accept the bona fide community terms"
              checked={!!acceptance.acceptedTermsHash}
              onChange={(e) => acceptance.setAccepted(e.target.checked)}
            />
          </>
        ))
        .otherwise(() => (
          <Typography color="red" data-testid="bona-fide-terms-unset">
            The community terms are not set yet, so they cannot be accepted.
          </Typography>
        ))}
    </div>
  </Helper>
)
