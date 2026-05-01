import { create } from "zustand";
import type { Lang } from "./i18n";

export type Issue = {
  code: string;
  severity: "error" | "warning";
  message_en: string;
  message_hi: string;
  message_mr: string;
  fix_en: string;
  fix_hi: string;
  fix_mr: string;
};

export type Extracted = {
  vendor_name?: string | null;
  vendor_gstin?: string | null;
  invoice_number?: string | null;
  invoice_date?: string | null;
  hsn_code?: string | null;
  taxable_value?: number | null;
  gst_percent?: number | null;
  cgst_amount?: number | null;
  sgst_amount?: number | null;
  igst_amount?: number | null;
  total_amount?: number | null;
};

export type ScanResult = {
  id: string;
  created_at: string;
  extracted: Extracted;
  issues: Issue[];
  itc_at_risk: number;
  status: "ok" | "error";
};

type AppState = {
  lang: Lang;
  setLang: (l: Lang) => void;
  lastResult: ScanResult | null;
  setLastResult: (r: ScanResult | null) => void;
};

export const useApp = create<AppState>((set) => ({
  lang: "en",
  setLang: (l) => set({ lang: l }),
  lastResult: null,
  setLastResult: (r) => set({ lastResult: r }),
}));
