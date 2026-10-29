import Markdown from 'markdown-to-jsx'
import type { ComponentPropsWithoutRef } from 'react'
import styled, { css } from 'styled-components'
import { match } from 'ts-pattern'

import { CheckboxRow, Helper, Typography } from '@ensdomains/thorin'

import { useCommunityTerms } from '@app/hooks/useCommunityTerms'
import { useTermsAcceptance } from '@app/hooks/useTermsAcceptance'

const TermsBox = styled.div(
  ({ theme }) => css`
    max-height: ${theme.space['64']};
    overflow-y: auto;
    padding: ${theme.space['4']} ${theme.space['5']};
    border: 1px solid ${theme.colors.border};
    border-radius: ${theme.radii.large};
    color: ${theme.colors.textPrimary};
    font-size: ${theme.fontSizes.small};
    line-height: 1.6;

    /* shadows at the top and the bottom only while more text lies beyond them */
    background:
      linear-gradient(${theme.colors.backgroundPrimary} 30%, transparent) center top,
      linear-gradient(transparent, ${theme.colors.backgroundPrimary} 70%) center bottom,
      radial-gradient(farthest-side at 50% 0, rgba(0, 0, 0, 0.12), transparent) center top,
      radial-gradient(farthest-side at 50% 100%, rgba(0, 0, 0, 0.12), transparent) center bottom;
    background-color: ${theme.colors.backgroundPrimary};
    background-repeat: no-repeat;
    background-size:
      100% ${theme.space['10']},
      100% ${theme.space['10']},
      100% ${theme.space['3']},
      100% ${theme.space['3']};
    background-attachment: local, local, scroll, scroll;
    @media (max-width: ${theme.breakpoints.sm}px) {
      padding: ${theme.space['3']} ${theme.space['4']};
    }
    &:focus-visible {
      outline: 2px solid ${theme.colors.accent};
      outline-offset: 2px;
    }
    h1,
    h2 {
      font-weight: ${theme.fontWeights.bold};
      line-height: 1.3;
    }
    h1 {
      font-size: ${theme.fontSizes.large};
      margin: 0 0 ${theme.space['3']};
    }
    h2 {
      font-size: ${theme.fontSizes.body};
      margin: ${theme.space['5']} 0 ${theme.space['2']};
    }
    p,
    ul {
      margin: 0 0 ${theme.space['3']};
    }
    ul {
      list-style: disc;
      padding-left: ${theme.space['5']};
    }
    li + li {
      margin-top: ${theme.space['1.5']};
    }
    > :last-child > :last-child {
      margin-bottom: 0;
    }
  `,
)

const Content = styled.div(
  ({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.space['4']};
    width: 100%;
  `,
)

// The terms as kept on chain, rendered from their markdown; HTML in them shows as text.
export const TermsText = ({
  text,
  ...props
}: { text: string } & ComponentPropsWithoutRef<'div'>) => (
  // focusable, so the terms scroll from the keyboard too
  <TermsBox tabIndex={0} aria-label="Community terms" {...props}>
    <Markdown options={{ disableParsingRawHTML: true }}>{text}</Markdown>
  </TermsBox>
)

type Props = {
  terms: ReturnType<typeof useCommunityTerms>
  acceptance: ReturnType<typeof useTermsAcceptance>
}

export const CommunityTerms = ({ terms, acceptance }: Props) => (
  <Helper alert="info" alignment="horizontal" data-testid="community-terms">
    <Content>
      <div>
        <Typography weight="bold">Community name</Typography>
        <Typography>
          Registering or receiving this name requires accepting the community terms.
        </Typography>
      </div>
      {match(terms)
        .with({ isLoading: true }, () => <Typography>Loading the terms…</Typography>)
        .with({ hasTerms: true }, () => (
          <>
            <TermsText data-testid="community-terms-text" text={terms.text ?? ''} />
            <CheckboxRow
              data-testid="community-terms-accept"
              label="I accept the community terms"
              checked={!!acceptance.acceptedTermsHash}
              onChange={(e) => acceptance.setAccepted(e.target.checked)}
            />
          </>
        ))
        .otherwise(() => (
          <Typography color="red" data-testid="community-terms-unset">
            The community terms are not set yet, so they cannot be accepted.
          </Typography>
        ))}
    </Content>
  </Helper>
)
