import React, { useEffect, useRef, useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useApp } from "../src/store";
import { t } from "../src/i18n";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL;

type Msg = { role: "user" | "assistant"; content: string };

function randomId() {
  return "s_" + Math.random().toString(36).slice(2, 10);
}

export default function Help() {
  const router = useRouter();
  const { lang } = useApp();
  const [sessionId] = useState(randomId);
  const [messages, setMessages] = useState<Msg[]>([
    {
      role: "assistant",
      content:
        lang === "hi"
          ? "नमस्ते! मैं BillShiHai सहायक हूँ. GST, HSN, ITC के बारे में कुछ भी पूछें."
          : lang === "mr"
          ? "नमस्कार! मी BillShiHai सहाय्यक आहे. GST, HSN, ITC बद्दल काहीही विचारा."
          : "Hi! I am BillShiHai Assistant. Ask me anything about GST, HSN, ITC.",
    },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: text }]);
    setSending(true);
    try {
      const r = await fetch(`${BACKEND}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId, message: text, language: lang }),
      });
      const data = await r.json();
      setMessages((m) => [...m, { role: "assistant", content: data.reply || data.detail || "…" }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", content: "Error: " + e.message }]);
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} testID="back-btn" style={styles.iconBtn}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{t(lang, "help")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, gap: 8 }}
          testID="chat-scroll"
        >
          {messages.map((m, i) => (
            <View
              key={i}
              style={[styles.bubble, m.role === "user" ? styles.bubbleUser : styles.bubbleBot]}
              testID={`msg-${i}`}
            >
              <Text style={m.role === "user" ? styles.textUser : styles.textBot}>{m.content}</Text>
            </View>
          ))}
          {sending && (
            <View style={[styles.bubble, styles.bubbleBot]}>
              <ActivityIndicator color="#059669" />
            </View>
          )}
        </ScrollView>

        <View style={styles.inputBar}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t(lang, "chatPlaceholder")}
            placeholderTextColor="#9ca3af"
            style={styles.input}
            multiline
            testID="chat-input"
            onSubmitEditing={send}
          />
          <TouchableOpacity
            onPress={send}
            disabled={sending || !input.trim()}
            style={[styles.sendBtn, (sending || !input.trim()) && { opacity: 0.5 }]}
            testID="chat-send-btn"
          >
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f9fafb" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: 999 },
  title: { fontSize: 18, fontWeight: "800", color: "#111827" },
  bubble: { maxWidth: "82%", padding: 12, borderRadius: 16 },
  bubbleUser: { backgroundColor: "#059669", alignSelf: "flex-end", borderBottomRightRadius: 4 },
  bubbleBot: { backgroundColor: "#fff", alignSelf: "flex-start", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#e5e7eb" },
  textUser: { color: "#fff", fontSize: 15, lineHeight: 21 },
  textBot: { color: "#111827", fontSize: 15, lineHeight: 21 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, padding: 10, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  input: { flex: 1, minHeight: 44, maxHeight: 110, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#f3f4f6", borderRadius: 22, fontSize: 15, color: "#111827" },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#059669", alignItems: "center", justifyContent: "center" },
});
