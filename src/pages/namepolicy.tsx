import { ReactElement, useState } from 'react'
import styled, { css } from 'styled-components'
import { useChainId } from 'wagmi'

import { Button, Card, Heading, Input, Spinner, Tag, Typography } from '@ensdomains/thorin'

import { Outlink } from '@app/components/Outlink'
import { getNamePolicyAddress } from '@app/constants/chains'
import { useChainName } from '@app/hooks/chain/useChainName'
import { usePolicyNames } from '@app/hooks/usePolicyNames'
import { Content } from '@app/layouts/Content'
import { REASONS } from '@app/utils/snrcNamePolicy'
import { makeEtherscanLink } from '@app/utils/utils'

const TLD = process.env.NEXT_PUBLIC_SIMPLEX_TLD || 'testing'

const fullName = (label: string) => `${label}.${TLD}`

const Lists = styled.div(
  ({ theme }) => css`
    display: grid;
    gap: ${theme.space['4']};
    @media (min-width: ${theme.breakpoints.md}px) {
      grid-template-columns: 1fr 1fr;
    }
  `,
)

const Section = styled.div(
  ({ theme }) => css`
    display: flex;
    flex-direction: column;
    gap: ${theme.space['2']};
    padding: ${theme.space['4']};
  `,
)

const List = styled.ul(
  () => css`
    max-height: 60vh;
    overflow-y: auto;
  `,
)

const Row = styled.li(
  ({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${theme.space['2']};
    padding: ${theme.space['2']} 0;
    border-bottom: 1px solid ${theme.colors.border};
    word-break: break-all;
  `,
)

const countText = (shown: number, total: number, query: string) =>
  query ? `${shown} of ${total}` : `${total}`

function NamePolicy() {
  const chainId = useChainId()
  const chainName = useChainName()
  const namePolicyAddress = getNamePolicyAddress(chainId)
  const { data, isLoading, isError, refetch } = usePolicyNames()
  const [search, setSearch] = useState('')
  const query = search.trim().toLowerCase()
  const reserved = data?.reserved.filter(({ name }) => fullName(name).includes(query)) ?? []
  const community = data?.community.filter((name) => fullName(name).includes(query)) ?? []

  return (
    <>
      <Heading>Name policy</Heading>
      <Typography>
        A reserved name can&apos;t be registered; only the admin can assign it. Registering or
        receiving a community name requires accepting the community terms.
      </Typography>
      {namePolicyAddress && (
        <Outlink href={makeEtherscanLink(namePolicyAddress, chainName, 'address')}>
          Read from the events of the name policy contract
        </Outlink>
      )}
      <Input
        label="Search names"
        data-testid="name-policy-search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={fullName('name')}
      />
      {!namePolicyAddress && <Typography>There is no name policy on this network.</Typography>}
      {isLoading && <Spinner color="accent" />}
      {isError && (
        <>
          <Typography color="red" data-testid="name-policy-load-failed">
            The names can&apos;t be read now.
          </Typography>
          <div>
            <Button size="small" colorStyle="accentSecondary" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        </>
      )}
      {data && (
        <Lists>
          <Card>
            <Section>
              <Typography fontVariant="largeBold">Reserved names</Typography>
              <Typography color="grey" data-testid="name-policy-reserved-count">
                {countText(reserved.length, data.reserved.length, query)}
              </Typography>
              <List data-testid="name-policy-reserved">
                {reserved.map(({ name, reason }) => (
                  <Row key={name}>
                    <Typography>{fullName(name)}</Typography>
                    <Tag colorStyle="greySecondary">{REASONS[reason] ?? reason}</Tag>
                  </Row>
                ))}
              </List>
            </Section>
          </Card>
          <Card>
            <Section>
              <Typography fontVariant="largeBold">Community names</Typography>
              <Typography color="grey" data-testid="name-policy-community-count">
                {countText(community.length, data.community.length, query)}
              </Typography>
              <List data-testid="name-policy-community">
                {community.map((name) => (
                  <Row key={name}>
                    <Typography>{fullName(name)}</Typography>
                  </Row>
                ))}
              </List>
            </Section>
          </Card>
        </Lists>
      )}
    </>
  )
}

export default function Page() {
  return <NamePolicy />
}

Page.getLayout = function getLayout(page: ReactElement) {
  return (
    <Content title="Name policy" hideHeading singleColumnContent>
      {{
        trailing: page,
      }}
    </Content>
  )
}
