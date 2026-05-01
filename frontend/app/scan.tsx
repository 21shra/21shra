import React, { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image, Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useApp } from "../src/store";
import { t } from "../src/i18n";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

// A tiny realistic GST invoice image (base64) embedded for demo fallback/testing
// We'll just call backend scan endpoint with real selected image.

export default function Scan() {
  const router = useRouter();
  const { lang, setLastResult } = useApp();
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  const submit = async (base64: string, uri: string) => {
    setPreview(uri);
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND}/api/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64: base64 }),
      });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(err || "Scan failed");
      }
      const data = await res.json();
      setLastResult(data);
      router.replace("/result");
    } catch (e: any) {
      Alert.alert("Scan failed", e.message || "Please try again");
    } finally {
      setLoading(false);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Camera permission is required to scan invoices.");
      return;
    }
    const r = await ImagePicker.launchCameraAsync({
      base64: true,
      quality: 0.6,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!r.canceled && r.assets[0]?.base64) await submit(r.assets[0].base64, r.assets[0].uri);
  };

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Gallery access is required.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.6,
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (!r.canceled && r.assets[0]?.base64) await submit(r.assets[0].base64, r.assets[0].uri);
  };

  const useDemo = async () => {
    // small test invoice image (jpeg) – public URL converted to base64 via fetch
    setLoading(true);
    try {
      const u = "https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=900&q=80";
      const r = await fetch(u);
      const blob = await r.blob();
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const s = (reader.result as string) || "";
          resolve(s.split(",")[1] || "");
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      await submit(b64, u);
    } catch (e: any) {
      Alert.alert("Demo failed", e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn" style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{t(lang, "scanBill")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.viewfinder}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.previewImg} resizeMode="cover" />
        ) : (
          <View style={styles.targetBox}>
            <Ionicons name="document-text-outline" size={72} color="#9ca3af" />
            <Text style={styles.vfText}>Frame invoice inside the box</Text>
          </View>
        )}
        {loading && (
          <View style={styles.overlay} testID="scanning-overlay">
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.overlayText}>{t(lang, "scanning")}</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={takePhoto}
          disabled={loading}
          testID="take-photo-btn"
          activeOpacity={0.85}
        >
          <Ionicons name="camera" size={24} color="#fff" />
          <Text style={styles.primaryText}>{t(lang, "takePhoto")}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={pickImage}
          disabled={loading}
          testID="pick-gallery-btn"
          activeOpacity={0.85}
        >
          <Ionicons name="images-outline" size={22} color="#111827" />
          <Text style={styles.secondaryText}>{t(lang, "pickGallery")}</Text>
        </TouchableOpacity>
        {Platform.OS === "web" && (
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={useDemo}
            disabled={loading}
            testID="demo-btn"
          >
            <Text style={styles.linkText}>{t(lang, "demoSample")}</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#0b1220" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  title: { fontSize: 18, fontWeight: "800", color: "#111827" },

  viewfinder: { flex: 1, backgroundColor: "#0b1220", alignItems: "center", justifyContent: "center", position: "relative" },
  targetBox: {
    width: "80%", aspectRatio: 0.72, borderWidth: 3, borderColor: "#10b981",
    borderStyle: "dashed", borderRadius: 16, alignItems: "center", justifyContent: "center", gap: 12,
  },
  vfText: { color: "#d1d5db", fontSize: 14 },
  previewImg: { width: "90%", height: "85%", borderRadius: 12 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", gap: 14 },
  overlayText: { color: "#fff", fontSize: 16, fontWeight: "700" },

  actions: { padding: 16, backgroundColor: "#fff", gap: 10 },
  primaryBtn: {
    backgroundColor: "#059669", minHeight: 56, borderRadius: 14, alignItems: "center",
    justifyContent: "center", flexDirection: "row", gap: 10,
  },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  secondaryBtn: {
    backgroundColor: "#fff", minHeight: 56, borderRadius: 14, alignItems: "center",
    justifyContent: "center", flexDirection: "row", gap: 10, borderWidth: 1.5, borderColor: "#e5e7eb",
  },
  secondaryText: { color: "#111827", fontSize: 16, fontWeight: "700" },
  linkBtn: { alignItems: "center", paddingVertical: 8 },
  linkText: { color: "#059669", fontSize: 14, fontWeight: "700" },
});
