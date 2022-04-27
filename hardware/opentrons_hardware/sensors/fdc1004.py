"""Capacitve Sensor Driver Class."""

from typing import Optional

from opentrons_hardware.drivers.can_bus.can_messenger import CanMessenger
from opentrons_hardware.firmware_bindings.constants import SensorType, NodeId
from opentrons_hardware.sensors.utils import (
    ReadSensorInformation,
    PollSensorInformation,
    WriteSensorInformation,
    SensorThresholdInformation,
    SensorDataType,
)

from .sensor_abc import AbstractAdvancedSensor
from .scheduler import SensorScheduler


class CapacitiveSensor(AbstractAdvancedSensor):
    """FDC1004 Driver."""

    def __init__(
        self,
        zero_threshold: float = 0.0,
        stop_threshold: float = 0.0,
        offset: float = 0.0,
    ) -> None:
        """Constructor."""
        super().__init__(zero_threshold, stop_threshold, offset, SensorType.capacitive)

    async def poll(
        self,
        can_messenger: CanMessenger,
        node_id: NodeId,
        poll_for: int,
        timeout: int = 1,
    ) -> Optional[SensorDataType]:
        """Poll the capacitive sensor."""
        poll = PollSensorInformation(self._sensor_type, node_id, poll_for)
        scheduler = SensorScheduler()
        return await scheduler.run_poll(poll, can_messenger, timeout)

    async def read(
        self,
        can_messenger: CanMessenger,
        node_id: NodeId,
        offset: bool,
        timeout: int = 1,
    ) -> Optional[SensorDataType]:
        """Single read of the capacitive sensor."""
        read = ReadSensorInformation(self._sensor_type, node_id, offset)
        scheduler = SensorScheduler()
        return await scheduler.send_read(read, can_messenger, timeout)

    async def write(
        self, can_messenger: CanMessenger, node_id: NodeId, data: SensorDataType
    ) -> None:
        """Write to a register of the capacitive sensor."""
        write = WriteSensorInformation(self._sensor_type, node_id, data)
        scheduler = SensorScheduler()
        await scheduler.send_write(write, can_messenger)

    async def send_zero_threshold(
        self,
        can_messenger: CanMessenger,
        node_id: NodeId,
        threshold: SensorDataType,
        timeout: int = 1,
    ) -> Optional[SensorDataType]:
        """Send the zero threshold which the offset value is compared to."""
        write = SensorThresholdInformation(self._sensor_type, node_id, threshold)
        scheduler = SensorScheduler()
        threshold_data = await scheduler.send_threshold(write, can_messenger, timeout)
        if threshold_data:
            self.zero_threshold = threshold_data.to_float()
        return threshold_data
