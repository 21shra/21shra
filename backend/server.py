from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import re
import json
import logging
import uuid
from pathlib import Path
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("billbuster")

MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

if not MONGO_URL:
    logger.error("MONGO_URL environment variable is not set. Backend cannot connect to MongoDB.")
if not DB_NAME:
    logger.error("DB_NAME environment variable is not set.")

client = AsyncIOMotorClient(MONGO_URL) if MONGO_URL else None
db = client[DB_NAME] if (client and DB_NAME) else None


@asynccontextmanager
async def lifespan(app: FastAPI):
    if db is not None:
        try:
            await client.admin.command("ping")
            logger.info("MongoDB connected: db=%s", DB_NAME)
        except Exception as e:
            logger.error("MongoDB ping failed: %s", e)
    yield
    if client is not None:
        client.close()


app = FastAPI(title="BillShiHai API", lifespan=lifespan)
api = APIRouter(prefix="/api")

# ---------------- HSN -> GST mapping (hardcoded master) ----------------
HSN_GST_MAP: Dict[str, float] = {
    # Services
    "9961": 18.0,  # Wholesale trade services
    "9983": 18.0,  # Other professional, technical services
    "9954": 18.0,  # Construction services
    "9987": 18.0,  # Maintenance, repair
    "9985": 18.0,  # Support services
    # Goods
    "8517": 18.0,  # Telephones / smartphones
    "8471": 18.0,  # Computers
    "8528": 28.0,  # Monitors / TVs
    "8418": 28.0,  # Refrigerators
    "1006": 5.0,   # Rice
    "1905": 18.0,  # Biscuits / bread items
    "3004": 12.0,  # Medicines
    "6109": 12.0,  # T-shirts
    "4901": 0.0,   # Printed books
}

RCM_HSN_CODES = {"9965", "9966", "9983", "9971"}  # common RCM services (GTA, legal, etc.)

GSTIN_REGEX = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")


def is_valid_gstin(gstin: str) -> bool:
    if not gstin:
        return False
    return bool(GSTIN_REGEX.match(gstin.strip().upper()))


# ---------------- Models ----------------
class ExtractedInvoice(BaseModel):
    vendor_name: Optional[str] = None
    vendor_gstin: Optional[str] = None
    invoice_number: Optional[str] = None
    invoice_date: Optional[str] = None
    hsn_code: Optional[str] = None
    taxable_value: Optional[float] = None
    gst_percent: Optional[float] = None
    cgst_amount: Optional[float] = None
    sgst_amount: Optional[float] = None
    igst_amount: Optional[float] = None
    total_amount: Optional[float] = None


class ValidationIssue(BaseModel):
    code: str
    severity: str  # "error" | "warning"
    message_en: str
    message_hi: str
    message_mr: str
    fix_en: str
    fix_hi: str
    fix_mr: str


