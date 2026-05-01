import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../src/store";
import { t, type Lang } from "../src/i18n";

function msgFor(issue: any, lang: Lang) {
  return issue[`message_${lang}`] || issue.message_en;
}
function fixFor(issue: any, lang: Lang) {
  return issue[`fix_${lang}`] || issue.fix_en;
}

function Row({ label, value }: { label: string; value: any }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value ?? "—"}</Text>
    </View>
  );
}

export default function Result() {
  const router = useRouter();
  const { lang, lastResult } = useApp();

  if (!lastResult) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>No result</Text>
        <TouchableOpacity onPress={() => router.replace("/")}>
          <Text style={{ color: "#059669", marginTop: 12 }}>Go Home</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const { extracted: e, issues, itc_at_risk, status } = lastResult;
  const isOk = status === "ok";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace("/")} testID="back-home-btn" style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Result</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero status */}
        <View style={[styles.hero, isOk ? styles.heroOk : styles.heroErr]} testID="result-hero">
          <View style={[styles.heroIcon, isOk ? styles.heroIconOk : styles.heroIconErr]}>
            <Ionicons
              name={isOk ? "checkmark-circle" : "alert-circle"}
              size={64}
              color={isOk ? "#059669" : "#dc2626"}
            />
          </View>
          {isOk ? (
            <>
              <Text style={styles.okTitle} testID="result-status">
                ✅ {t(lang, "billOk")}
              </Text>
              <Text style={styles.okSub}>{t(lang, "allGood")}</Text>
            </>
          ) : (
            <>
              <Text style={styles.errLabel}>{t(lang, "itcLoss")}</Text>
              <Text style={styles.errAmount} testID="itc-risk-amount">
                ₹{itc_at_risk.toLocaleString("en-IN")}
              </Text>
            </>
          )}
        </View>

        {/* Issues */}
        {issues?.length > 0 && (
          <View style={{ gap: 10 }}>
            {issues.map((iss, idx) => (
              <View
                key={idx}
                style={[styles.issueCard, iss.severity === "error" ? styles.issueErr : styles.issueWarn]}
                testID={`issue-${idx}`}
              >
                <View style={styles.issueHead}>
                  <Ionicons
                    name={iss.severity === "error" ? "close-circle" : "warning"}
                    size={20}
                    color={iss.severity === "error" ? "#dc2626" : "#d97706"}
                  />
                  <Text style={styles.issueCode}>{iss.code}</Text>
                </View>
                <Text style={styles.issueTitle}>{t(lang, "reason")}</Text>
                <Text style={styles.issueBody}>{msgFor(iss, lang)}</Text>
                <Text style={[styles.issueTitle, { marginTop: 8 }]}>{t(lang, "fix")}</Text>
                <Text style={styles.issueBody}>{fixFor(iss, lang)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Extracted fields */}
        <View style={styles.card} testID="extracted-card">
          <Text style={styles.cardTitle}>Extracted</Text>
          <Row label={t(lang, "vendor")} value={e.vendor_name} />
          <Row label={t(lang, "gstin")} value={e.vendor_gstin} />
          <Row label={t(lang, "invNo")} value={e.invoice_number} />
          <Row label={t(lang, "date")} value={e.invoice_date} />
          <Row label={t(lang, "hsn")} value={e.hsn_code} />
          <Row label={t(lang, "taxable")} value={e.taxable_value ? `₹${e.taxable_value}` : null} />
          <Row label={t(lang, "gstRate")} value={e.gst_percent != null ? `${e.gst_percent}%` : null} />
          <Row label={t(lang, "cgst")} value={e.cgst_amount ? `₹${e.cgst_amount}` : null} />
          <Row label={t(lang, "sgst")} value={e.sgst_amount ? `₹${e.sgst_amount}` : null} />
          <Row label={t(lang, "igst")} value={e.igst_amount ? `₹${e.igst_amount}` : null} />
          <Row label={t(lang, "total")} value={e.total_amount ? `₹${e.total_amount}` : null} />
        </View>

        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace("/scan")}
          testID="scan-again-btn"
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={22} color="#fff" />
          <Text style={styles.primaryText}>{t(lang, "scanAnother")}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  title: { fontSize: 18, fontWeight: "800", color: "#111827" },
  content: { padding: 16, gap: 14, paddingBottom: 32 },

  hero: { padding: 28, borderRadius: 24, alignItems: "center", borderWidth: 2 },
  heroOk: { backgroundColor: "#ecfdf5", borderColor: "#a7f3d0" },
  heroErr: { backgroundColor: "#fef2f2", borderColor: "#fecaca" },
  heroIcon: { width: 96, height: 96, borderRadius: 48, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  heroIconOk: { backgroundColor: "#d1fae5" },
  heroIconErr: { backgroundColor: "#fee2e2" },
  okTitle: { fontSize: 28, fontWeight: "800", color: "#065f46" },
  okSub: { fontSize: 14, color: "#047857", marginTop: 4 },
  errLabel: { fontSize: 14, fontWeight: "700", color: "#991b1b", textTransform: "uppercase", letterSpacing: 0.5 },
  errAmount: { fontSize: 44, fontWeight: "800", color: "#b91c1c", letterSpacing: -1, marginTop: 4 },

  issueCard: { padding: 16, borderRadius: 16, borderWidth: 1.5 },
  issueErr: { backgroundColor: "#fff1f2", borderColor: "#fecaca" },
  issueWarn: { backgroundColor: "#fffbeb", borderColor: "#fde68a" },
  issueHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  issueCode: { fontSize: 11, fontWeight: "800", color: "#6b7280", letterSpacing: 0.5 },
  issueTitle: { fontSize: 12, fontWeight: "700", color: "#374151", textTransform: "uppercase", letterSpacing: 0.5 },
  issueBody: { fontSize: 15, color: "#111827", marginTop: 2, lineHeight: 21 },

  card: { backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  cardTitle: { fontSize: 13, fontWeight: "700", color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  rowLabel: { fontSize: 14, color: "#6b7280", fontWeight: "500" },
  rowValue: { fontSize: 14, color: "#111827", fontWeight: "700", maxWidth: "60%", textAlign: "right" },

  primaryBtn: { backgroundColor: "#059669", minHeight: 56, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10, marginTop: 8 },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});
