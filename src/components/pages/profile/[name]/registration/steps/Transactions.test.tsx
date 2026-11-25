import { mockFunction, render, screen, userEvent, waitFor } from '@app/test-utils'

import { zeroAddress, zeroHash } from 'viem'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { makeCommitment } from '@ensdomains/ensjs/utils'

import { useCheckRegistered } from '@app/hooks/registration/useCheckRegistered'
import { useExistingCommitment } from '@app/hooks/registration/useExistingCommitment'
import { useSimulateRegistration } from '@app/hooks/registration/useSimulateRegistration'
import { useDurationCountdown } from '@app/hooks/time/useDurationCountdown'
import { useCommittedTerms, useNameTerms } from '@app/hooks/useNameTerms'
import { useRegistrarAllowance } from '@app/hooks/useRegistrarAllowance'
import { useTransactionFlow } from '@app/transaction-flow/TransactionFlowProvider'
import { TermsKind } from '@app/utils/snrcNameTerms'

import { RegistrationReducerDataItem } from '../types'
import Transactions from './Transactions'

vi.mock('wagmi', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useAccount: () => ({ address: OWNER }),
  usePublicClient: () => ({ chain: { id: 1 }, readContract, verifyTypedData: async () => true }),
  useSignTypedData: () => ({ signTypedDataAsync }),
}))
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getNamePolicyAddress: () => '0x4444444444444444444444444444444444444444',
}))
vi.mock('@app/hooks/registration/useCheckRegistered')
vi.mock('@app/hooks/registration/useExistingCommitment')
vi.mock('@app/hooks/registration/useSimulateRegistration')
vi.mock('@app/hooks/time/useDurationCountdown')
vi.mock('@app/hooks/useNameTerms')
vi.mock('@app/hooks/useRegistrarAllowance')
vi.mock('@app/transaction-flow/TransactionFlowProvider')

const OWNER = '0x2222222222222222222222222222222222222222'
const NAME = 'alicebob.simplex'
const GENERAL_TERMS = `0x${'11'.repeat(32)}` as const
const NEW_GENERAL_TERMS = `0x${'22'.repeat(32)}` as const
const COMMUNITY_TERMS = `0x${'33'.repeat(32)}` as const

const TEMPORARY_OWNER = '0x7777777777777777777777777777777777777777'
const TEMPORARY_OWNER_COMMITMENT = makeCommitment({
  name: NAME,
  owner: TEMPORARY_OWNER,
  duration: 63072000,
  secret: zeroHash,
  resolverAddress: zeroAddress,
  records: { clearRecords: false },
  reverseRecord: 0,
  referrer: zeroHash,
})
const signed = (deadline: number) =>
  ({ nonce: 0n, deadline: BigInt(deadline), signature: `0x${'bb'.repeat(65)}` }) as const
const signedCredit = ({
  commitment = TEMPORARY_OWNER_COMMITMENT,
  deadline = Math.floor(Date.now() / 1000) + 2 * 86400,
}: { commitment?: `0x${string}`; deadline?: number } = {}) => ({
  owner: TEMPORARY_OWNER,
  intents: {
    commitment,
    terms: { kind: 'general', hash: GENERAL_TERMS, intent: signed(deadline) },
    register: signed(deadline),
  },
})

const mockUseTransactionFlow = mockFunction(useTransactionFlow)
const mockUseNameTerms = mockFunction(useNameTerms)
const mockUseCommittedTerms = mockFunction(useCommittedTerms)
const mockUseExistingCommitment = mockFunction(useExistingCommitment)
const createTransactionFlow = vi.fn()
const signTypedDataAsync = vi.fn(async () => `0x${'aa'.repeat(65)}`)
const readContract = vi.fn(async () => 4n)

const registrationData = {
  seconds: 63072000,
  resolverAddress: zeroAddress,
  secret: zeroHash,
  records: [],
  clearRecords: false,
  reverseRecord: false,
  referrer: zeroHash,
  terms: { kind: 'general', hash: GENERAL_TERMS },
} as unknown as RegistrationReducerDataItem

