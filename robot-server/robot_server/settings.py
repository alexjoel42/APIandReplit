import typing
import typing_extensions
import logging
from functools import lru_cache
from pathlib import Path

from pydantic import BaseSettings, Field
from dotenv import load_dotenv

from opentrons.config import infer_config_base_dir

log = logging.getLogger(__name__)


@lru_cache(maxsize=1)
def get_settings() -> "RobotServerSettings":
    """Get the settings"""
    load_dotenv(get_dotenv_path())
    return RobotServerSettings()


def get_dotenv_path() -> Path:
    """Get the location of the settings file"""
    return Environment().dot_env_path


class Environment(BaseSettings):
    """Environment related settings"""

    dot_env_path: Path = infer_config_base_dir() / "robot.env"

    class Config:
        env_prefix = "OT_ROBOT_SERVER_"


# If you update this, also update the generated settings_schema.json.
class RobotServerSettings(BaseSettings):
    """Robot server settings.

    To override any of these create an environment variable with prefix
    OT_ROBOT_SERVER_.
    """

    simulator_configuration_file_path: typing.Optional[str] = Field(
        None,
        description="Path to a json file that describes the hardware simulator.",
    )

    notification_server_subscriber_address: str = Field(
        "tcp://localhost:5555",
        description="The endpoint to subscribe to notification server topics.",
    )

    persistence_directory: typing.Union[
        # Literal must come first to avoid Pydantic parsing it as a relative Path
        # with the filename "automatically_make_temporary".
        typing_extensions.Literal["automatically_make_temporary"],
        Path,
    ] = Field(
        ...,
        description=(
            "A directory for the server to store things persistently across boots."
            " If the directory doesn't already exist, it will be created."
            " If this is the string `automatically_make_temporary`,"
            " the server will use a fresh temporary directory"
            " (effectively not persisting anything)."
            "\n\n"
            "Note that the `opentrons` library is also responsible for persisting"
            " certain things, and it has its own configuration."
        )
    )

    class Config:
        env_prefix = "OT_ROBOT_SERVER_"
