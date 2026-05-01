# BillBuster - Product Requirements Document

## Product
**BillBuster** — Mobile app for Indian small business owners to scan B2B purchase invoices and detect GST errors in 3 seconds. Tells users how much Input Tax Credit (ITC) is at risk, why, and how to fix.

## Tech Stack
- **Frontend**: React Native (Expo SDK 54) + expo-router + zustand + expo-image-picker
- **Backend**: FastAPI + motor (MongoDB)
- **AI**: GPT-4o Vision (OCR/extraction) + Claude Sonnet 4.5 (AI Help chat) via `emergentintegrations` (Emergent LLM key)
- **Languages**: English / Hindi / Marathi (Devanagari)

## Features Implemented (MVP)
1. **Home** — 3 big buttons (Scan Bill / History / AI Help), language toggle (EN/HI/MR), "This month ITC at risk" summary card
2. **Scan Bill** — Camera capture or gallery pick of invoice photo; sends base64 to backend
3. **OCR + Validation Engine** —
   - GPT-4o extracts: vendor name, GSTIN, invoice #, date, HSN, taxable value, GST%, CGST/SGST/IGST, total
   - `GSTIN_INVALID` — regex format check
   - `HSN_GST_MISMATCH` — HSN→GST% master (8517=18, 9961=18, 9983=18, 8528=28, 1006=5, 3004=12, 4901=0, …)
   - `TAX_MATH_ERROR` — taxable × rate vs (CGST+SGST+IGST) tolerance ₹1
   - `RCM_APPLICABLE` — warning for common RCM HSNs (9965, 9966, 9983, 9971)
4. **Result Screen** — Big green "✅ Bill OK" or red "₹X,XXX ITC at risk" with Reason + Fix shown in selected language
5. **History** — List of past scans (vendor, date, total, status chip); tap to re-open result
6. **Monthly Report** — GET /api/monthly-report (scan count, error count, total ITC risk)
7. **AI Help** — Chat with Claude Sonnet 4.5, session persisted in Mongo, replies in selected language

## Backend Endpoints
- `GET /api/` health
- `GET /api/hsn` HSN→GST map + RCM list
- `POST /api/scan` {image_base64} → ScanResult
- `GET /api/scans` list (newest first, `_id` excluded)
- `DELETE /api/scans` clear history
- `GET /api/monthly-report` current-month summary
- `POST /api/chat` {session_id, message, language}
- `GET /api/chat/{session_id}` message history

## Mocked / Deferred
- **Govt GST taxpayer active-status API** — only format validation (regex) implemented. Live check deferred until user provides GSTIN API key.
- **Monetization (Free 5/mo, Pro ₹99/mo)** — not implemented in MVP.
- **Offline HSN master** — HSN→GST map is server-side (cache on client deferred).

## Key Design Decisions
- MongoDB docs persisted with `.copy()` to prevent `_id` mutation leaking into response
- Datetime stored as ISO string in UTC
- Each LlmChat session = new instance per playbook rule
