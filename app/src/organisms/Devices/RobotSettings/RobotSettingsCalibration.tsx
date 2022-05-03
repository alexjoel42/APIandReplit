import * as React from 'react'
import { saveAs } from 'file-saver'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import {
  Box,
  Flex,
  Link,
  ALIGN_CENTER,
  JUSTIFY_SPACE_BETWEEN,
  COLORS,
  SPACING,
  TYPOGRAPHY,
  useHoverTooltip,
  useConditionalConfirm,
} from '@opentrons/components'

import { Portal } from '../../../App/portal'
import { TertiaryButton } from '../../../atoms/Buttons'
import { Line } from '../../../atoms/structure'
import { StyledText } from '../../../atoms/text'
import { Tooltip } from '../../../atoms/Tooltip'
import { DeckCalibrationModal } from '../../../organisms/ProtocolSetup/RunSetupCard/RobotCalibration/DeckCalibrationModal'
import { AskForCalibrationBlockModal } from '../../../organisms/CalibrateTipLength/AskForCalibrationBlockModal'
import { formatLastModified } from '../../../organisms/CalibrationPanels/utils'
import { useTrackEvent } from '../../../redux/analytics'
import { EVENT_CALIBRATION_DOWNLOADED } from '../../../redux/calibration'
import { CONNECTABLE } from '../../../redux/discovery'
import { selectors as robotSelectors } from '../../../redux/robot'
import * as RobotApi from '../../../redux/robot-api'
import * as Config from '../../../redux/config'
import * as Sessions from '../../../redux/sessions'
import * as Calibration from '../../../redux/calibration'
import {
  useDeckCalibrationData,
  usePipetteOffsetCalibrations,
  useRobot,
  useTipLengthCalibrations,
  useAttachedPipettes,
} from '../hooks'

import type { State } from '../../../redux/types'
import type { RequestState } from '../../../redux/robot-api/types'
import type { SessionCommandString } from '../../../redux/sessions/types'
import type {
  DeckCalibrationData,
  DeckCalibrationStatus,
} from '../../../redux/calibration/types'

interface CalibrationProps {
  robotName: string
}

const spinnerCommandBlockList: SessionCommandString[] = [
  Sessions.sharedCalCommands.JOG,
]

