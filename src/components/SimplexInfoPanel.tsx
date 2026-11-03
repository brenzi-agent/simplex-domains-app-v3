import styled, { css } from 'styled-components'
import { parseAbi } from 'viem'
import { useReadContract } from 'wagmi'

import { AlertSVG, Helper, Typography } from '@ensdomains/thorin'

import { useControllerLimits } from '@app/hooks/useControllerLimits'
import { useNftGateStatus } from '@app/hooks/useNftGateStatus'
import { useReservedStatus } from '@app/hooks/useReservedStatus'
import { makeDisplay } from '@app/utils/currency'

const priceOracleAbi = parseAbi([
  'struct LabelPrice { uint256 labelLength; uint256 priceCentsPerYear; }',
  'function prices() view returns (uint256 base, LabelPrice[] exceptions)',
])

const WarnCard = styled.div(
  ({ theme }) => css`
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: ${theme.space['3']};
    width: 100%;
    padding: ${theme.space['4']};
    border-radius: ${theme.radii['2xLarge']};
    background-color: ${theme.colors.yellowSurface};
    border: 1px solid ${theme.colors.yellowPrimary};
  `,
)

const WarnIcon = styled.div(
  ({ theme }) => css`
    flex-shrink: 0;
    width: ${theme.space['10']};
    height: ${theme.space['10']};
    border-radius: ${theme.radii.full};
    background-color: ${theme.colors.yellowPrimary};
    color: ${theme.colors.backgroundPrimary};
    display: flex;
    align-items: center;
    justify-content: center;

    svg {
      width: 18px;
      height: 18px;
    }
  `,
)

const WarnText = styled.div(
  ({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.space['0.5']};
  `,
)

const WarnSub = styled(Typography)(
  ({ theme }) => css`
    color: ${theme.colors.greyPrimary};
  `,
)

const Container = styled.div(
  ({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.space['3']};
  `,
)

const TiersGrid = styled.div(
  ({ theme }) => css`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${theme.space['2']};
    @media (min-width: ${theme.breakpoints.sm}px) {
      grid-template-columns: repeat(4, 1fr);
    }
  `,
)

const TierCard = styled.div<{ $active?: boolean }>(
  ({ theme, $active }) => css`
    border: 1px solid ${$active ? theme.colors.accent : theme.colors.border};
    border-radius: ${theme.radii.medium};
    padding: ${theme.space['3']};
    text-align: center;
    background: ${$active ? theme.colors.accentSurface : theme.colors.backgroundSecondary};
    ${$active &&
    css`
      box-shadow: 0 0 0 2px ${theme.colors.accent} inset;
    `}
  `,
)

const TierLabel = styled(Typography)(
  ({ theme }) => css`
    font-size: ${theme.fontSizes.small};
    color: ${theme.colors.greyPrimary};
  `,
)

const TierPrice = styled(Typography)(
  ({ theme }) => css`
    font-size: ${theme.fontSizes.large};
    font-weight: ${theme.fontWeights.bold};
    color: ${theme.colors.text};
  `,
)

type Props = { name?: string; address?: `0x${string}` }

/**
 * Highlights the pricing tier matching `name`'s label length and renders the
 * SimplexController-specific banners (NFT gate, reserved name, min char length).
 * The tier cards show the controller's price oracle curve for the lengths the
 * controller currently accepts.
 */
export const SimplexInfoPanel = ({ name, address }: Props) => {
  const { minCharLength, priceOracle } = useControllerLimits()
  const { required: nftRequired, hasNft, loaded: nftLoaded, nftAddress } = useNftGateStatus({ address })
  const { isReserved } = useReservedStatus({ name })

  const label = name ? name.split('.')[0] : ''
  const labelLen = label.length
  // SimplexController._checkSimplexGates runs only inside register() for
  // top-level names. Subnames (3LD+) are created via NameWrapper /
  // setSubnodeOwner, which doesn't apply minCharLength — so the UI gate
  // shouldn't either.
  const isSubname = !!name && name.split('.').length > 2

  // .testing is free during the testing phase (gas only). The pricing tiers
  // panel and the NFT-holder positive callout are both noise for users on
  // that TLD; hide them.
  const isTestingTld = (process.env.NEXT_PUBLIC_SIMPLEX_TLD || 'testing') === 'testing'

  const { data: priceList } = useReadContract({
    address: priceOracle,
    abi: priceOracleAbi,
    functionName: 'prices',
    query: { enabled: !!priceOracle && !isTestingTld },
  })
  const tiers = (() => {
    if (!priceList || !minCharLength) return []
    const [base, exceptions] = priceList
    const priceOf = new Map(
      exceptions.map(({ labelLength, priceCentsPerYear }) => [
        Number(labelLength),
        priceCentsPerYear,
      ]),
    )
    const open = Math.max(minCharLength, ...[...priceOf.keys()].map((length) => length + 1))
    return [
      { length: open, caption: `${open}+ chars`, price: base },
      ...Array.from({ length: open - minCharLength }, (_, i) => open - 1 - i).map((length) => ({
        length,
        caption: `${length} chars`,
        price: priceOf.get(length) ?? base,
      })),
    ]
  })()
  const activeTier = labelLen <= 0 ? null : Math.min(labelLen, tiers[0]?.length ?? labelLen)

  return (
    <Container data-testid="simplex-info-panel">
      {isReserved && (
        <Helper type="error" alignment="horizontal" data-testid="simplex-reserved-helper">
          <div>
            <Typography weight="bold">This name is reserved</Typography>
            <Typography>
              <code>{label}</code> has been reserved by the admin and cannot be registered through
              the public flow. Reach out to the SimpleX team if you believe it should be available
              to you.
            </Typography>
          </div>
        </Helper>
      )}
      {nftRequired && nftLoaded && hasNft === false && (
        <Helper type="error" alignment="horizontal" data-testid="simplex-nft-gate-helper">
          <div>
            <Typography weight="bold">SimpleX NFT required</Typography>
            <Typography>
              During the testing phase only SMPXNFT holders may register names. The gate contract
              is <code>{nftAddress}</code>. Your wallet does not currently hold one.
            </Typography>
          </div>
        </Helper>
      )}
      {!!minCharLength && !isSubname && labelLen > 0 && labelLen < minCharLength && (
        <WarnCard role="alert" data-testid="simplex-min-chars-helper">
          <WarnIcon>
            <AlertSVG />
          </WarnIcon>
          <WarnText>
            <Typography weight="bold">Minimum {minCharLength} characters</Typography>
            <WarnSub fontVariant="small">
              <code>{label}</code> is {labelLen} character{labelLen === 1 ? '' : 's'} — names
              shorter than {minCharLength} are not yet registrable. The admin lowers this limit
              over time.
            </WarnSub>
          </WarnText>
        </WarnCard>
      )}
      {!isTestingTld && tiers.length > 0 && (
        <div>
          <Typography weight="bold">SimpleX pricing (per year)</Typography>
          <TiersGrid>
            {tiers.map(({ length, caption, price }) => (
              <TierCard
                key={length}
                data-testid={`simplex-tier-${length}`}
                data-active={activeTier === length}
                $active={activeTier === length}
              >
                <TierLabel>{caption}</TierLabel>
                <TierPrice>
                  {makeDisplay({ value: price, symbol: 'usd', fromDecimals: 2 })}
                </TierPrice>
              </TierCard>
            ))}
          </TiersGrid>
        </div>
      )}
    </Container>
  )
}
