FROM python:3.13-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY main.py .

# Expose port
EXPOSE 8088

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8088", "--workers", "2", "--timeout", "120", "main:app"]

