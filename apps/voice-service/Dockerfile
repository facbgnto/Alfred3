FROM python:3.11-slim

WORKDIR /app

# Instalar dependencias del sistema para audio
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    alsa-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8765

CMD ["python", "run.py"]
