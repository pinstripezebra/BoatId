"""
Entry point for AppRunner deployment
This file imports and runs the FastAPI app from the backend
"""

import sys
import os
import importlib.util

# Add backend/src to Python path so sub-imports (api, models, utils, services) resolve
backend_src = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'backend', 'src')
sys.path.insert(0, backend_src)

# Load backend/src/main.py under a different module name to avoid circular import
# (this file is also named main.py, so "from main import app" would re-import itself)
spec = importlib.util.spec_from_file_location(
    "backend_main",
    os.path.join(backend_src, 'main.py')
)
backend_main = importlib.util.module_from_spec(spec)
sys.modules['backend_main'] = backend_main
spec.loader.exec_module(backend_main)

app = backend_main.app