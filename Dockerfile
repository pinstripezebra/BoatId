FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install minimal dependencies first
RUN pip install fastapi uvicorn

# Copy backend source code
COPY backend/src/ .

# Expose port
EXPOSE 8000

# Run the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]