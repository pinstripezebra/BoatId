"""
Entry point for AppRunner deployment
This file imports and runs the FastAPI app from the backend
"""

import sys
import os
import logging
import traceback
import importlib.util

# Configure logging early so any startup errors are captured in CloudWatch
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

try:
    # Add backend/src to Python path so sub-imports (api, models, utils, services) resolve
    backend_src = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'src')
    logger.info(f"Adding backend/src to sys.path: {backend_src}")
    logger.info(f"backend/src exists: {os.path.exists(backend_src)}")
    logger.info(f"Contents: {os.listdir(backend_src) if os.path.exists(backend_src) else 'N/A'}")
    sys.path.insert(0, backend_src)

    # Load backend/src/main.py under a different module name to avoid circular import
    # (this file is also named main.py, so "from main import app" would re-import itself)
    backend_main_path = os.path.join(backend_src, 'main.py')
    logger.info(f"Loading backend main from: {backend_main_path}")
    logger.info(f"File exists: {os.path.exists(backend_main_path)}")

    spec = importlib.util.spec_from_file_location(
        "backend_main",
        backend_main_path
    )
    backend_main = importlib.util.module_from_spec(spec)
    sys.modules['backend_main'] = backend_main
    spec.loader.exec_module(backend_main)

    app = backend_main.app
    logger.info(f"Successfully loaded FastAPI app with routes: {[r.path for r in app.routes]}")

except Exception as e:
    logger.error(f"FATAL: Failed to load application: {e}")
    logger.error(traceback.format_exc())
    # Re-raise so the process exits with code 1 and App Runner knows it failed
    raise