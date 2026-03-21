FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install minimal dependencies first
RUN pip install fastapi uvicorn

# Copy entire repository (maintaining structure)
COPY . .

# Expose port
EXPOSE 8000

# Run the application (main.py now exists at root and handles imports)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]