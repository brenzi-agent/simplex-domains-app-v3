import { render, screen } from '@app/test-utils'

import { describe, expect, it } from 'vitest'

import { BannerMessageWithAction } from './BannerMessageWithAction'

const mediaQueriesSetting = (
  element: Element,
  property: string,
  isSet: (value: string) => boolean,
) =>
  [...document.styleSheets]
    .flatMap((sheet) => [...sheet.cssRules])
    .filter((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule)
    .filter((media) =>
      [...media.cssRules].some(
        (rule) =>
          rule instanceof CSSStyleRule &&
          element.matches(rule.selectorText) &&
          isSet(rule.style.getPropertyValue(property)),
      ),
    )
    .map((media) => media.media.mediaText)

describe('BannerMessageWithAction', () => {
  it('should reset the top margin of the button wherever the text and the button form a column', () => {
    render(<BannerMessageWithAction content="text" button={{ children: 'Act' }} />)
    const buttonContainer = screen.getByRole('button', { name: 'Act' }).parentElement!
    const column = mediaQueriesSetting(
      buttonContainer.parentElement!,
      'flex-direction',
      (value) => value === 'column',
    )
    expect(column).toHaveLength(1)
    expect(
      mediaQueriesSetting(buttonContainer, 'margin-top', (value) => parseFloat(value) === 0),
    ).toEqual(column)
  })
})
