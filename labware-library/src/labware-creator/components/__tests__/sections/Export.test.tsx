import React from 'react'
import { when } from 'jest-when'
import { FormikConfig } from 'formik'
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import { getDefaultFormState, LabwareFields } from '../../../fields'
import { isEveryFieldHidden } from '../../../utils'
import { Export } from '../../sections/Export'
import { wrapInFormik } from '../../utils/wrapInFormik'

jest.mock('../../../utils')

const isEveryFieldHiddenMock = isEveryFieldHidden as jest.MockedFunction<
  typeof isEveryFieldHidden
>

let formikConfig: FormikConfig<LabwareFields>
let onExportClick: (e: any) => unknown

describe('Export', () => {
  beforeEach(() => {
    formikConfig = {
      initialValues: getDefaultFormState(),
      onSubmit: jest.fn(),
    }

    onExportClick = jest.fn()

    when(isEveryFieldHiddenMock)
      .calledWith(['pipetteName'], formikConfig.initialValues)
      .mockReturnValue(false)
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('should render headings & fields when section is visible', () => {
    render(wrapInFormik(<Export onExportClick={onExportClick} />, formikConfig))

    const headings = screen.getAllByRole('heading')
    expect(headings).toHaveLength(2)
    expect(headings[0]).toHaveTextContent(/labware test protocol/i)
    expect(headings[1]).toHaveTextContent(/please test your definition file/i)

    screen.getByText(
      'Your file will be exported with a protocol that will help you test and troubleshoot your labware definition on the robot. ' +
        'The protocol requires a Single Channel pipette on the right mount of your robot.'
    )

    screen.getByRole('textbox', { name: /test pipette/i })
    screen.getByRole('button', { name: /export/i })
  })

  it('should render alert when error is present', () => {
    const FAKE_ERROR = 'ahh'
    formikConfig.initialErrors = { pipetteName: FAKE_ERROR }
    formikConfig.initialTouched = { pipetteName: true }
    render(wrapInFormik(<Export onExportClick={onExportClick} />, formikConfig))

    // TODO(IL, 2021-05-26): AlertItem should have role="alert", then we can `getByRole('alert', {name: FAKE_ERROR})`
    screen.getByText(FAKE_ERROR)
  })

  it('should not render when all of the fields are hidden', () => {
    when(isEveryFieldHiddenMock)
      .calledWith(['pipetteName'], formikConfig.initialValues)
      .mockReturnValue(true)

    const { container } = render(
      wrapInFormik(<Export onExportClick={onExportClick} />, formikConfig)
    )
    expect(container.firstChild).toBe(null)
  })
})
