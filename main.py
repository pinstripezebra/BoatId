"""
Entry point for AppRunner deployment
This file imports and runs the FastAPI app from the backend
"""

# Add backend/src to Python path
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend', 'src'))

# Import the FastAPI app directly from main module 
from main import app

# Export the app for uvicorn
__all__ = ['app']