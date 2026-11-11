import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { HouseholdGate } from "@/components/household";
import { Button, Card, Icon, Notice, OfflineBanner, SectionHeader, type IconName, type as t } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { fetchSupportRequests, sendSupportRequest, type Contact, type SupportRequest, type TopicId } from "@/lib/extras";
import { homeCode, longDate } from "@/lib/household";
import { useDashboard, useHousehold } from "@/lib/household-context";
import { colors } from "@/theme";

const TOPICS: { id: TopicId; label: string; icon: IconName; hint: string }[] = [
  { id: "system", label: "System not working", icon: "wifi-off", hint: "Inverter offline, low output, damage" },
  { id: "payment", label: "Payment question", icon: "credit-card", hint: "Missing, late or unexpected amount" },
  { id: "loan", label: "Solar loan", icon: "home", hint: "Repayments and balance" },
  { id: "certificate", label: "Certificate or grade", icon: "award", hint: "Something looks wrong" },
  { id: "account", label: "Account and sign-in", icon: "key", hint: "Phone, PIN, payment details" },
  { id: "other", label: "Something else", icon: "help-circle", hint: "Anything we haven't listed" },
];

const CONTACTS: { id: Contact; label: string; icon: IconName }[] = [
  { id: "app", label: "In the app", icon: "message-square" },
  { id: "sms", label: "Text me", icon: "smartphone" },
  { id: "call", label: "Call me", icon: "phone" },
];

const STEPS = ["Received", "With the team", "Resolved"];
const stepOf = (status: string) => (status === "resolved" ? 2 : status === "in_progress" ? 1 : 0);

