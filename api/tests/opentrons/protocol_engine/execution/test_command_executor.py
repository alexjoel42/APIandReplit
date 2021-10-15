"""Smoke tests for the CommandExecutor class."""
import pytest
from datetime import datetime
from decoy import Decoy
from pydantic import BaseModel
from typing import Optional, Type, cast

from opentrons.protocol_engine.errors import ProtocolEngineError
from opentrons.protocol_engine.resources import ModelUtils
from opentrons.protocol_engine.state import StateStore

from opentrons.protocol_engine.actions import (
    ActionDispatcher,
    CommandUpdatedAction,
    CommandFailedAction,
)

from opentrons.protocol_engine.commands import (
    AbstractCommandImpl,
    BaseCommand,
    CommandStatus,
    Command,
)

from opentrons.protocol_engine.execution import (
    CommandExecutor,
    EquipmentHandler,
    MovementHandler,
    PipettingHandler,
    RunControlHandler,
)


@pytest.fixture
def state_store(decoy: Decoy) -> StateStore:
    """Get a mocked out StateStore."""
    return decoy.mock(cls=StateStore)


@pytest.fixture
def action_dispatcher(decoy: Decoy) -> ActionDispatcher:
    """Get a mocked out ActionDispatcher."""
    return decoy.mock(cls=ActionDispatcher)


@pytest.fixture
def equipment(decoy: Decoy) -> EquipmentHandler:
    """Get a mocked out EquipmentHandler."""
    return decoy.mock(cls=EquipmentHandler)


@pytest.fixture
def movement(decoy: Decoy) -> MovementHandler:
    """Get a mocked out MovementHandler."""
    return decoy.mock(cls=MovementHandler)


@pytest.fixture
def pipetting(decoy: Decoy) -> PipettingHandler:
    """Get a mocked out PipettingHandler."""
    return decoy.mock(cls=PipettingHandler)


@pytest.fixture
def run_control(decoy: Decoy) -> RunControlHandler:
    """Get a mocked out RunControlHandler."""
    return decoy.mock(cls=RunControlHandler)


@pytest.fixture
def model_utils(decoy: Decoy) -> ModelUtils:
    """Get a mocked out ModelUtils."""
    return decoy.mock(cls=ModelUtils)


@pytest.fixture
def subject(
    state_store: StateStore,
    action_dispatcher: ActionDispatcher,
    equipment: EquipmentHandler,
    movement: MovementHandler,
    pipetting: PipettingHandler,
    run_control: RunControlHandler,
    model_utils: ModelUtils,
) -> CommandExecutor:
    """Get a CommandExecutor test subject with its dependencies mocked out."""
    return CommandExecutor(
        state_store=state_store,
        action_dispatcher=action_dispatcher,
        equipment=equipment,
        movement=movement,
        pipetting=pipetting,
        run_control=run_control,
        model_utils=model_utils,
    )


class _TestCommandData(BaseModel):
    foo: str = "foo"


class _TestCommandResult(BaseModel):
    bar: str = "bar"


class _TestCommandImpl(AbstractCommandImpl[_TestCommandData, _TestCommandResult]):
    async def execute(self, data: _TestCommandData) -> _TestCommandResult:
        raise NotImplementedError()


