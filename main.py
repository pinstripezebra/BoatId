"""
Entry point for AppRunner deployment
This file imports and runs the FastAPI app from the backend
"""

# Add backend/src to Python path
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'src'))

# Import the FastAPI app (avoid circular import)
import backend.src.main as backend_main
app = backend_main.app

# Export the app for uvicorn
__all__ = ['app']