function Support() {
  const { alerts } = useHousehold();
  const data = useDashboard();
  const offline = alerts.some((a) => a.kind === "no_data" || a.kind === "low_output");
  const [topic, setTopic] = useState<TopicId | null>(offline ? "system" : null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState<Contact>("app");
  const [share, setShare] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const [sent, setSent] = useState<SupportRequest | null>(null);
  const [requests, setRequests] = useState<SupportRequest[] | null>(null);
  const [listError, setListError] = useState("");
  const scroller = useRef<ComponentRef<typeof ScrollView>>(null);

  const loadRequests = useCallback(() => {
    fetchSupportRequests()
      .then((r) => {
        setListError("");
        setRequests(r);
      })
      .catch((e) => {
        setRequests([]);
        setListError(errorMessage(e, "Your requests couldn't be loaded."));
      });
  }, []);
  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const problems = {
    topic: !topic ? "Choose what this is about." : "",
    subject: subject.trim().length < 3 ? "Give it a short title." : "",
    message: message.trim().length < 10 ? "Tell us a little more (at least 10 characters)." : "",
  };
  const valid = !problems.topic && !problems.subject && !problems.message;
  const bad = (k: keyof typeof problems) => (touched ? problems[k] : "");

  const submit = async () => {
    setTouched(true);
    if (!valid || busy || !topic) return;
    setBusy(true);
    setError("");
    try {
      const request = await sendSupportRequest({ topic, subject: subject.trim(), message: message.trim(), contact, share_readings: share });
      setSent(request);
      setRequests((r) => [request, ...(r ?? [])]);
      setSubject("");
      setMessage("");
      setTouched(false);
      scroller.current?.scrollTo({ y: 0, animated: true });
    } catch (e) {
      setError(errorMessage(e, "Your message couldn't be sent. Try again."));
    }
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <OfflineBanner />
      <ScrollView ref={scroller} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 60 }} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
        <Text style={t.body}>Tell us what&apos;s wrong. Most requests get a reply within one working day.</Text>
        {sent && (
          <Notice tone="success" icon="check-circle">
            <Text style={{ color: colors.forest, fontSize: 14, lineHeight: 20 }}>
              <Text style={{ fontWeight: "700" }}>We&apos;ve got your message. </Text>
              Reference <Text style={{ fontFamily: "Menlo", fontWeight: "700" }}>{sent.reference}</Text>. We&apos;ll{" "}
              {sent.contact === "call" ? "call you" : sent.contact === "sms" ? "text you" : "reply here"} within one working day.
            </Text>
          </Notice>
        )}

        <SectionHeader title="What do you need help with?" />
        <View style={{ gap: 8 }}>
          {TOPICS.map((x) => {
            const active = topic === x.id;
            return (
              <Pressable
                key={x.id}
                onPress={() => setTopic(x.id)}
                style={[styles.topic, active && styles.topicOn]}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
              >
                <View style={[styles.topicIcon, active && { backgroundColor: colors.forest }]}>
                  <Icon name={x.icon} size={17} color={active ? colors.white : colors.forest} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[t.h3, { fontSize: 14 }]}>{x.label}</Text>
                  <Text style={t.small}>{x.hint}</Text>
                </View>
                {active && <Icon name="check" size={18} color={colors.forest} />}
              </Pressable>
            );
          })}
          {bad("topic") ? <Text style={styles.problem}>{problems.topic}</Text> : null}
        </View>

        <Card style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Title</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              maxLength={120}
              placeholder="For example: inverter light is off"
              placeholderTextColor={colors.muted}
              style={[styles.input, bad("subject") ? styles.inputBad : null]}
            />
            {bad("subject") ? <Text style={styles.problem}>{problems.subject}</Text> : null}
          </View>
          <View style={{ gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.label}>What happened?</Text>
              <Text style={t.small}>{message.length} / 2000</Text>
            </View>
            <TextInput
              value={message}
              onChangeText={setMessage}
              maxLength={2000}
              multiline
              placeholder="When did it start, and what have you noticed? Any detail helps."
              placeholderTextColor={colors.muted}
              style={[styles.input, { height: 120, paddingTop: 12, textAlignVertical: "top" }, bad("message") ? styles.inputBad : null]}
            />
            {bad("message") ? <Text style={styles.problem}>{problems.message}</Text> : null}
          </View>
          <View style={{ gap: 8 }}>
            <Text style={styles.label}>How should we reply?</Text>
            <View style={styles.segment}>
              {CONTACTS.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setContact(c.id)}
                  style={[styles.segmentItem, contact === c.id && styles.segmentOn]}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: contact === c.id }}
                >
                  <Icon name={c.icon} size={14} color={contact === c.id ? colors.forest : colors.body} />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: contact === c.id ? colors.forest : colors.body }}>{c.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 14, padding: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[t.h3, { fontSize: 14 }]}>Attach my home details and recent readings</Text>
              <Text style={t.small}>
                {homeCode(data.home.siteId)} · {data.home.inverter.serial} · last 14 days. Saves you explaining twice.
              </Text>
            </View>
            <Switch value={share} onValueChange={setShare} trackColor={{ true: colors.leaf, false: colors.line }} />
          </View>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button title="Send message" icon="send" busy={busy} onPress={submit} />
          <Text style={[t.small, { textAlign: "center" }]}>KlimateX will never ask for your PIN or BVN.</Text>
        </Card>

        <SectionHeader title="Your requests" description={requests && requests.length > 0 ? `${requests.length} total` : undefined} />
        <Card padded={false}>
          {requests === null ? (
            <ActivityIndicator style={{ padding: 24 }} color={colors.leaf} />
          ) : listError ? (
            <View style={{ padding: 16, gap: 8 }}>
              <Text style={{ color: colors.redText }}>{listError}</Text>
              <Pressable
                onPress={() => {
                  setRequests(null);
                  loadRequests();
                }}
              >
                <Text style={{ color: colors.leaf, fontWeight: "700" }}>Try again</Text>
              </Pressable>
            </View>
          ) : requests.length === 0 ? (
            <Text style={[t.body, { padding: 18, textAlign: "center" }]}>No requests yet. When you send one, you can follow it here.</Text>
          ) : (
            requests.map((r, i) => {
              const step = stepOf(r.status);
              const T = TOPICS.find((x) => x.id === r.topic) ?? TOPICS[5];
              return (
                <View
                  key={r.id}
                  style={[
                    { padding: 14, gap: 6, flexDirection: "row" },
                    i < requests.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
                  ]}
                >
                  <View style={styles.topicIcon}>
                    <Icon name={T.icon} size={17} color={colors.forest} />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={[t.h3, { fontSize: 14 }]}>{r.subject}</Text>
                    <Text style={[t.mono, { fontSize: 11, color: colors.muted }]}>
                      {r.reference} · {longDate(r.created_at)}
                    </Text>
                    <Text style={t.small} numberOfLines={1}>
                      {r.message}
                    </Text>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                      {STEPS.map((s, n) => (
                        <View key={s} style={[styles.step, n <= step && { backgroundColor: colors.mint }]}>
                          {n <= step && <Icon name="check" size={11} color={colors.forest} />}
                          <Text style={{ fontSize: 11, fontWeight: "600", color: n <= step ? colors.forest : colors.muted }}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </Card>

        <Card style={{ gap: 10 }}>
          <Text style={t.h3}>Who handles what</Text>
          {[
            { icon: "tool" as IconName, title: "Your installer", body: "Repairs, panel cleaning, inverter faults. We book the visit for you." },
            { icon: "home" as IconName, title: "Access Bank", body: "Loan schedule and wallet questions. Any branch can help." },
            { icon: "message-square" as IconName, title: "KlimateX", body: "Payouts, readings, certificates and your account." },
          ].map((w) => (
            <View key={w.title} style={{ flexDirection: "row", gap: 10 }}>
              <View style={styles.topicIcon}>
                <Icon name={w.icon} size={16} color={colors.forest} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[t.h3, { fontSize: 14 }]}>{w.title}</Text>
                <Text style={t.small}>{w.body}</Text>
              </View>
            </View>
          ))}
          <Text style={t.small}>Reply time: within 1 working day, Monday to Saturday, 8 am to 6 pm. Offline systems are seen first.</Text>
        </Card>
      </ScrollView>
    </View>
  );
}

export default function SupportScreen() {
  return (
    <HouseholdGate>
      <Support />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  topic: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  topicOn: { borderColor: colors.forest, backgroundColor: "#f4f8f3" },
  topicIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#f3f6f2", alignItems: "center", justifyContent: "center" },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  input: { minHeight: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, fontSize: 15, color: colors.ink, backgroundColor: colors.white },
  inputBad: { borderColor: "#fca5a5" },
  problem: { color: "#b91c1c", fontSize: 12.5 },
  segment: { flexDirection: "row", backgroundColor: "#f3f6f2", borderRadius: 12, padding: 4, gap: 4 },
  segmentItem: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8, borderRadius: 9 },
  segmentOn: { backgroundColor: colors.white, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 3, shadowOffset: { width: 0, height: 1 } },
  step: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#f3f6f2", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
});
