import { router } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { ComingSoon } from "@/components/household";
import { plainText, RichText } from "@/components/RichText";
import { Chip, Icon, OfflineBanner, type as t } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { askAssistant, notYetLive, SOURCE_LABELS, SUGGESTIONS, type AssistantReply, type Turn } from "@/lib/extras";
import { LANGUAGES } from "@/lib/household";
import { useHousehold } from "@/lib/household-context";
import { readPref, writePref } from "@/lib/prefs";
import { canListen, listen, speak, stopSpeaking } from "@/lib/voice";
import { colors } from "@/theme";

type Message = Turn & { reply?: AssistantReply; error?: boolean };

export default function Ask() {
  const { user, lang, setLang } = useHousehold();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState("");
  const [speakAloud, setSpeakAloud] = useState(false);
  const [micReady] = useState(canListen);
  const stopListening = useRef<(() => void) | null>(null);
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  useEffect(() => {
    readPref("speak").then((v) => setSpeakAloud(v === "1"));
    return () => {
      stopListening.current?.();
      stopSpeaking();
    };
  }, []);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || busy) return;
    const history: Turn[] = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: "user", content: question }]);
    setDraft("");
    setBusy(true);
    try {
      const reply = await askAssistant(question, lang, history);
      setMessages((m) => [...m, { role: "assistant", content: reply.answer, reply }]);
      if (speakAloud) void speak(plainText(reply.answer), reply.lang);
    } catch (e) {
      if (notYetLive(e)) {
        // The server doesn't have the assistant yet (it arrives with API v6).
        setUnavailable(true);
        setMessages((m) => m.slice(0, -1));
      } else {
        const message = e instanceof ApiError ? e.message : "Something went wrong. Try again.";
        setMessages((m) => [...m, { role: "assistant", content: message, error: true }]);
      }
    } finally {
      setBusy(false);
    }
  };

  const toggleListening = async () => {
    if (listening) {
      stopListening.current?.();
      return;
    }
    setVoiceNote("");
    setListening(true);
    stopSpeaking();
    stopListening.current = await listen(lang, {
      onResult: (heard) => void send(heard),
      onError: setVoiceNote,
      onEnd: () => {
        setListening(false);
        stopListening.current = null;
      },
    });
  };

  const toggleSpeak = () => {
    const next = !speakAloud;
    setSpeakAloud(next);
    if (!next) stopSpeaking();
    writePref("speak", next ? "1" : "0");
  };

  const suggestions = SUGGESTIONS[lang] ?? SUGGESTIONS.en;
  const firstName = user.name.split(" ")[0];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.page }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <OfflineBanner />
      <View style={styles.toolbar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingHorizontal: 16 }}>
          {LANGUAGES.map((l) => (
            <Chip key={l.code} label={l.label} selected={lang === l.code} onPress={() => setLang(l.code)} />
          ))}
        </ScrollView>
      </View>
      <ScrollView
        ref={scroller}
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {unavailable ? (
          <ComingSoon
            icon="message-circle"
            title="Ask KlimateX is on its way"
            body="Soon you can ask about your solar, payouts, audit or loan, by typing or by voice. Until then, the Help Center has quick answers."
          />
        ) : messages.length === 0 ? (
          <View style={{ alignItems: "center", paddingVertical: 18, gap: 8 }}>
            <View style={styles.spark}>
              <Icon name="star" size={22} color={colors.lime} />
            </View>
            <Text style={[t.h2, { textAlign: "center" }]}>Hello {firstName}, what would you like to know?</Text>
            <Text style={[t.body, { textAlign: "center" }]}>
              Answers come only from your home&apos;s records. Try one of these{micReady ? ", or tap the microphone and ask" : ""}.
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 10 }}>
              {suggestions.map((s) => (
                <Pressable key={s} onPress={() => send(s)} style={({ pressed }) => [styles.suggestion, pressed && { backgroundColor: colors.mint }]} accessibilityRole="button">
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "500" }}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          messages.map((m, i) => (
            <View key={i} style={{ alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
              <View style={[styles.bubble, m.role === "user" ? styles.mine : m.error ? styles.errorBubble : styles.theirs]}>
                <RichText style={{ color: m.role === "user" ? colors.white : m.error ? colors.redText : colors.ink, fontSize: 15, lineHeight: 21 }} selectable>
                  {m.content}
                </RichText>
                {m.reply && (
                  <View style={styles.sources}>
                    <Text style={{ fontSize: 11.5, color: colors.body, fontWeight: "600" }}>{m.reply.mode === "model" ? "AI answer" : "Quick answer"} from</Text>
                    {(m.reply.sources.length ? m.reply.sources : ["help"]).map((s) => (
                      <Text key={s} style={styles.source}>
                        {s === "help" ? "KlimateX help" : (SOURCE_LABELS[s] ?? s)}
                      </Text>
                    ))}
                    <Pressable onPress={() => speak(plainText(m.content), m.reply!.lang)} hitSlop={8} style={styles.listen} accessibilityLabel="Read this answer aloud">
                      <Icon name="volume-2" size={13} color={colors.leaf} />
                      <Text style={{ fontSize: 11.5, color: colors.leaf, fontWeight: "700" }}>Listen</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
        {busy && (
          <View style={[styles.bubble, styles.theirs, { flexDirection: "row", gap: 8, alignItems: "center" }]}>
            <ActivityIndicator size="small" color={colors.leaf} />
            <Text style={{ color: colors.body, fontSize: 13.5 }}>KlimateX is answering…</Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.composer}>
        {voiceNote ? <Text style={{ color: "#8a5a00", fontSize: 12.5, marginBottom: 6 }}>{voiceNote}</Text> : null}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
          {micReady && (
            <Pressable
              onPress={toggleListening}
              disabled={busy || unavailable}
              style={[styles.round, listening ? { backgroundColor: "#fef2f2", borderColor: "#fca5a5" } : null, (busy || unavailable) && { opacity: 0.5 }]}
              accessibilityLabel={listening ? "Stop listening" : "Ask by voice"}
              accessibilityState={{ selected: listening }}
            >
              <Icon name={listening ? "mic-off" : "mic"} size={19} color={listening ? "#b91c1c" : colors.forest} />
            </Pressable>
          )}
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={listening ? "Listening…" : "Ask a question"}
            placeholderTextColor={colors.muted}
            multiline
            maxLength={500}
            style={styles.input}
            editable={!unavailable}
            accessibilityLabel="Your question"
          />
          <Pressable
            onPress={() => send(draft)}
            disabled={busy || !draft.trim()}
            style={[styles.round, styles.send, (busy || !draft.trim()) && { opacity: 0.4 }]}
            accessibilityLabel="Send"
          >
            <Icon name="arrow-up" size={19} color={colors.white} />
          </Pressable>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
          <Pressable
            onPress={toggleSpeak}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
            accessibilityRole="switch"
            accessibilityState={{ checked: speakAloud }}
          >
            <Icon name={speakAloud ? "volume-2" : "volume-x"} size={14} color={speakAloud ? colors.leaf : colors.muted} />
            <Text style={{ fontSize: 12, color: speakAloud ? colors.leaf : colors.muted, fontWeight: "600" }}>{speakAloud ? "Reading answers aloud" : "Read answers aloud"}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/support")} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Icon name="headphones" size={13} color={colors.leaf} />
            <Text style={{ fontSize: 12, color: colors.leaf, fontWeight: "600" }}>Talk to a person</Text>
          </Pressable>
        </View>
        <Text style={[t.small, { marginTop: 4, fontSize: 11.5 }]}>It can only read your records: it can&apos;t move money or change your details. Never share your PIN here.</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  toolbar: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  spark: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.forest, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  suggestion: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  bubble: { maxWidth: "88%", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10 },
  mine: { backgroundColor: colors.forest, borderBottomRightRadius: 6 },
  theirs: { backgroundColor: colors.white, borderBottomLeftRadius: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, alignSelf: "flex-start" },
  errorBubble: { backgroundColor: colors.redBg, borderBottomLeftRadius: 6 },
  sources: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 5,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  source: { fontSize: 11.5, color: colors.body, backgroundColor: colors.mint, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden" },
  listen: { flexDirection: "row", alignItems: "center", gap: 3, marginLeft: "auto" },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: "#fafcf9", padding: 12 },
  round: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  send: { backgroundColor: colors.forest, borderColor: colors.forest },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
    color: colors.ink,
  },
});
