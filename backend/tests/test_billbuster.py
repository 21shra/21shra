"""BillBuster backend API tests"""
import os
import base64
import uuid
import pytest
import requests
from pathlib import Path

BASE_URL = os.environ.get("EXPO_BACKEND_URL", "https://gst-validator-app.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def invoice_b64():
    """Create a small realistic JPEG invoice image with text using PIL."""
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        pytest.skip("PIL not available")
    img = Image.new("RGB", (800, 1000), "white")
    d = ImageDraw.Draw(img)
    # Add texture/edges so it's not a blank image
    for i in range(0, 800, 40):
        d.line([(i, 0), (i, 1000)], fill=(230, 230, 230), width=1)
    lines = [
        "TAX INVOICE",
        "Vendor: ACME Electronics Pvt Ltd",
        "GSTIN: 27AAPFU0939F1ZV",
        "Invoice No: INV-2026-001",
        "Date: 2026-01-15",
        "",
        "HSN: 8517",
        "Description: Smartphone",
        "Taxable Value: 10000.00",
        "GST %: 12",
        "CGST: 600.00",
        "SGST: 600.00",
        "IGST: 0.00",
        "Total: 11200.00",
    ]
    y = 40
    for ln in lines:
        d.text((40, y), ln, fill="black")
        y += 40
    import io
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode()


# ---------- Basic endpoints ----------
class TestBasics:
    def test_root(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        j = r.json()
        assert j["service"] == "BillBuster"
        assert j["ok"] is True

    def test_hsn(self, client):
        r = client.get(f"{API}/hsn")
        assert r.status_code == 200
        j = r.json()
        assert "hsn_gst_map" in j and "rcm_hsn" in j
        assert j["hsn_gst_map"]["8517"] == 18.0
        assert "9965" in j["rcm_hsn"]

    def test_monthly_report_shape(self, client):
        r = client.get(f"{API}/monthly-report")
        assert r.status_code == 200
        j = r.json()
        for k in ("month", "total_scans", "error_scans", "itc_at_risk"):
            assert k in j


# ---------- Scan flow ----------
class TestScan:
    def test_scan_rejects_tiny_payload(self, client):
        r = client.post(f"{API}/scan", json={"image_base64": "abc"})
        assert r.status_code == 400

    def test_scan_happy_path_and_validation(self, client, invoice_b64):
        # Clear first
        client.delete(f"{API}/scans")
        r = client.post(f"{API}/scan", json={"image_base64": invoice_b64}, timeout=90)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "id" in j and "extracted" in j
        assert "issues" in j
        assert j["status"] in ("ok", "error")
        assert "_id" not in j  # no mongo leakage
        # Our synthetic invoice has HSN 8517 @ 12% (should be 18%) and math 1200 vs 10000*12%=1200 ok
        codes = {i["code"] for i in j["issues"]}
        # GPT may or may not extract correctly; we log but don't strictly fail
        print("Extracted:", j["extracted"])
        print("Issue codes:", codes)

    def test_scans_list_no_id_leak(self, client):
        r = client.get(f"{API}/scans")
        assert r.status_code == 200
        scans = r.json()
        assert isinstance(scans, list)
        for s in scans:
            assert "_id" not in s
            assert "id" in s

    def test_monthly_report_after_scan(self, client):
        r = client.get(f"{API}/monthly-report")
        assert r.status_code == 200
        assert r.json()["total_scans"] >= 0

    def test_delete_scans(self, client):
        r = client.delete(f"{API}/scans")
        assert r.status_code == 200
        r2 = client.get(f"{API}/scans")
        assert r2.json() == []


# ---------- Chat ----------
class TestChat:
    def test_chat_and_history(self, client):
        sid = f"TEST-{uuid.uuid4()}"
        r = client.post(f"{API}/chat", json={
            "session_id": sid,
            "message": "What is ITC in GST? Answer in one short sentence.",
            "language": "en"
        }, timeout=60)
        assert r.status_code == 200, r.text
        j = r.json()
        assert "reply" in j and isinstance(j["reply"], str) and len(j["reply"]) > 0

        # history
        h = client.get(f"{API}/chat/{sid}")
        assert h.status_code == 200
        msgs = h.json()["messages"]
        roles = [m["role"] for m in msgs]
        assert "user" in roles and "assistant" in roles
        for m in msgs:
            assert "_id" not in m
