FROM python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/workspace/api
WORKDIR /workspace
COPY api/requirements.txt api/requirements.txt
RUN pip install --no-cache-dir -r api/requirements.txt
COPY api api
RUN useradd --create-home app
USER app
EXPOSE 8000
CMD ["python", "-m", "app.scripts.start"]
