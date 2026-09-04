"""PaddleOCR worker for Rúflo's DIGITALIZACAO agent (docs/RDIA_PRD.md, chunk 2a).

Runs as its own Cloud Run service — private, IAM-only, never
`--allow-unauthenticated` (see docs/DEPLOY.md) — because PaddleOCR is
Python, not Node, so it can't live inside the main app like every other
Rúflo agent does. The main app calls it over HTTP via
src/agents/digitalizacao/ocrClient.js, authenticated with a Google-signed
ID token (Cloud Run service-to-service auth).

Two endpoints, matching what ocrClient.js expects:
  POST /ocr    -> {text, confidence, pages}          plain text extraction
  POST /table  -> {table_rows, confidence}            PP-Structure table extraction
"""

import base64
import io
from typing import Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="ruflo-paddleocr")

# Both engines are expensive to construct (they load model weights), and
# Cloud Run keeps the container warm between requests on the same instance
# — build each at most once per instance instead of per-request.
_ocr_engine = None
_table_engine = None


def get_ocr_engine():
	global _ocr_engine
	if _ocr_engine is None:
		from paddleocr import PaddleOCR

		_ocr_engine = PaddleOCR(use_angle_cls=True, lang="en", show_log=False)
	return _ocr_engine


def get_table_engine():
	global _table_engine
	if _table_engine is None:
		from paddleocr import PPStructure

		_table_engine = PPStructure(show_log=False, layout=False)
	return _table_engine


class OcrRequest(BaseModel):
	file_base64: str
	mime_type: str


class OcrResponse(BaseModel):
	text: str
	confidence: float
	pages: int


class TableResponse(BaseModel):
	table_rows: list[dict[str, Any]]
	confidence: float


def decode_to_images(file_base64: str, mime_type: str):
	"""Returns a list of PIL images — one per page for a PDF, one image
	otherwise. PaddleOCR/PPStructure both operate on raster images, so a
	scanned PDF has to be rasterized first (pdf2image + the poppler-utils
	system package installed in the Dockerfile)."""
	raw = base64.b64decode(file_base64)
	if mime_type == "application/pdf":
		from pdf2image import convert_from_bytes

		return convert_from_bytes(raw)
	from PIL import Image

	return [Image.open(io.BytesIO(raw)).convert("RGB")]


def table_html_to_rows(html: str) -> list[dict[str, Any]]:
	"""PPStructure's table module returns an HTML <table> string; normalize
	it into the same [{header: value}, ...] shape
	structuredFileExtractor.js already produces for xlsx (via
	sheet_to_json), so tableExtractor.js on the Node side needs no
	source-specific handling."""
	try:
		import pandas as pd

		tables = pd.read_html(io.StringIO(html))
	except (ValueError, ImportError):
		return []
	if not tables:
		return []
	return tables[0].to_dict(orient="records")


@app.get("/health")
def health():
	return {"status": "ok"}


@app.post("/ocr", response_model=OcrResponse)
def ocr(req: OcrRequest):
	try:
		images = decode_to_images(req.file_base64, req.mime_type)
	except Exception as exc:  # noqa: BLE001 - any decode failure is a 400, not a 500
		raise HTTPException(status_code=400, detail=f"could not decode file: {exc}") from exc

	import numpy as np

	engine = get_ocr_engine()
	lines: list[str] = []
	confidences: list[float] = []
	for image in images:
		for page_result in engine.ocr(np.array(image), cls=True) or []:
			for _box, (line_text, line_confidence) in page_result or []:
				lines.append(line_text)
				confidences.append(line_confidence)

	overall_confidence = sum(confidences) / len(confidences) if confidences else 0.0
	return OcrResponse(text="\n".join(lines), confidence=overall_confidence, pages=len(images))


@app.post("/table", response_model=TableResponse)
def table(req: OcrRequest):
	try:
		images = decode_to_images(req.file_base64, req.mime_type)
	except Exception as exc:  # noqa: BLE001 - any decode failure is a 400, not a 500
		raise HTTPException(status_code=400, detail=f"could not decode file: {exc}") from exc

	import numpy as np

	engine = get_table_engine()
	all_rows: list[dict[str, Any]] = []
	confidences: list[float] = []
	for image in images:
		for region in engine(np.array(image)):
			if region.get("type") != "table":
				continue
			res = region.get("res", {})
			all_rows.extend(table_html_to_rows(res.get("html", "")))
			if "confidence" in res:
				confidences.append(res["confidence"])

	overall_confidence = sum(confidences) / len(confidences) if confidences else 0.0
	return TableResponse(table_rows=all_rows, confidence=overall_confidence)