async def test_execute(
    decoy: Decoy,
    state_store: StateStore,
    action_dispatcher: ActionDispatcher,
    equipment: EquipmentHandler,
    movement: MovementHandler,
    pipetting: PipettingHandler,
    run_control: RunControlHandler,
    model_utils: ModelUtils,
    subject: CommandExecutor,
) -> None:
    """It should be able execute a command."""
    TestCommandImplCls = decoy.mock(func=_TestCommandImpl)
    command_impl = decoy.mock(cls=_TestCommandImpl)

    class _TestCommand(BaseCommand[_TestCommandData, _TestCommandResult]):
        commandType: str = "testCommand"
        data: _TestCommandData
        result: Optional[_TestCommandResult]

        @property
        def _ImplementationCls(self) -> Type[_TestCommandImpl]:
            return TestCommandImplCls

    command_data = _TestCommandData()
    command_result = _TestCommandResult()

    queued_command = cast(
        Command,
        _TestCommand(
            id="command-id",
            createdAt=datetime(year=2021, month=1, day=1),
            status=CommandStatus.QUEUED,
            data=command_data,
        ),
    )

    decoy.when(state_store.commands.get(command_id="command-id")).then_return(
        queued_command
    )

    decoy.when(
        queued_command._ImplementationCls(
            equipment=equipment,
            movement=movement,
            pipetting=pipetting,
            run_control=run_control,
        )
    ).then_return(
        command_impl  # type: ignore[arg-type]
    )

    decoy.when(await command_impl.execute(command_data)).then_return(command_result)

    decoy.when(model_utils.get_timestamp()).then_return(
        datetime(year=2022, month=2, day=2),
        datetime(year=2023, month=3, day=3),
    )

    await subject.execute("command-id")

    decoy.verify(
        action_dispatcher.dispatch(
            CommandUpdatedAction(
                command=cast(
                    Command,
                    _TestCommand(
                        id="command-id",
                        createdAt=datetime(year=2021, month=1, day=1),
                        startedAt=datetime(year=2022, month=2, day=2),
                        status=CommandStatus.RUNNING,
                        data=command_data,
                    ),
                )
            ),
        ),
        action_dispatcher.dispatch(
            CommandUpdatedAction(
                command=cast(
                    Command,
                    _TestCommand(
                        id="command-id",
                        createdAt=datetime(year=2021, month=1, day=1),
                        startedAt=datetime(year=2022, month=2, day=2),
                        completedAt=datetime(year=2023, month=3, day=3),
                        status=CommandStatus.SUCCEEDED,
                        data=command_data,
                        result=command_result,
                    ),
                )
            )
        ),
    )


async def test_execute_raises_protocol_engine_error(
    decoy: Decoy,
    state_store: StateStore,
    action_dispatcher: ActionDispatcher,
    equipment: EquipmentHandler,
    movement: MovementHandler,
    pipetting: PipettingHandler,
    run_control: RunControlHandler,
    model_utils: ModelUtils,
    subject: CommandExecutor,
) -> None:
    """It should be able execute a command."""
    TestCommandImplCls = decoy.mock(func=_TestCommandImpl)
    command_impl = decoy.mock(cls=_TestCommandImpl)

    class _TestCommand(BaseCommand[_TestCommandData, _TestCommandResult]):
        commandType: str = "testCommand"
        data: _TestCommandData
        result: Optional[_TestCommandResult]

        @property
        def _ImplementationCls(self) -> Type[_TestCommandImpl]:
            return TestCommandImplCls

    command_data = _TestCommandData()
    command_error = ProtocolEngineError("oh no")

    queued_command = cast(
        Command,
        _TestCommand(
            id="command-id",
            createdAt=datetime(year=2021, month=1, day=1),
            status=CommandStatus.QUEUED,
            data=command_data,
        ),
    )

    decoy.when(state_store.commands.get(command_id="command-id")).then_return(
        queued_command
    )

    decoy.when(
        queued_command._ImplementationCls(
            equipment=equipment,
            movement=movement,
            pipetting=pipetting,
            run_control=run_control,
        )
    ).then_return(
        command_impl  # type: ignore[arg-type]
    )

    decoy.when(await command_impl.execute(command_data)).then_raise(command_error)

    decoy.when(model_utils.get_timestamp()).then_return(
        datetime(year=2022, month=2, day=2),
        datetime(year=2023, month=3, day=3),
    )
    decoy.when(model_utils.generate_id()).then_return("error-id")

    await subject.execute("command-id")

    decoy.verify(
        action_dispatcher.dispatch(
            CommandUpdatedAction(
                command=cast(
                    Command,
                    _TestCommand(
                        id="command-id",
                        createdAt=datetime(year=2021, month=1, day=1),
                        startedAt=datetime(year=2022, month=2, day=2),
                        status=CommandStatus.RUNNING,
                        data=command_data,
                    ),
                )
            )
        ),
        action_dispatcher.dispatch(
            CommandFailedAction(
                command_id="command-id",
                completed_at=datetime(year=2023, month=3, day=3),
                error=command_error,
                error_id="error-id",
            )
        ),
    )
