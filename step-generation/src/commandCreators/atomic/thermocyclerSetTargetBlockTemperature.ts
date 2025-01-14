import type { ThermocyclerSetTargetBlockTemperatureArgs } from '@opentrons/shared-data/protocol/types/schemaV4'
import type { CommandCreator } from '../../types'
export const thermocyclerSetTargetBlockTemperature: CommandCreator<ThermocyclerSetTargetBlockTemperatureArgs> = (
  args,
  invariantContext,
  prevRobotState
) => {
  if (args.volume !== undefined) {
    console.warn(
      `'volume' param not implemented for thermocycler/setTargetBlockTemperature, should not be set!`
    )
  }

  return {
    commands: [
      {
        commandType: 'thermocycler/setTargetBlockTemperature',
        params: {
          moduleId: args.module,
          temperature: args.temperature, // NOTE(IL, 2020-05-11): 'volume' param supported in schema but not implemented, so don't use it
        },
      },
    ],
  }
}
