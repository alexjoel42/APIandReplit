import * as React from 'react'
import { useTranslation } from 'react-i18next'
import {
  useAllRunsQuery,
  useAllProtocolsQuery,
} from '@opentrons/react-api-client'
import {
  Flex,
  Box,
  SPACING,
  TYPOGRAPHY,
  BORDERS,
  COLORS,
  ALIGN_FLEX_START,
  DIRECTION_COLUMN,
  JUSTIFY_SPACE_AROUND,
} from '@opentrons/components'
import { StyledText } from '../../atoms/text'
import { useCurrentRunId } from '../ProtocolUpload/hooks'
import { HistoricalProtocolRun } from './HistoricalProtocolRun'
import { useIsRobotViewable } from './hooks'

interface RecentProtocolRunsProps {
  robotName: string
}

export function RecentProtocolRuns({
  robotName,
}: RecentProtocolRunsProps): JSX.Element | null {
  const { t } = useTranslation('device_details')
  const isRobotViewable = useIsRobotViewable(robotName)
  const runsQueryResponse = useAllRunsQuery()
  const runs = runsQueryResponse?.data?.data
  const protocols = useAllProtocolsQuery()
  const currentRunId = useCurrentRunId()
  const robotIsBusy = currentRunId != null

  return (
    <Flex
      alignItems={ALIGN_FLEX_START}
      backgroundColor={COLORS.white}
      css={BORDERS.cardOutlineBorder}
      flexDirection={DIRECTION_COLUMN}
      width="100%"
      marginBottom="6rem"
    >
      <StyledText
        as="h3"
        fontWeight={TYPOGRAPHY.fontWeightSemiBold}
        borderBottom={BORDERS.lineBorder}
        padding={SPACING.spacing4}
        width="100%"
        id="RecentProtocolRuns_title"
      >
        {t('recent_protocol_runs', { robotName: robotName })}
      </StyledText>
      <Box padding={SPACING.spacing4} width="100%">
        {isRobotViewable && runs && runs.length > 0 && (
          <Box>
            <Flex
              justifyContent={JUSTIFY_SPACE_AROUND}
              borderBottom={BORDERS.lineBorder}
              padding={SPACING.spacing3}
            >
              <StyledText
                marginLeft={SPACING.spacing5}
                width="25%"
                as="label"
                fontWeight={TYPOGRAPHY.fontWeightSemiBold}
              >
                {t('run_id')}
              </StyledText>
              <StyledText
                as="label"
                width="35%"
                fontWeight={TYPOGRAPHY.fontWeightSemiBold}
              >
                {t('protocol')}
              </StyledText>
              <StyledText
                as="label"
                width="20%"
                fontWeight={TYPOGRAPHY.fontWeightSemiBold}
              >
                {t('status')}
              </StyledText>
              <StyledText
                as="label"
                width="20%"
                marginRight="20px"
                fontWeight={TYPOGRAPHY.fontWeightSemiBold}
              >
                {t('run_duration')}
              </StyledText>
            </Flex>
            {runs.map((run, index) => {
              const protocol = protocols?.data?.data.find(
                protocol => protocol.id === run.protocolId
              )
              const protocolName =
                protocol?.metadata.protocolName ??
                protocol?.files[0].name ??
                run.protocolId ??
                ''

              return (
                <HistoricalProtocolRun
                  run={run}
                  protocolName={protocolName}
                  robotName={robotName}
                  robotIsBusy={robotIsBusy}
                  key={index}
                />
              )
            })}
          </Box>
        )}
        {!isRobotViewable && (
          <StyledText
            as="p"
            id="RecentProtocolRuns_offline"
            textAlign={TYPOGRAPHY.textAlignCenter}
            padding={SPACING.spacing7}
          >
            {t('offline_recent_protocol_runs')}
          </StyledText>
        )}
        {(runs == null || runs.length === 0) && (
          <StyledText
            as="p"
            id="RecentProtocolRuns_no_runs"
            textAlign={TYPOGRAPHY.textAlignCenter}
            padding={SPACING.spacing7}
          >
            {t('no_protocol_runs')}
          </StyledText>
        )}
      </Box>
    </Flex>
  )
}
