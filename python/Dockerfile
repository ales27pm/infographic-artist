FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HOST=0.0.0.0
WORKDIR /app
COPY pyproject.toml README.md ./
COPY server.py official_server.py fallback_server.py contract.py core.py ./
COPY assets ./assets
COPY data ./data
COPY docs ./docs
RUN pip install --no-cache-dir .
EXPOSE 8000
CMD ["python", "server.py"]
