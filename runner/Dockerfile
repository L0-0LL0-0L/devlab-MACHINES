FROM python:3.12-slim
RUN apt-get update && apt-get install -y --no-install-recommends git nodejs npm ca-certificates && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 10001 machine
USER machine
WORKDIR /work
