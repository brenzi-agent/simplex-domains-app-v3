import { useEffect, useState } from 'react'
import styled, { css } from 'styled-components'

import { getChainsFromUrl } from '@app/constants/chains'
import { IS_TESTING_TLD } from '@app/utils/utils'

const Container = styled.div(
  ({ theme }) => css`
    position: sticky;
    top: 0;
    z-index: 15;
    background-color: ${theme.colors.yellowSurface};
    color: ${theme.colors.textPrimary};
    font-size: ${theme.fontSizes.small};
    padding: ${theme.space['2']} ${theme.space['4']};
    text-align: center;
    font-weight: ${theme.fontWeights.bold};
  `,
)

export const TestnetWarning = () => {
  const chains = getChainsFromUrl()
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  if (IS_TESTING_TLD)
    return (
      <Container>
        This is the .testing environment: names here are for testing only, and .testing will be
        deprecated soon. SimpleX names are registered under .simplex at app.simplex.domains.
      </Container>
    )
  if (isClient && chains && chains[0].id !== 1)
    return <Container>You are viewing the SimpleX Namespace app on {chains[0].name} testnet.</Container>
  return null
}
