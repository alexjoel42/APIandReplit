import { thermocyclerSetTargetBlockTemperature } from '../commandCreators/atomic/thermocyclerSetTargetBlockTemperature'
import { thermocyclerSetTargetLidTemperature } from '../commandCreators/atomic/thermocyclerSetTargetLidTemperature'
import { thermocyclerAwaitBlockTemperature } from '../commandCreators/atomic/thermocyclerAwaitBlockTemperature'
import { thermocyclerAwaitLidTemperature } from '../commandCreators/atomic/thermocyclerAwaitLidTemperature'
import { thermocyclerDeactivateBlock } from '../commandCreators/atomic/thermocyclerDeactivateBlock'
import { thermocyclerDeactivateLid } from '../commandCreators/atomic/thermocyclerDeactivateLid'
import { thermocyclerRunProfile } from '../commandCreators/atomic/thermocyclerRunProfile'
import { thermocyclerCloseLid } from '../commandCreators/atomic/thermocyclerCloseLid'
import { thermocyclerOpenLid } from '../commandCreators/atomic/thermocyclerOpenLid'
import { getSuccessResult } from '../fixtures'
import type {
  AtomicProfileStep,
  ModuleOnlyParams,
  TemperatureParams,
  TCProfileParams,
} from '@opentrons/shared-data/protocol/types/schemaV4'
import type { CommandCreator } from '../types'

const getRobotInitialState = (): any => {
  // This particular state shouldn't matter for these command creators
  return {}
}

// neither should InvariantContext
const invariantContext: any = {}
const module: ModuleOnlyParams['module'] = 'someTCModuleId'
const temperature: TemperatureParams['temperature'] = 42
const holdTime: AtomicProfileStep['holdTime'] = 10
const volume: TCProfileParams['volume'] = 10
const profile = [
  {
    temperature,
    holdTime,
  },
]
describe('thermocycler atomic commands', () => {
  // NOTE(IL, 2020-05-11): splitting these into different arrays based on type of args
  // the command creator takes, so tests are type-safe
  const testCasesSetBlock = [
    {
      commandCreator: thermocyclerSetTargetBlockTemperature,
      expectedType: 'thermocycler/setTargetBlockTemperature',
      params: {
        module,
        temperature,
      },
    },
  ]
  const testCasesWithTempParam = [
    {
      commandCreator: thermocyclerSetTargetLidTemperature,
      expectedType: 'thermocycler/setTargetLidTemperature',
      params: {
        module,
        temperature,
      },
    },
    {
      commandCreator: thermocyclerAwaitBlockTemperature,
      expectedType: 'thermocycler/awaitBlockTemperature',
      params: {
        module,
        temperature,
      },
    },
    {
      commandCreator: thermocyclerAwaitLidTemperature,
      expectedType: 'thermocycler/awaitLidTemperature',
      params: {
        module,
        temperature,
      },
    },
  ]
  const testCasesModuleOnly = [
    {
      commandCreator: thermocyclerDeactivateBlock,
      expectedType: 'thermocycler/deactivateBlock',
      params: {
        module,
      },
    },
    {
      commandCreator: thermocyclerDeactivateLid,
      expectedType: 'thermocycler/deactivateLid',
      params: {
        module,
      },
    },
    {
      commandCreator: thermocyclerCloseLid,
      expectedType: 'thermocycler/closeLid',
      params: {
        module,
      },
    },
    {
      commandCreator: thermocyclerOpenLid,
      expectedType: 'thermocycler/openLid',
      params: {
        module,
      },
    },
  ]
  const testCasesRunProfile = [
    {
      commandCreator: thermocyclerRunProfile,
      expectedType: 'thermocycler/runProfile',
      params: {
        module,
        profile,
        volume,
      },
    },
  ]

  const testParams = <P>({
    commandCreator,
    params,
    expectedType,
  }: {
    commandCreator: CommandCreator<P>
    params: P
    expectedType: string
  }): void => {
    it(`creates a single "${expectedType}" command with the given params`, () => {
      const robotInitialState = getRobotInitialState()
      const result = commandCreator(params, invariantContext, robotInitialState)
      const res = getSuccessResult(result)
      // delete this once params are changed to conform to v6 params
      // @ts-expect-error
      const v6Params = { ...params, moduleId: params.module }
      // @ts-expect-error
      delete v6Params.module
      expect(res.commands).toEqual([
        {
          commandType: expectedType,
          params: v6Params,
        },
      ])
    })
  }

  // run all the test testCases
  testCasesSetBlock.forEach(testParams)
  testCasesWithTempParam.forEach(testParams)
  testCasesModuleOnly.forEach(testParams)
  testCasesRunProfile.forEach(testParams)
})
