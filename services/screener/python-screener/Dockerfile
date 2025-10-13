# syntax=docker/dockerfile:1
FROM python:3.11-slim

WORKDIR /app

# Install system deps if finviz/yfinance need any (kept minimal)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8080
EXPOSE 8080

# Use gunicorn for production-grade server
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "--timeout", "120", "--access-logfile", "-", "main:app"]
