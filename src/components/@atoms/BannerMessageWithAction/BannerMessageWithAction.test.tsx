import { render, screen } from '@app/test-utils'

import { describe, expect, it } from 'vitest'

import { BannerMessageWithAction } from './BannerMessageWithAction'

const mediaWhere = (element: Element, property: string, value: string) =>
  [...document.styleSheets]
    .flatMap((sheet) => [...sheet.cssRules])
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule)
    .filter((media) =>
      [...media.cssRules].some(
        (rule) =>
          rule instanceof CSSStyleRule &&
          element.matches(rule.selectorText) &&
          rule.style.getPropertyValue(property) === value,
      ),
    )
    .map((media) => media.media.mediaText)

describe('BannerMessageWithAction', () => {
  it('should reset the top margin of the button wherever the text and the button form a column', () => {
    render(<BannerMessageWithAction content="text" button={{ children: 'Act' }} />)
    const buttonContainer = screen.getByRole('button', { name: 'Act' }).parentElement!
    const column = mediaWhere(buttonContainer.parentElement!, 'flex-direction', 'column')
    expect(column).toHaveLength(1)
    expect(mediaWhere(buttonContainer, 'margin-top', '0')).toEqual(column)
  })
})