export function RobotSettingsCalibration({
  robotName,
}: CalibrationProps): JSX.Element {
  const { t } = useTranslation([
    'device_settings',
    'shared',
    'robot_calibration',
  ])
  const doTrackEvent = useTrackEvent()
  const [targetProps, tooltipProps] = useHoverTooltip()

  const [
    showDeckCalibrationModal,
    setShowDeckCalibrationModal,
  ] = React.useState(false)

  const [showCalBlockModal, setShowCalBlockModal] = React.useState(false)

  const trackedRequestId = React.useRef<string | null>(null)
  const createRequestId = React.useRef<string | null>(null)
  const jogRequestId = React.useRef<string | null>(null)

  const robot = useRobot(robotName)
  const notConnectable = robot?.status !== CONNECTABLE

  const [dispatchRequests] = RobotApi.useDispatchApiRequests(
    dispatchedAction => {
      if (dispatchedAction.type === Sessions.ENSURE_SESSION) {
        createRequestId.current =
          'requestId' in dispatchedAction.meta
            ? dispatchedAction.meta.requestId ?? null
            : null
      } else if (
        dispatchedAction.type === Sessions.CREATE_SESSION_COMMAND &&
        dispatchedAction.payload.command.command ===
          Sessions.sharedCalCommands.JOG
      ) {
        jogRequestId.current =
          'requestId' in dispatchedAction.meta
            ? dispatchedAction.meta.requestId ?? null
            : null
      } else if (
        dispatchedAction.type !== Sessions.CREATE_SESSION_COMMAND ||
        !spinnerCommandBlockList.includes(
          dispatchedAction.payload.command.command
        )
      ) {
        trackedRequestId.current =
          'meta' in dispatchedAction && 'requestId' in dispatchedAction.meta
            ? dispatchedAction.meta.requestId ?? null
            : null
      }
    }
  )

  // wait for robot request to resolve instead of using name directly from params
  const deckCalibrationData = useDeckCalibrationData(robot?.name)
  const pipetteOffsetCalibrations = usePipetteOffsetCalibrations(robot?.name)
  const tipLengthCalibrations = useTipLengthCalibrations(robot?.name)
  const attachedPipettes = useAttachedPipettes(
    robot?.name != null ? robot.name : null
  )

  const isRunning = useSelector(robotSelectors.getIsRunning)
  const pipettePresent =
    !(attachedPipettes.left == null) || !(attachedPipettes.right == null)
  const isPending =
    useSelector<State, RequestState | null>(state =>
      trackedRequestId.current
        ? RobotApi.getRequestById(state, trackedRequestId.current)
        : null
    )?.status === RobotApi.PENDING

  const configHasCalibrationBlock = useSelector(Config.getHasCalibrationBlock)
  // const configHasCalibrationBlock = null
  const deckCalStatus = useSelector((state: State) => {
    return Calibration.getDeckCalibrationStatus(state, robotName)
  })

  const deckCalibrationButtonText =
    deckCalStatus && deckCalStatus !== Calibration.DECK_CAL_STATUS_IDENTITY
      ? t('deck_calibration_recalibrate_button')
      : t('deck_calibration_calibrate_button')

  const deckLastModified = (): string => {
    const data = deckCalibrationData.deckCalibrationData
    const calibratedDate = data?.lastModified ?? null
    return calibratedDate
      ? t('last_calibrated', {
          date: formatLastModified(calibratedDate),
        })
      : t('not_calibrated')
  }

  const handleStartDeckCalSession = (): void => {
    dispatchRequests(
      Sessions.ensureSession(robotName, Sessions.SESSION_TYPE_DECK_CALIBRATION)
    )
  }
  const pipOffsetDataPresent =
    pipetteOffsetCalibrations != null
      ? pipetteOffsetCalibrations.length > 0
      : false

  const {
    showConfirmation: showConfirmStart,
    confirm: confirmStart,
    cancel: cancelStart,
  } = useConditionalConfirm(handleStartDeckCalSession, !!pipOffsetDataPresent)

  const onClickSaveAs: React.MouseEventHandler = e => {
    e.preventDefault()
    doTrackEvent({
      name: EVENT_CALIBRATION_DOWNLOADED,
      properties: {},
    })
    saveAs(
      new Blob([
        JSON.stringify({
          deck: deckCalibrationData,
          pipetteOffset: pipetteOffsetCalibrations,
          tipLength: tipLengthCalibrations,
        }),
      ]),
      `opentrons-${robotName}-calibration.json`
    )
  }

  let buttonDisabledReason = null
  if (notConnectable) {
    buttonDisabledReason = t('shared:disabled_cannot_connect')
  } else if (!robot.connected) {
    buttonDisabledReason = t('shared:disabled_connect_to_robot')
  } else if (isRunning) {
    buttonDisabledReason = t('shared:disabled_protocol_is_running')
  } else if (!pipettePresent) {
    buttonDisabledReason = t('shared:disabled_no_pipette_attached')
  }

  const helthCheckButtonDisabled = Boolean(buttonDisabledReason) || isPending

  const handleHealthCheck = (
    hasBlockModalResponse: boolean | null = null
  ): void => {
    console.log('handleHealthCheck', hasBlockModalResponse)
    console.log('showCalBlockModal', showCalBlockModal)
    if (hasBlockModalResponse === null && configHasCalibrationBlock === null) {
      setShowCalBlockModal(true)
    } else {
      setShowCalBlockModal(false)
      dispatchRequests(
        Sessions.ensureSession(
          robotName,
          Sessions.SESSION_TYPE_CALIBRATION_HEALTH_CHECK,
          {
            tipRacks: [],
            hasCalibrationBlock: Boolean(
              configHasCalibrationBlock ?? hasBlockModalResponse
            ),
          }
        )
      )
    }
  }

  // console.log('pipetteOffsetCalibrations', pipetteOffsetCalibrations)
  // console.log('tipLengthCalibrations', tipLengthCalibrations)
  // console.log('attachedPipettes', attachedPipettes)

  return (
    <>
      <Portal level="top">
        {showCalBlockModal ? (
          <AskForCalibrationBlockModal
            onResponse={handleHealthCheck}
            titleBarTitle={t('robot_calibration:health_check_title')}
            closePrompt={() => setShowCalBlockModal(false)}
          />
        ) : null}
      </Portal>
      <Box paddingBottom={SPACING.spacing5}>
        <Flex alignItems={ALIGN_CENTER} justifyContent={JUSTIFY_SPACE_BETWEEN}>
          <Box marginRight={SPACING.spacing6}>
            <Box css={TYPOGRAPHY.h3SemiBold} marginBottom={SPACING.spacing3}>
              {t('about_calibration_title')}
            </Box>
            <StyledText as="p" marginBottom={SPACING.spacing3}>
              {t('about_calibration_description')}
            </StyledText>
            {showDeckCalibrationModal ? (
              <DeckCalibrationModal
                onCloseClick={() => setShowDeckCalibrationModal(false)}
              />
            ) : null}
            <Link
              color={COLORS.blue}
              css={TYPOGRAPHY.pRegular}
              onClick={() => setShowDeckCalibrationModal(true)}
            >
              {t('see_how_robot_calibration_works')}
            </Link>
          </Box>
          <TertiaryButton onClick={onClickSaveAs}>
            {t('download_calibration_data')}
          </TertiaryButton>
        </Flex>
      </Box>
      <Line />
      {/* Deck Calibration this comment will removed when finish all sections */}
      <Box paddingTop={SPACING.spacing5} paddingBottom={SPACING.spacing5}>
        <Flex alignItems={ALIGN_CENTER} justifyContent={JUSTIFY_SPACE_BETWEEN}>
          <Box marginRight={SPACING.spacing6}>
            <Box css={TYPOGRAPHY.h3SemiBold} marginBottom={SPACING.spacing3}>
              {t('deck_calibration_title')}
            </Box>
            <StyledText as="p" marginBottom={SPACING.spacing3}>
              {t('deck_calibration_description')}
            </StyledText>
            <StyledText as="label">{deckLastModified()}</StyledText>
          </Box>
          <TertiaryButton onClick={confirmStart} disabled={false}>
            {deckCalibrationButtonText}
          </TertiaryButton>
        </Flex>
      </Box>
      <Line />
      {/* Pipette Offset Calibrations this comment will removed when finish all sections */}
      <Box paddingTop={SPACING.spacing5} paddingBottom={SPACING.spacing5}>
        <Flex alignItems={ALIGN_CENTER}>
          <Box marginRight={SPACING.spacing6}>
            <Box css={TYPOGRAPHY.h3SemiBold} marginBottom={SPACING.spacing3}>
              {t('pipette_offset_calibrations_title')}
            </Box>
            <StyledText as="p" marginBottom={SPACING.spacing3}>
              {t('pipette_offset_calibrations_description')}
            </StyledText>
            {pipetteOffsetCalibrations?.map(calibration => (
              <>
                <StyledText as="p">{calibration?.pipette}</StyledText>
                <StyledText as="p">{calibration?.offset}</StyledText>
                <StyledText as="p">{calibration.mount}</StyledText>
                {/* <StyledText as="p">{calibration.}</StyledText> */}
              </>
            ))}
          </Box>
        </Flex>
      </Box>
      <Line />
      {/* Tip Length Calibrations this comment will removed when finish all sections */}
      <Box paddingTop={SPACING.spacing5} paddingBottom={SPACING.spacing5}>
        <Flex alignItems={ALIGN_CENTER}>
          <Box marginRight={SPACING.spacing6}>
            <Box css={TYPOGRAPHY.h3SemiBold} marginBottom={SPACING.spacing3}>
              {t('tip_length_calibrations_title')}
            </Box>
            <StyledText as="p" marginBottom={SPACING.spacing3}>
              {t('tip_length_calibrations_description')}
            </StyledText>
          </Box>
        </Flex>
      </Box>
      <Line />
      {/* Calibration Health Check this comment will removed when finish all sections */}
      <Box paddingTop={SPACING.spacing5} paddingBottom={SPACING.spacing5}>
        <Flex alignItems={ALIGN_CENTER} justifyContent={JUSTIFY_SPACE_BETWEEN}>
          <Box marginRight={SPACING.spacing6}>
            <Box css={TYPOGRAPHY.h3SemiBold} marginBottom={SPACING.spacing3}>
              {t('calibration_health_check_title')}
            </Box>
            <StyledText as="p" marginBottom={SPACING.spacing3}>
              {t('calibration_health_check_description')}
            </StyledText>
            {tipLengthCalibrations?.map(tip => (
              <>
                <StyledText as="p">{tip?.uri}</StyledText>
                <StyledText as="p">{tip?.pipette}</StyledText>
                <StyledText as="p">{tip?.lastModified}</StyledText>
                {/* <StyledText as="p">{calibration.}</StyledText> */}
              </>
            ))}
          </Box>
          <TertiaryButton
            onClick={() => handleHealthCheck(null)}
            disabled={helthCheckButtonDisabled}
          >
            {t('calibration_health_check_button')}
          </TertiaryButton>
          <Tooltip tooltipProps={tooltipProps} key="HealthCheckTooltip">
            {t('calibration_health_check_tooltip')}
          </Tooltip>
        </Flex>
      </Box>
    </>
  )
}