const flow = (commitStage?: 'complete') =>
  mockUseTransactionFlow.mockReturnValue({
    getLatestTransaction: (key: string) =>
      commitStage && key.startsWith('commit-')
        ? { stage: commitStage, finaliseTime: Date.now() - 120_000 }
        : undefined,
    createTransactionFlow,
  } as never)
const nameTerms = (kind: TermsKind, hash: `0x${string}`) =>
  mockUseNameTerms.mockReturnValue({
    required: true,
    kind,
    hash,
    text: 'the terms',
    isLoading: false,
    isFetching: false,
    isError: false,
  })
const committed = (data?: `0x${string}`) =>
  mockUseCommittedTerms.mockReturnValue({ data, isLoading: false, isFetching: false })
const committedCommitment = () => mockUseCommittedTerms.mock.calls[0][0].commitment

const transactions = () => (
  <Transactions
    name={NAME}
    registrationData={registrationData}
    callback={vi.fn()}
    onStart={vi.fn()}
  />
)

describe('Transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFunction(useSimulateRegistration).mockReturnValue({ isSuccess: false })
    mockFunction(useCheckRegistered).mockReturnValue(false)
    mockFunction(useDurationCountdown).mockReturnValue('1 day')
    mockUseExistingCommitment.mockReturnValue({})
    mockFunction(useRegistrarAllowance).mockReturnValue({ covers: true })
  })

  it.each([
    ['its terms changed', 'general', NEW_GENERAL_TERMS],
    ['it was listed', 'community', COMMUNITY_TERMS],
  ] as const)(
    'asks again after the commit when %s, and accepts the current kind',
    async (_, kind, hash) => {
      flow('complete')
      nameTerms(kind, hash)
      committed(GENERAL_TERMS)
      render(transactions())
      expect(mockUseCommittedTerms).toHaveBeenCalledWith(expect.objectContaining({ enabled: true }))
      expect(screen.getByTestId('finish-button')).toBeDisabled()
      expect(screen.getByTestId('accept-terms-button')).toBeDisabled()

      await userEvent.click(screen.getByTestId('terms-accept'))
      await userEvent.click(screen.getByTestId('accept-terms-button'))

      expect(createTransactionFlow).toHaveBeenCalledWith(`acceptTerms-${NAME}-${OWNER}`, {
        transactions: [
          {
            name: 'acceptTerms',
            data: { name: NAME, commitment: committedCommitment(), terms: { kind, hash } },
          },
        ],
        autoClose: true,
      })
    },
  )

  it('lets the register go on when the commit accepted the current terms', () => {
    flow('complete')
    nameTerms('general', GENERAL_TERMS)
    committed(GENERAL_TERMS)
    render(transactions())
    expect(screen.queryByTestId('accept-terms-button')).not.toBeInTheDocument()
    expect(screen.getByTestId('finish-button')).toBeEnabled()
  })

  it('commits with the terms accepted on the pricing step, and resumes an earlier commit', () => {
    flow()
    nameTerms('general', GENERAL_TERMS)
    committed()
    render(transactions())
    expect(createTransactionFlow).toHaveBeenCalledWith(
      `commit-${NAME}-${OWNER}`,
      expect.objectContaining({
        transactions: [
          {
            name: 'commitName',
            data: expect.objectContaining({ terms: { kind: 'general', hash: GENERAL_TERMS } }),
          },
        ],
      }),
    )
    expect(mockUseExistingCommitment).toHaveBeenCalledWith(
      expect.objectContaining({ commitment: committedCommitment(), enabled: true }),
    )
  })

  it('the registration from the allowance is simulated, then sent after the commit', async () => {
    flow('complete')
    nameTerms('general', GENERAL_TERMS)
    committed(GENERAL_TERMS)
    const credit = { owner: OWNER }
    render(
      <Transactions
        name={NAME}
        registrationData={{ ...registrationData, credit }}
        callback={vi.fn()}
        onStart={vi.fn()}
      />,
    )
    expect(useSimulateRegistration).toHaveBeenCalledWith(expect.objectContaining({ credit }))

    await userEvent.click(screen.getByTestId('finish-button'))

    expect(createTransactionFlow).toHaveBeenCalledWith(
      `register-${NAME}-${OWNER}`,
      expect.objectContaining({
        transactions: [
          {
            name: 'registerName',
            data: expect.objectContaining({ name: NAME, owner: OWNER, credit }),
          },
        ],
      }),
    )
  })

  const forTemporaryOwner = (
    credit: RegistrationReducerDataItem['credit'],
    callback = vi.fn(),
  ) => (
    <Transactions
      name={NAME}
      registrationData={{ ...registrationData, credit }}
      callback={callback}
      onStart={vi.fn()}
    />
  )

  it('the commit for a temporary owner accepts the terms with its signature', () => {
    flow()
    nameTerms('general', GENERAL_TERMS)
    committed()
    const credit = signedCredit()
    render(forTemporaryOwner(credit))
    expect(mockUseCommittedTerms).toHaveBeenCalledWith(
      expect.objectContaining({
        commitment: TEMPORARY_OWNER_COMMITMENT,
        acceptor: TEMPORARY_OWNER,
      }),
    )
    expect(useCheckRegistered).toHaveBeenCalledWith(
      expect.objectContaining({ ownerAddress: TEMPORARY_OWNER }),
    )
    expect(createTransactionFlow).toHaveBeenCalledWith(
      `commit-${NAME}-${OWNER}`,
      expect.objectContaining({
        transactions: [
          {
            name: 'commitName',
            data: expect.objectContaining({ owner: TEMPORARY_OWNER, credit }),
          },
        ],
      }),
    )
  })

  it('the register to a temporary owner is sent with its signed registration', async () => {
    flow('complete')
    nameTerms('general', GENERAL_TERMS)
    committed(GENERAL_TERMS)
    const credit = signedCredit()
    render(forTemporaryOwner(credit))
    await userEvent.click(screen.getByTestId('finish-button'))
    expect(createTransactionFlow).toHaveBeenCalledWith(
      `register-${NAME}-${OWNER}`,
      expect.objectContaining({
        transactions: [
          {
            name: 'registerName',
            data: expect.objectContaining({ owner: TEMPORARY_OWNER, credit }),
          },
        ],
      }),
    )
  })

  it.each([
    ['missing', { owner: TEMPORARY_OWNER }],
    ['for another commitment', signedCredit({ commitment: `0x${'dd'.repeat(32)}` })],
    [
      'ending within the 24 hours of the commit',
      signedCredit({ deadline: Math.floor(Date.now() / 1000) + 3600 }),
    ],
  ])(
    'without the signatures of the temporary owner, %s, the commit waits and Back returns to sign them',
    async (_, credit) => {
      flow()
      nameTerms('general', GENERAL_TERMS)
      committed()
      const callback = vi.fn()
      render(forTemporaryOwner(credit, callback))
      expect(createTransactionFlow).not.toHaveBeenCalled()
      expect(callback).not.toHaveBeenCalled()
      expect(screen.getByText('steps.info.temporaryOwner')).toBeVisible()
      expect(screen.queryByTestId('start-timer-button')).not.toBeInTheDocument()
      await userEvent.click(screen.getByText('action.back'))
      expect(callback).toHaveBeenCalledWith({ back: true })
    },
  )

  it('a temporary owner signs the changed terms again, and the acceptance is relayed', async () => {
    flow('complete')
    nameTerms('general', NEW_GENERAL_TERMS)
    committed(GENERAL_TERMS)
    render(forTemporaryOwner(signedCredit()))
    await userEvent.click(screen.getByTestId('terms-accept'))
    await userEvent.click(screen.getByTestId('accept-terms-button'))

    await waitFor(() => expect(createTransactionFlow).toHaveBeenCalled())
    expect(readContract).toHaveBeenCalledWith(
      expect.objectContaining({ functionName: 'nonces', args: [TEMPORARY_OWNER] }),
    )
    expect(signTypedDataAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        account: TEMPORARY_OWNER,
        primaryType: 'AcceptGeneralTerms',
        message: expect.objectContaining({
          commitment: TEMPORARY_OWNER_COMMITMENT,
          termsHash: NEW_GENERAL_TERMS,
          nonce: 4n,
        }),
      }),
    )
    await waitFor(() =>
      expect(createTransactionFlow).toHaveBeenCalledWith(`acceptTerms-${NAME}-${OWNER}`, {
        transactions: [
          {
            name: 'acceptTerms',
            data: {
              name: NAME,
              commitment: TEMPORARY_OWNER_COMMITMENT,
              terms: { kind: 'general', hash: NEW_GENERAL_TERMS },
              intent: {
                signer: TEMPORARY_OWNER,
                nonce: 4n,
                deadline: expect.any(BigInt),
                signature: `0x${'aa'.repeat(65)}`,
              },
            },
          },
        ],
        autoClose: true,
      }),
    )
  })

  const fromAllowance = () => (
    <Transactions
      name={NAME}
      registrationData={{ ...registrationData, credit: { owner: OWNER } }}
      callback={vi.fn()}
      onStart={vi.fn()}
    />
  )
  const committedAgo = (commitAge?: number) =>
    mockUseTransactionFlow.mockReturnValue({
      getLatestTransaction: (key: string) =>
        commitAge !== undefined && key.startsWith('commit-')
          ? { stage: 'complete', finaliseTime: Date.now() - commitAge }
          : undefined,
      getSelectedKey: () => undefined,
      createTransactionFlow,
    } as never)

  it.each([
    ['before the commit', undefined],
    ['while the commitment matures', 10_000],
    ['once the commitment matured', 120_000],
  ] as const)(
    'a registration from an allowance that does not cover it stops %s',
    (_, commitAge) => {
      committedAgo(commitAge)
      nameTerms('general', GENERAL_TERMS)
      committed(GENERAL_TERMS)
      mockFunction(useRegistrarAllowance).mockReturnValue({ covers: false })
      render(fromAllowance())
      expect(mockFunction(useRegistrarAllowance)).toHaveBeenCalledWith({
        name: NAME,
        seconds: 63072000,
      })
      expect(createTransactionFlow).not.toHaveBeenCalled()
      expect(screen.getByTestId('transactions-subheading')).toHaveTextContent(
        'steps.pricing.allowanceTooLow',
      )
      expect(screen.queryByTestId('finish-button')).not.toBeInTheDocument()
      expect(screen.queryByTestId('wait-button')).not.toBeInTheDocument()
      expect(screen.queryByTestId('start-timer-button')).not.toBeInTheDocument()
      expect(screen.getByText('action.back')).toBeVisible()
    },
  )

  it('the commit of a registration from the allowance waits for the allowance to be read', () => {
    committedAgo()
    nameTerms('general', GENERAL_TERMS)
    committed()
    mockFunction(useRegistrarAllowance).mockReturnValue({ covers: undefined })
    render(fromAllowance())
    expect(createTransactionFlow).not.toHaveBeenCalled()
    expect(screen.getByTestId('start-timer-button')).toBeDisabled()
  })

  it('a registration that the chain accepts is not stopped by an allowance read before it rose', () => {
    committedAgo(120_000)
    nameTerms('general', GENERAL_TERMS)
    committed(GENERAL_TERMS)
    mockFunction(useSimulateRegistration).mockReturnValue({ isSuccess: true })
    mockFunction(useRegistrarAllowance).mockReturnValue({ covers: false })
    render(fromAllowance())
    expect(screen.getByTestId('finish-button')).toBeEnabled()
  })
})
