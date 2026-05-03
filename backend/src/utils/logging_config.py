import json
import logging
import os
from datetime import datetime, timezone


class JSONFormatter(logging.Formatter):
    """Emit log records as single-line JSON — queryable in CloudWatch Logs Insights."""

    _SKIP_FIELDS = frozenset({
        "args", "created", "exc_info", "exc_text", "filename", "funcName",
        "levelname", "levelno", "lineno", "message", "module", "msecs",
        "msg", "name", "pathname", "process", "processName",
        "relativeCreated", "stack_info", "thread", "threadName",
    })

    def format(self, record: logging.LogRecord) -> str:
        # Derive a short component name from the logger hierarchy.
        # Loggers named "carid.<component>" → component = "<component>".
        # Fallback: use the top-level package segment.
        name = record.name
        if name.startswith("carid."):
            component = name[len("carid."):]
        else:
            component = name.split(".")[0]

        entry: dict = {
            "timestamp": datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "component": component,
            "message": record.getMessage(),
        }

        # Merge any extra fields injected via extra={...}
        for key, value in record.__dict__.items():
            if key not in self._SKIP_FIELDS:
                entry[key] = value

        if record.exc_info:
            entry["exception"] = self.formatException(record.exc_info)

        return json.dumps(entry, default=str)


def configure_logging() -> None:
    """
    Replace the root logger's handlers with a single JSON stream handler.
    Call once at application startup before any loggers are used.

    LOG_LEVEL env var controls verbosity (default: INFO).
    """
    log_level = getattr(logging, os.getenv("LOG_LEVEL", "INFO").upper(), logging.INFO)

    handler = logging.StreamHandler()
    handler.setFormatter(JSONFormatter())

    root = logging.getLogger()
    root.handlers.clear()
    root.setLevel(log_level)
    root.addHandler(handler)

    # Suppress noisy third-party libraries
    for name in ("botocore", "boto3", "urllib3", "httpx", "anthropic", "uvicorn.access"):
        logging.getLogger(name).setLevel(logging.WARNING)
