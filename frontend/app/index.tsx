import React from "react";
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../src/store";
import { t, type Lang } from "../src/i18n";
import { useEffect, useState } from "react";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function Home() {
  const router = useRouter();
  const { lang, setLang } = useApp();
  const [report, setReport] = useState<{ total_scans: number; error_scans: number; itc_at_risk: number } | null>(null);

  const fetchReport = async () => {
    try {
      const r = await fetch(`${BACKEND}/api/monthly-report`);
      if (r.ok) setReport(await r.json());
    } catch {}
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const langs: Lang[] = ["en", "hi", "mr"];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand} testID="app-name">BillBuster</Text>
            <Text style={styles.tagline}>{t(lang, "tagline")}</Text>
          </View>
          <View style={styles.langPill} testID="lang-toggle">
            {langs.map((l) => (
              <TouchableOpacity
                key={l}
                onPress={() => setLang(l)}
                style={[styles.langBtn, lang === l && styles.langBtnActive]}
                testID={`lang-${l}`}
              >
                <Text style={[styles.langText, lang === l && styles.langTextActive]}>
                  {l.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Monthly Risk Card */}
        <View style={styles.riskCard} testID="monthly-risk-card">
          <Text style={styles.riskLabel}>{t(lang, "monthlyRisk")}</Text>
          <Text style={styles.riskAmount} testID="monthly-risk-amount">
            ₹{(report?.itc_at_risk ?? 0).toLocaleString("en-IN")}
          </Text>
          <View style={styles.riskRow}>
            <View style={styles.riskChip}>
              <Text style={styles.riskChipText}>
                {report?.total_scans ?? 0} {t(lang, "scans")}
              </Text>
            </View>
            <View style={[styles.riskChip, styles.riskChipErr]}>
              <Text style={[styles.riskChipText, { color: "#b91c1c" }]}>
                {report?.error_scans ?? 0} {t(lang, "errors")}
              </Text>
            </View>
          </View>
        </View>

        {/* Primary CTA */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push("/scan")}
          testID="scan-bill-btn"
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={28} color="#fff" />
          <Text style={styles.primaryText}>{t(lang, "scanBill")}</Text>
        </TouchableOpacity>

        {/* Secondary buttons */}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push("/history")}
          testID="history-btn"
          activeOpacity={0.85}
        >
          <Ionicons name="time-outline" size={24} color="#111827" />
          <Text style={styles.secondaryText}>{t(lang, "history")}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push("/help")}
          testID="help-btn"
          activeOpacity={0.85}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={24} color="#111827" />
          <Text style={styles.secondaryText}>{t(lang, "help")}</Text>
        </TouchableOpacity>

        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  container: { padding: 20, paddingBottom: 32 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  brand: { fontSize: 28, fontWeight: "800", color: "#065f46", letterSpacing: -0.5 },
  tagline: { fontSize: 13, color: "#6b7280", marginTop: 4, maxWidth: 220 },
  langPill: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 999, padding: 4, borderWidth: 1, borderColor: "#e5e7eb" },
  langBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  langBtnActive: { backgroundColor: "#059669" },
  langText: { fontSize: 12, fontWeight: "700", color: "#6b7280" },
  langTextActive: { color: "#fff" },

  riskCard: {
    backgroundColor: "#fff", padding: 20, borderRadius: 20, borderWidth: 1, borderColor: "#e5e7eb",
    marginBottom: 24, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  riskLabel: { fontSize: 13, color: "#6b7280", fontWeight: "600" },
  riskAmount: { fontSize: 36, fontWeight: "800", color: "#dc2626", marginTop: 4, letterSpacing: -1 },
  riskRow: { flexDirection: "row", marginTop: 12, gap: 8 },
  riskChip: { backgroundColor: "#f3f4f6", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  riskChipErr: { backgroundColor: "#fee2e2" },
  riskChipText: { fontSize: 12, fontWeight: "600", color: "#374151" },

  primaryBtn: {
    backgroundColor: "#059669", minHeight: 72, borderRadius: 16, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 12, marginBottom: 12,
    shadowColor: "#059669", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  primaryText: { color: "#fff", fontSize: 20, fontWeight: "800" },

  secondaryBtn: {
    backgroundColor: "#fff", minHeight: 64, borderRadius: 16, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: 12, marginBottom: 12, borderWidth: 1.5, borderColor: "#e5e7eb",
  },
  secondaryText: { color: "#111827", fontSize: 17, fontWeight: "700" },
});