class ScanResult(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    extracted: ExtractedInvoice
    issues: List[ValidationIssue] = []
    itc_at_risk: float = 0.0
    status: str = "ok"  # "ok" | "error"


class ScanRequest(BaseModel):
    image_base64: str


class ChatRequest(BaseModel):
    session_id: str
    message: str
    language: str = "en"  # en | hi | mr


class ChatResponse(BaseModel):
    reply: str


# ---------------- Validation Engine ----------------
def validate_invoice(inv: ExtractedInvoice) -> (List[ValidationIssue], float):
    issues: List[ValidationIssue] = []
    itc_risk = 0.0

    # 1) GSTIN format
    if not inv.vendor_gstin or not is_valid_gstin(inv.vendor_gstin):
        issues.append(ValidationIssue(
            code="GSTIN_INVALID",
            severity="error",
            message_en=f"Vendor GSTIN '{inv.vendor_gstin or '—'}' is invalid format.",
            message_hi=f"वेंडर GSTIN '{inv.vendor_gstin or '—'}' का फॉर्मेट गलत है.",
            message_mr=f"वेंडरचा GSTIN '{inv.vendor_gstin or '—'}' फॉरमॅट चुकीचा आहे.",
            fix_en="Ask vendor for a valid 15-character GSTIN.",
            fix_hi="वेंडर से सही 15-अंकों का GSTIN मांगें.",
            fix_mr="विक्रेत्याकडून बरोबर १५ अंकी GSTIN मागवा.",
        ))

    # 2) HSN vs GST%
    expected_gst = None
    if inv.hsn_code:
        hsn4 = inv.hsn_code.strip()[:4]
        expected_gst = HSN_GST_MAP.get(hsn4)
    if expected_gst is not None and inv.gst_percent is not None:
        if abs(float(inv.gst_percent) - expected_gst) > 0.5:
            diff_amt = 0.0
            if inv.taxable_value:
                diff_amt = round(inv.taxable_value * (expected_gst - inv.gst_percent) / 100.0, 2)
                itc_risk += abs(diff_amt)
            issues.append(ValidationIssue(
                code="HSN_GST_MISMATCH",
                severity="error",
                message_en=f"HSN {inv.hsn_code} should have {expected_gst}% GST, bill shows {inv.gst_percent}%.",
                message_hi=f"HSN {inv.hsn_code} पर {expected_gst}% लगना था, बिल में {inv.gst_percent}% है.",
                message_mr=f"HSN {inv.hsn_code} वर {expected_gst}% लागणार होता, बिलात {inv.gst_percent}% आहे.",
                fix_en="Ask vendor for revised bill with correct GST rate.",
                fix_hi="वेंडर को बोलकर सही GST रेट का रिवाइज़्ड बिल मांगें.",
                fix_mr="विक्रेत्याला सांगून बरोबर GST दराने रिव्हाइज्ड बिल मागवा.",
            ))

    # 3) Math check: taxable_value * gst% = total GST
    if inv.taxable_value and inv.gst_percent is not None:
        expected_tax = round(inv.taxable_value * inv.gst_percent / 100.0, 2)
        actual_tax = round((inv.cgst_amount or 0.0) + (inv.sgst_amount or 0.0) + (inv.igst_amount or 0.0), 2)
        if actual_tax > 0 and abs(expected_tax - actual_tax) > 1.0:
            itc_risk += abs(expected_tax - actual_tax)
            issues.append(ValidationIssue(
                code="TAX_MATH_ERROR",
                severity="error",
                message_en=f"GST math wrong. Expected ₹{expected_tax}, bill has ₹{actual_tax}.",
                message_hi=f"GST कैलकुलेशन गलत. सही ₹{expected_tax} है, बिल में ₹{actual_tax}.",
                message_mr=f"GST गणित चुकले. बरोबर ₹{expected_tax}, बिलात ₹{actual_tax}.",
                fix_en="Ask vendor to correct the tax amount on invoice.",
                fix_hi="वेंडर से बिल का टैक्स अमाउंट ठीक करवाएँ.",
                fix_mr="विक्रेत्याकडून बिलातील करा रक्कम दुरुस्त करून घ्या.",
            ))

    # 4) RCM check
    if inv.hsn_code and inv.hsn_code.strip()[:4] in RCM_HSN_CODES:
        issues.append(ValidationIssue(
            code="RCM_APPLICABLE",
            severity="warning",
            message_en=f"HSN {inv.hsn_code} may attract Reverse Charge (RCM).",
            message_hi=f"HSN {inv.hsn_code} पर RCM (रिवर्स चार्ज) लग सकता है.",
            message_mr=f"HSN {inv.hsn_code} वर RCM (रिव्हर्स चार्ज) लागू होऊ शकतो.",
            fix_en="Verify RCM applicability and self-assess GST if needed.",
            fix_hi="RCM लागू है या नहीं जाँचें, ज़रूरत पड़े तो खुद GST भरें.",
            fix_mr="RCM लागू आहे का तपासा, गरज पडल्यास स्वतः GST भरा.",
        ))

    return issues, round(itc_risk, 2)


# ---------------- OCR via GPT-4o Vision ----------------
OCR_SYSTEM_PROMPT = (
    "You are an expert Indian GST B2B invoice parser. Extract structured data. "
    "Return ONLY a valid JSON object (no markdown, no code fences) with these keys: "
    "vendor_name, vendor_gstin, invoice_number, invoice_date, hsn_code, "
    "taxable_value, gst_percent, cgst_amount, sgst_amount, igst_amount, total_amount. "
    "Use null if missing. Numbers must be plain numbers (no ₹ or commas). "
    "invoice_date in YYYY-MM-DD. hsn_code is a string. gst_percent is numeric percentage."
)


async def extract_invoice_fields(image_base64: str) -> ExtractedInvoice:
    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"ocr-{uuid.uuid4()}",
        system_message=OCR_SYSTEM_PROMPT,
    ).with_model("openai", "gpt-4o")

    msg = UserMessage(
        text="Extract the GST invoice fields as JSON.",
        file_contents=[ImageContent(image_base64=image_base64)],
    )
    raw = await chat.send_message(msg)
    raw = raw.strip()
    # strip code fences if present
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?", "", raw).rsplit("```", 1)[0].strip()
    try:
        data = json.loads(raw)
    except Exception:
        m = re.search(r"\{[\s\S]*\}", raw)
        if not m:
            raise HTTPException(status_code=422, detail="Could not parse OCR output")
        data = json.loads(m.group(0))

    def to_float(v):
        if v is None or v == "":
            return None
        try:
            return float(str(v).replace(",", "").replace("₹", "").strip())
        except Exception:
            return None

    return ExtractedInvoice(
        vendor_name=data.get("vendor_name"),
        vendor_gstin=(data.get("vendor_gstin") or "").strip().upper() or None,
        invoice_number=data.get("invoice_number"),
        invoice_date=data.get("invoice_date"),
        hsn_code=str(data.get("hsn_code")) if data.get("hsn_code") is not None else None,
        taxable_value=to_float(data.get("taxable_value")),
        gst_percent=to_float(data.get("gst_percent")),
        cgst_amount=to_float(data.get("cgst_amount")),
        sgst_amount=to_float(data.get("sgst_amount")),
        igst_amount=to_float(data.get("igst_amount")),
        total_amount=to_float(data.get("total_amount")),
    )


# ---------------- Routes ----------------
@api.get("/")
async def root():
    return {"service": "BillShiHai", "ok": True}


# ---------------- Demo Invoice Generator (Gemini Nano Banana) ----------------
DEMO_INVOICE_PROMPTS = [
    (
        "Photorealistic top-down photo of a printed Indian B2B GST tax invoice on white A4 paper. "
        "Header in bold: 'SHREE GANESH TRADERS PVT LTD'. GSTIN: 27AABCS1234E1Z5. "
        "Invoice No: SGT/2025/0421. Date: 15-Mar-2025. "
        "Single line item: 'Smartphone Accessory Box', HSN: 8517, Taxable Value: 25000.00. "
        "GST @ 18%. CGST 2250.00. SGST 2250.00. Total: Rs. 29500.00. "
        "Black ink, neat tabular layout, subtle paper shadow, slightly off-center."
    ),
    (
        "Photorealistic photo of a printed Indian GST B2B tax invoice. "
        "Vendor: 'MUMBAI OFFICE SUPPLIES'. GSTIN: 27AABCM5678F1Z3. "
        "Invoice No: MOS-1042. Date: 10-Feb-2025. "
        "Line item: 'Laser Printer A4', HSN: 8471, Taxable Value: 18000.00. "
        "GST shown as 12% (CGST 1080.00, SGST 1080.00). Total: Rs. 20160.00. "
        "Crisp paper texture, photographed on a wooden desk, slight skew."
    ),
    (
        "Photorealistic image of an Indian GST tax invoice on white paper. "
        "Vendor: 'PUNE TECH SOLUTIONS'. GSTIN: 27ABCDE9876G1ZT. "
        "Invoice: PTS/INV/0512. Date: 22-Apr-2025. "
        "Description: 'IT Consulting Service'. HSN: 9983. Taxable: 50000.00. GST 18%. "
        "CGST 4500.00. SGST 4500.00. Total: Rs. 59000.00. "
        "Round vendor stamp at bottom-right, slight paper crease."
    ),
]


class DemoInvoiceResponse(BaseModel):
    image_base64: str
    mime_type: str = "image/png"


@api.post("/demo-invoice", response_model=DemoInvoiceResponse)
async def generate_demo_invoice():
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    import random
    prompt = random.choice(DEMO_INVOICE_PROMPTS)
    try:
        chat = (
            LlmChat(
                api_key=EMERGENT_LLM_KEY,
                session_id=f"demo-inv-{uuid.uuid4()}",
                system_message="You generate photorealistic images of Indian GST tax invoices for app demos.",
            )
            .with_model("gemini", "gemini-3.1-flash-image-preview")
            .with_params(modalities=["image", "text"])
        )

        msg = UserMessage(text=prompt)
        _text, images = await chat.send_message_multimodal_response(msg)
        if not images:
            raise HTTPException(status_code=502, detail="No image returned from generator")
        first = images[0]
        return DemoInvoiceResponse(
            image_base64=first["data"],
            mime_type=first.get("mime_type", "image/png"),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Demo invoice generation failed")
        raise HTTPException(status_code=500, detail=f"Demo generation failed: {e}")


@api.get("/hsn")
async def hsn_list():
    return {"hsn_gst_map": HSN_GST_MAP, "rcm_hsn": sorted(list(RCM_HSN_CODES))}


@api.post("/scan", response_model=ScanResult)
async def scan_invoice(req: ScanRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    if not req.image_base64 or len(req.image_base64) < 100:
        raise HTTPException(status_code=400, detail="Invalid image payload")

    try:
        extracted = await extract_invoice_fields(req.image_base64)
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("OCR failed")
        raise HTTPException(status_code=500, detail=f"OCR failed: {e}")

    issues, itc_risk = validate_invoice(extracted)
    status = "error" if any(i.severity == "error" for i in issues) else "ok"

    result = ScanResult(extracted=extracted, issues=issues, itc_at_risk=itc_risk, status=status)

    # Persist (without _id leakage — we use our own 'id')
    doc = result.model_dump()
    await db.scans.insert_one(doc.copy())  # copy so mongo mutation doesn't affect our response
    return result


@api.get("/scans", response_model=List[ScanResult])
async def list_scans(limit: int = 100):
    cursor = db.scans.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    docs = await cursor.to_list(length=limit)
    return [ScanResult(**d) for d in docs]


@api.get("/monthly-report")
async def monthly_report():
    if db is None:
        raise HTTPException(status_code=503, detail="Database not available")
    now = datetime.now(timezone.utc)
    month_key = now.strftime("%Y-%m")

    cursor = db.scans.find(
        {"created_at": {"$regex": f"^{month_key}"}},
        {"_id": 0},
    ).limit(1000)
    docs = await cursor.to_list(length=1000)

    total_risk = 0.0
    total_scans = len(docs)
    error_scans = 0
    for d in docs:
        total_risk += float(d.get("itc_at_risk", 0) or 0)
        if d.get("status") == "error":
            error_scans += 1

    return {
        "month": month_key,
        "total_scans": total_scans,
        "error_scans": error_scans,
        "itc_at_risk": round(total_risk, 2),
    }


@api.delete("/scans")
async def clear_scans():
    await db.scans.delete_many({})
    return {"ok": True}


# ---------------- AI Help Chat ----------------
CHAT_SYSTEM_PROMPTS = {
    "en": "You are BillBuster Assistant, an expert in Indian GST for small B2B businesses. Answer briefly and practically. Prefer simple English. When user asks about ITC, HSN, GSTIN, RCM, or invoices, give clear step-by-step help.",
    "hi": "आप BillBuster सहायक हैं, भारतीय GST के एक्सपर्ट हैं छोटे B2B व्यापार के लिए. सरल हिंदी में संक्षेप में जवाब दें. ITC, HSN, GSTIN, RCM या बिल से जुड़े सवालों पर स्टेप-बाय-स्टेप मदद करें.",
    "mr": "तुम्ही BillBuster सहाय्यक आहात, लहान B2B व्यवसायांसाठी भारतीय GST चे तज्ज्ञ. सोप्या मराठीत संक्षिप्त उत्तर द्या. ITC, HSN, GSTIN, RCM किंवा बिलाबद्दल स्पष्ट स्टेप-बाय-स्टेप मदत करा.",
}


@api.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    if not EMERGENT_LLM_KEY:
        raise HTTPException(status_code=500, detail="LLM key not configured")
    system = CHAT_SYSTEM_PROMPTS.get(req.language, CHAT_SYSTEM_PROMPTS["en"])
    try:
        llm = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=req.session_id,
            system_message=system,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        # Load previous messages for context
        history = await db.chat_messages.find(
            {"session_id": req.session_id}, {"_id": 0}
        ).sort("ts", 1).to_list(length=50)

        # Save user message
        await db.chat_messages.insert_one({
            "session_id": req.session_id,
            "role": "user",
            "content": req.message,
            "ts": datetime.now(timezone.utc).isoformat(),
        })

        reply = await llm.send_message(UserMessage(text=req.message))

        await db.chat_messages.insert_one({
            "session_id": req.session_id,
            "role": "assistant",
            "content": reply,
            "ts": datetime.now(timezone.utc).isoformat(),
        })
        return ChatResponse(reply=reply)
    except Exception as e:
        logger.exception("Chat failed")
        raise HTTPException(status_code=500, detail=f"Chat failed: {e}")


@api.get("/chat/{session_id}")
async def chat_history(session_id: str):
    msgs = await db.chat_messages.find(
        {"session_id": session_id}, {"_id": 0}
    ).sort("ts", 1).to_list(length=500)
    return {"messages": msgs}


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root_health():
    return {"service": "BillBuster", "ok": True}
