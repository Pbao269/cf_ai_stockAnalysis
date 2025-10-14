FROM python:3.11-slim

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY main.py .

# Expose port
EXPOSE 8084

# Run with gunicorn
CMD ["gunicorn", "--bind", "0.0.0.0:8084", "--workers", "2", "--timeout", "60", "main:app"]

