export const IS_TESTING_TLD = (process.env.NEXT_PUBLIC_SIMPLEX_TLD || 'testing') === 'testing'

export const pageTitle = (title: string) => (IS_TESTING_TLD ? `Testing - ${title}` : title)
