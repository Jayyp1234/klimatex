import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ComingSoon, HouseholdGate } from "@/components/household";
import { LogoMark } from "@/components/Logo";
import { RichText } from "@/components/RichText";
import { Card, Chip, Icon, Notice, Screen, type as t } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { notYetLive } from "@/lib/extras";
import { fetchMessage, LANGUAGES, type MonthlyMessage } from "@/lib/household";
import { useDashboard, useHousehold } from "@/lib/household-context";
import { colors } from "@/theme";

type Channel = "whatsapp" | "sms";

/** SMS is billed per 160-character part (70 when the text needs characters outside the basic set). */
function smsParts(text: string) {
  const unicode = /[^\x00-\x7F₦]/.test(text);
  const size = unicode ? 70 : 160;
  return { parts: Math.max(1, Math.ceil(text.length / size)), size };
}

type Result = { key: string; message?: MonthlyMessage; error?: string; missing?: boolean };

function MessageView() {
  const { lang, setLang } = useHousehold();
  const { home } = useDashboard();
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const key = `${home.siteId}:${lang}`;
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  const loading = result?.key !== key;
  const message = loading ? null : (result?.message ?? null);

  useEffect(() => {
    let stale = false;
    const k = `${home.siteId}:${lang}`;
    fetchMessage(home.siteId, lang)
      .then((m) => !stale && setResult({ key: k, message: m }))
      .catch((e) => !stale && setResult({ key: k, error: errorMessage(e, "Your message couldn't be loaded."), missing: notYetLive(e) }));
    return () => {
      stale = true;
    };
  }, [home.siteId, lang, attempt]);

  if (!loading && result?.missing) {
    return (
      <Screen>
        <ComingSoon
          icon="message-square"
          title="Monthly messages are on their way"
          body="Each month your family will get a short message about your home: your grade, the petrol you avoided, and what happens next with your payout."
        />
      </Screen>
    );
  }

  const sms = message ? smsParts(message.text) : null;
  const bubbleTone = channel === "whatsapp" ? { bg: "#ffffff", screen: "#ece5dd" } : { bg: "#e9e9eb", screen: "#ffffff" };

  return (
    <Screen>
      <Text style={t.body}>Each month your family gets a short message about your home: your grade, the petrol you avoided, and what happens next with your payout.</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
        <View style={{ width: 8 }} />
        {LANGUAGES.map((l) => (
          <Chip key={l.code} label={l.label} selected={lang === l.code} onPress={() => setLang(l.code)} />
        ))}
        <View style={{ width: 8 }} />
      </ScrollView>
      <View style={styles.segment}>
        {(["whatsapp", "sms"] as Channel[]).map((c) => (
          <Pressable
            key={c}
            onPress={() => setChannel(c)}
            style={[styles.segmentItem, channel === c && styles.segmentOn]}
            accessibilityRole="radio"
            accessibilityState={{ selected: channel === c }}
          >
            <Text style={{ fontWeight: "600", color: channel === c ? colors.ink : colors.body }}>{c === "sms" ? "SMS" : "WhatsApp"}</Text>
          </Pressable>
        ))}
      </View>

      <View style={[styles.phone, { backgroundColor: bubbleTone.screen }]}>
        <View style={styles.phoneHead}>
          <LogoMark size={26} />
          <View>
            <Text style={{ fontWeight: "700", color: colors.ink }}>KlimateX</Text>
            <Text style={{ fontSize: 11, color: colors.muted }}>{channel === "whatsapp" ? "Business account" : "Text message"}</Text>
          </View>
        </View>
        <View style={{ padding: 14 }}>
          <View style={[styles.bubble, { backgroundColor: bubbleTone.bg }]}>
            {loading ? (
              <ActivityIndicator color={colors.leaf} />
            ) : result?.error ? (
              <View style={{ gap: 8 }}>
                <Text style={{ color: colors.redText }}>{result.error}</Text>
                <Pressable
                  onPress={() => {
                    setResult(null);
                    setAttempt((n) => n + 1);
                  }}
                  hitSlop={8}
                >
                  <Text style={{ color: colors.leaf, fontWeight: "700" }}>Try again</Text>
                </Pressable>
              </View>
            ) : (
              <RichText style={{ fontSize: 15, lineHeight: 21, color: colors.ink }} selectable>
                {message?.text ?? ""}
              </RichText>
            )}
          </View>
        </View>
      </View>

      {message && (
        <Card style={{ gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name={message.source === "template" ? "message-square" : "star"} size={15} color={colors.leaf} />
            <Text style={t.h3}>{message.source === "template" ? "Standard message" : message.source === "model" ? "Written by AI" : "Your monthly message"}</Text>
          </View>
          <Text style={t.small}>
            {message.source === "template"
              ? "A standard message filled in with your home's real figures. The AI writer isn't answering right now; when it is, it writes this message for you."
              : "Written from your home's audited figures only. It never decides your credits or your payout."}
          </Text>
          {sms && channel === "sms" && (
            <Text style={[t.small, { marginTop: 4 }]}>
              {message.text.length} characters · {sms.parts} SMS {sms.parts === 1 ? "part" : "parts"} of up to {sms.size} characters
            </Text>
          )}
        </Card>
      )}
      <Notice tone="info">Preview. Messages aren&apos;t sent yet: no SMS or WhatsApp provider is connected to the sandbox.</Notice>
    </Screen>
  );
}

export default function MessageScreen() {
  return (
    <HouseholdGate>
      <MessageView />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  segment: { flexDirection: "row", backgroundColor: "#eef1ed", borderRadius: 12, padding: 4, alignSelf: "flex-start" },
  segmentItem: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 9 },
  segmentOn: { backgroundColor: colors.white, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  phone: { borderRadius: 24, overflow: "hidden", borderWidth: 6, borderColor: colors.ink, minHeight: 240 },
  phoneHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    backgroundColor: "#f6f6f6",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  bubble: {
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
    maxWidth: "92%",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 },
  },
});
