import { render, screen } from '@app/test-utils'

import { describe, expect, it } from 'vitest'

import { TermsText } from './CommunityTerms'

describe('TermsText', () => {
  it('renders the markdown of the terms, and HTML in them as text', () => {
    const { container } = render(
      <TermsText text={'# Terms\n\n## Use\n\n- one\n- two\n\n<script>alert(1)</script>'} />,
    )
    expect(screen.getByRole('heading', { level: 1, name: 'Terms' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: 'Use' })).toBeVisible()
    expect(screen.getAllByRole('listitem').map((li) => li.textContent)).toEqual(['one', 'two'])
    expect(container.querySelector('script')).toBeNull()
    expect(container.textContent).toContain('<script>alert(1)</script>')
  })
})
