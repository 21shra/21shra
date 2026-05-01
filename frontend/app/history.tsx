import React, { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp, type ScanResult } from "../src/store";
import { t } from "../src/i18n";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function History() {
  const router = useRouter();
  const { lang, setLastResult } = useApp();
  const [items, setItems] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/scans`);
      if (r.ok) setItems(await r.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onItem = (it: ScanResult) => {
    setLastResult(it);
    router.push("/result");
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn" style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{t(lang, "history")}</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator color="#059669" />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.empty} testID="empty-history">
          <View style={styles.emptyIcon}>
            <Ionicons name="document-outline" size={56} color="#9ca3af" />
          </View>
          <Text style={styles.emptyText}>{t(lang, "noHistory")}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push("/scan")} testID="scan-cta">
            <Ionicons name="camera" size={22} color="#fff" />
            <Text style={styles.primaryText}>{t(lang, "scanBill")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(i) => i.id}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          renderItem={({ item, index }) => {
            const ok = item.status === "ok";
            return (
              <TouchableOpacity
                onPress={() => onItem(item)}
                style={styles.item}
                testID={`history-item-${index}`}
                activeOpacity={0.85}
              >
                <View style={[styles.itemIcon, ok ? styles.okBg : styles.errBg]}>
                  <Ionicons name={ok ? "checkmark" : "close"} size={22} color={ok ? "#059669" : "#dc2626"} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle} numberOfLines={1}>
                    {item.extracted?.vendor_name || item.extracted?.vendor_gstin || "Unknown vendor"}
                  </Text>
                  <Text style={styles.itemSub}>
                    {item.extracted?.invoice_date || new Date(item.created_at).toLocaleDateString()}
                    {item.extracted?.total_amount ? ` • ₹${item.extracted.total_amount}` : ""}
                  </Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  {ok ? (
                    <Text style={styles.okChip}>OK</Text>
                  ) : (
                    <Text style={styles.errChip}>₹{item.itc_at_risk}</Text>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  title: { fontSize: 18, fontWeight: "800", color: "#111827" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 16 },
  emptyIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: "#f3f4f6", alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 15, color: "#6b7280", textAlign: "center" },
  primaryBtn: { backgroundColor: "#059669", paddingHorizontal: 24, minHeight: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 8 },
  primaryText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  item: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", padding: 14, borderRadius: 16, borderWidth: 1, borderColor: "#e5e7eb" },
  itemIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  okBg: { backgroundColor: "#d1fae5" },
  errBg: { backgroundColor: "#fee2e2" },
  itemTitle: { fontSize: 15, fontWeight: "700", color: "#111827" },
  itemSub: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  okChip: { fontSize: 12, fontWeight: "800", color: "#065f46", backgroundColor: "#d1fae5", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  errChip: { fontSize: 12, fontWeight: "800", color: "#991b1b", backgroundColor: "#fee2e2", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
});
