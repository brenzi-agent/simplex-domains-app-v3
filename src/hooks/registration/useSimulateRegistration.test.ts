import { mockFunction, renderHook } from '@app/test-utils'

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { usePublicClient, useSimulateContract } from 'wagmi'

import { makeRegistrationCallData, RegistrationParameters } from '@ensdomains/ensjs/utils'

import { usePrice } from '../ensjs/public/usePrice'
import { useSimulateRegistration } from './useSimulateRegistration'

vi.mock('wagmi')
vi.mock('../ensjs/public/usePrice')
vi.mock('@app/constants/chains', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getSponsorAddress: () => SPONSOR,
}))

const SPONSOR = '0x5555555555555555555555555555555555555555'
const CONTROLLER = '0x6666666666666666666666666666666666666666'

const mockUseSimulateContract = mockFunction(useSimulateContract)

const registrationParams: RegistrationParameters = {
  name: 'alicebob.simplex',
  owner: '0x2222222222222222222222222222222222222222',
  duration: 63072000,
  secret: `0x${'33'.repeat(32)}` as const,
}

const simulations = () =>
  Object.fromEntries(
    mockUseSimulateContract.mock.calls.map(([parameters]) => [
      parameters?.functionName,
      parameters,
    ]),
  )

describe('useSimulateRegistration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFunction(usePublicClient).mockReturnValue({
      chain: { id: 1, contracts: { ensEthRegistrarController: { address: CONTROLLER } } },
    } as never)
    mockFunction(usePrice).mockReturnValue({ data: { base: 100n, premium: 0n } } as never)
    mockUseSimulateContract.mockImplementation(
      (parameters) => ({ functionName: parameters?.functionName }) as never,
    )
  })

  it('simulates the register from the allowance through the sponsor', () => {
    const { result } = renderHook(() =>
      useSimulateRegistration({
        registrationParams,
        credit: { owner: registrationParams.owner },
        query: { enabled: true },
      }),
    )
    expect(simulations().registerWithCredit).toEqual(
      expect.objectContaining({
        address: SPONSOR,
        args: [makeRegistrationCallData(registrationParams), 14n, 0n, 0n, '0x'],
        query: expect.objectContaining({ enabled: true }),
      }),
    )
    expect(simulations().register?.query?.enabled).toBe(false)
    expect(result.current).toEqual({ functionName: 'registerWithCredit' })
  })

  it('simulates the paid register without credit', () => {
    const { result } = renderHook(() =>
      useSimulateRegistration({ registrationParams, query: { enabled: true } }),
    )
    expect(simulations().register).toEqual(
      expect.objectContaining({
        address: CONTROLLER,
        args: [makeRegistrationCallData(registrationParams)],
        value: 102n,
        query: expect.objectContaining({ enabled: true }),
      }),
    )
    expect(simulations().registerWithCredit?.query?.enabled ?? false).toBe(false)
    expect(result.current).toEqual({ functionName: 'register' })
  })
})
