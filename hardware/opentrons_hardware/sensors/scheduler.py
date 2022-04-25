"""Sensor driver message scheduler."""
import asyncio
import logging
from contextlib import asynccontextmanager

from typing import Optional, Type, TypeVar, Callable, AsyncIterator

from opentrons_hardware.firmware_bindings.constants import NodeId, SensorOutputBinding

from opentrons_hardware.drivers.can_bus.can_messenger import (
    CanMessenger,
    WaitableCallback,
)

from opentrons_hardware.firmware_bindings.messages.message_definitions import (
    ReadFromSensorRequest,
    SetSensorThresholdRequest,
    WriteToSensorRequest,
    BaselineSensorRequest,
    SensorThresholdResponse,
    ReadFromSensorResponse,
    BindSensorOutputRequest,
    BindSensorOutputResponse,
)
from opentrons_hardware.firmware_bindings.messages.messages import MessageDefinition
from opentrons_hardware.firmware_bindings.messages.payloads import (
    ReadFromSensorRequestPayload,
    SetSensorThresholdRequestPayload,
    WriteToSensorRequestPayload,
    BaselineSensorRequestPayload,
    BindSensorOutputRequestPayload,
)
from opentrons_hardware.firmware_bindings.messages.fields import (
    SensorTypeField,
    SensorOutputBindingField,
)

from opentrons_hardware.sensors.utils import (
    ReadSensorInformation,
    SensorDataType,
    WriteSensorInformation,
    PollSensorInformation,
    SensorThresholdInformation,
    SensorInformation,
)
from opentrons_hardware.firmware_bindings.utils import (
    UInt8Field,
    UInt16Field,
    UInt32Field,
    Int32Field,
)


log = logging.getLogger(__name__)
ResponseType = TypeVar("ResponseType", bound=MessageDefinition)


class SensorScheduler:
    """Sensor message scheduler."""

    async def run_poll(
        self, sensor: PollSensorInformation, can_messenger: CanMessenger, timeout: int
    ) -> Optional[SensorDataType]:
        """Send poll message."""
        with WaitableCallback(can_messenger) as reader:
            data: Optional[SensorDataType] = None
            await can_messenger.send(
                node_id=sensor.node_id,
                message=BaselineSensorRequest(
                    payload=BaselineSensorRequestPayload(
                        sensor=SensorTypeField(sensor.sensor_type),
                        sample_rate=UInt16Field(sensor.poll_for),
                    )
                ),
            )
            try:

                def _format(message: ReadFromSensorResponse) -> SensorDataType:
                    return SensorDataType.build(message.payload.sensor_data)

                data = await asyncio.wait_for(
                    self._wait_for_response(
                        sensor.node_id, reader, ReadFromSensorResponse, _format
                    ),
                    timeout,
                )
            except asyncio.TimeoutError:
                log.warning("Sensor poll timed out")
            finally:
                return data

    async def send_write(
        self, sensor: WriteSensorInformation, can_messenger: CanMessenger
    ) -> None:
        """Send write message."""
        await can_messenger.send(
            node_id=sensor.node_id,
            message=WriteToSensorRequest(
                payload=WriteToSensorRequestPayload(
                    sensor=SensorTypeField(sensor.sensor_type),
                    data=UInt32Field(sensor.data.to_int),
                    # TODO(lc, 03-29-2022, actually pass in a register value)
                    reg_address=UInt8Field(0x0),
                )
            ),
        )

    async def send_read(
        self, sensor: ReadSensorInformation, can_messenger: CanMessenger, timeout: int
    ) -> Optional[SensorDataType]:
        """Send read message."""
        with WaitableCallback(can_messenger) as reader:
            data: Optional[SensorDataType] = None
            await can_messenger.send(
                node_id=sensor.node_id,
                message=ReadFromSensorRequest(
                    payload=ReadFromSensorRequestPayload(
                        sensor=SensorTypeField(sensor.sensor_type),
                        offset_reading=UInt8Field(int(sensor.offset)),
                    )
                ),
            )
            try:

                def _format(response: ReadFromSensorResponse) -> SensorDataType:
                    return SensorDataType.build(response.payload.sensor_data)

                data = await asyncio.wait_for(
                    self._wait_for_response(
                        sensor.node_id, reader, ReadFromSensorResponse, _format
                    ),
                    timeout,
                )
            except asyncio.TimeoutError:
                log.warning("Sensor Read timed out")
            finally:
                return data

    async def send_threshold(
        self,
        sensor: SensorThresholdInformation,
        can_messenger: CanMessenger,
        timeout: float = 1.0,
    ) -> Optional[SensorDataType]:
        """Send threshold message."""
        with WaitableCallback(can_messenger) as reader:
            data: Optional[SensorDataType] = None
            await can_messenger.send(
                node_id=sensor.node_id,
                message=SetSensorThresholdRequest(
                    payload=SetSensorThresholdRequestPayload(
                        sensor=SensorTypeField(sensor.sensor_type),
                        threshold=Int32Field(
                            0 if sensor.data == "auto" else sensor.data.to_int
                        ),
                    )
                ),
            )
            try:

                def _format(response: SensorThresholdResponse) -> SensorDataType:
                    return SensorDataType.build(response.payload.threshold)

                data = await asyncio.wait_for(
                    self._wait_for_response(
                        sensor.node_id, reader, SensorThresholdResponse, _format
                    ),
                    timeout,
                )
            except asyncio.TimeoutError:
                log.warning("Sensor Read timed out")
            finally:
                return data

    @staticmethod
    async def _wait_for_response(
        node_id: NodeId,
        reader: WaitableCallback,
        response_def: Type[ResponseType],
        response_handler: Callable[[ResponseType], Optional[SensorDataType]],
    ) -> Optional[SensorDataType]:
        """Listener for receiving messages back."""
        async for response, arbitration_id in reader:
            if arbitration_id.parts.originating_node_id == node_id:
                if isinstance(response, response_def):
                    return response_handler(response)
        return None

    @asynccontextmanager
    async def bind_sync(
        self,
        target_sensor: SensorInformation,
        can_messenger: CanMessenger,
        timeout: float = 0.5,
    ) -> AsyncIterator[None]:
        """While acquired, bind the specified sensor to control sync."""
        with WaitableCallback(can_messenger) as completion_reader:
            await can_messenger.send(
                node_id=target_sensor.node_id,
                message=BindSensorOutputRequest(
                    payload=BindSensorOutputRequestPayload(
                        sensor=SensorTypeField(target_sensor.sensor_type),
                        binding=SensorOutputBindingField(SensorOutputBinding.sync),
                    )
                ),
            )
            try:

                def _format(response: BindSensorOutputResponse) -> None:
                    return None

                await asyncio.wait_for(
                    self._wait_for_response(
                        target_sensor.node_id,
                        completion_reader,
                        BindSensorOutputResponse,
                        _format,
                    ),
                    timeout,
                )
            finally:
                log.exception(
                    f"Failed to bind {target_sensor.sensor_type} on "
                    f"{target_sensor.node_id}"
                )
        try:
            yield
        finally:
            await can_messenger.send(
                node_id=target_sensor.node_id,
                message=BindSensorOutputRequest(
                    payload=BindSensorOutputRequestPayload(
                        sensor=SensorTypeField(target_sensor.sensor_type),
                        binding=SensorOutputBindingField(
                            SensorOutputBinding.none.value
                        ),
                    )
                ),
            )
