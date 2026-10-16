import { isEncodedLabelhash, ParsedInputResult, parseInput } from '@ensdomains/ensjs/utils'

import { Prettify } from '@app/types'
import { tryBeautify } from '@app/utils/beautify'

export type ValidationResult = Prettify<
  Partial<Omit<ParsedInputResult, 'normalised' | 'labelDataArray'>> & {
    name: string
    beautifiedName: string
    isNonASCII: boolean | undefined
    labelCount: number
    labelDataArray: ParsedInputResult['labelDataArray']
  }
>

const tryDecodeURIComponent = (input: string) => {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

// RFC 1123 hostname labels (strict LDH): a-z, 0-9 and hyphen, no leading or
// trailing hyphen, and no '--' in positions 3-4 (reserved for Punycode
// 'xn--' labels, which could IDNA-decode back to the Unicode this blocks).
export const ALLOWED_LABEL_REGEX = /^(?!.{2}--)[a-z0-9]([a-z0-9-]*[a-z0-9])?$/

const hasOnlyAllowedLabels = (name: string) =>
  name === '[root]' ||
  name.split('.').every((label) => ALLOWED_LABEL_REGEX.test(label) || isEncodedLabelhash(label))

export const validate = (input: string) => {
  const decodedInput = tryDecodeURIComponent(input)
  const { normalised: name, ...parsedInput } = parseInput(decodedInput)
  const isNonASCII = parsedInput.labelDataArray.some((dataItem) => dataItem.type !== 'ASCII')
  const outputName = name || input

  return {
    ...parsedInput,
    isValid: parsedInput.isValid && hasOnlyAllowedLabels(outputName),
    name: outputName,
    beautifiedName: tryBeautify(outputName),
    isNonASCII,
    labelCount: parsedInput.labelDataArray.length,
  }
}

const defaultData = Object.freeze({
  name: '',
  beautifiedName: '',
  isNonASCII: undefined,
  labelCount: 0,
  type: undefined,
  isValid: undefined,
  isShort: undefined,
  is2LD: undefined,
  isETH: undefined,
  labelDataArray: [],
})

type UseValidateParameters = {
  input: string
  enabled?: boolean
}

const tryValidate = (input: string) => {
  if (!input) return defaultData
  try {
    return validate(input)
  } catch {
    return defaultData
  }
}

const map = new Map()

export const useValidate = ({ input }: UseValidateParameters): ValidationResult => {
  const mapValue = map.get(input)
  if (mapValue) return mapValue

  const value = tryValidate(input)
  map.set(input, value)
  return value
}
