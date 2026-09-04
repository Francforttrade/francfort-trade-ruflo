FROM python:3.11-slim

# poppler-utils: pdf2image's runtime dependency for rasterizing scanned PDFs
# before PaddleOCR (which only accepts images) can read them.
# libgl1/libglib2.0-0: opencv-python (a paddleocr dependency) needs these at
# runtime even headless, and they're not in the slim base image.
RUN apt-get update && apt-get install -y --no-install-recommends \
		poppler-utils \
		libgl1 \
		libglib2.0-0 \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY app.py ./

ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
