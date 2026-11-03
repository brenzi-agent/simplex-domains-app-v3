import { ALLOWED_LABEL_REGEX } from '@app/hooks/useValidate'

export const parseLabels = (input: string) =>
  input
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)

export const getUnregistrableLabelsError = (labels: string[]) => {
  const unregistrable = labels.filter((label) => !ALLOWED_LABEL_REGEX.test(label))
  return unregistrable.length ? `Users cannot register: ${unregistrable.join(', ')}` : undefined
}
