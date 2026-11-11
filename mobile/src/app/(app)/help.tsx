import { router } from "expo-router";
import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, Icon, Screen, SectionHeader, type IconName, type as t } from "@/components/ui";
import { useHousehold } from "@/lib/household-context";
import { colors } from "@/theme";

type Topic = "start" | "solar" | "payments" | "certificate" | "loan" | "account";

const TOPICS: { id: Topic; label: string; icon: IconName; bg: string; fg: string }[] = [
  { id: "start", label: "Getting started", icon: "play-circle", bg: "#e8f3df", fg: "#2f6b00" },
  { id: "solar", label: "Solar and readings", icon: "sun", bg: "#fdf3d7", fg: "#8a5a00" },
  { id: "payments", label: "Payouts", icon: "credit-card", bg: colors.mint, fg: colors.forest },
  { id: "certificate", label: "Certificate and grades", icon: "award", bg: "#eef3f7", fg: "#35546b" },
  { id: "loan", label: "Solar loan", icon: "home", bg: "#f3eefb", fg: "#5b3b8c" },
  { id: "account", label: "Account and privacy", icon: "key", bg: "#fbeeee", fg: "#9b2c2c" },
];

/** The same answers as the web Help Center, worded for the app where the steps differ. */
const FAQ: { topic: Topic; q: string; a: string }[] = [
  {
    topic: "start",
    q: "How does KlimateX earn money for my home?",
    a: "Before solar, your home burned petrol in a generator. Every kilowatt-hour your panels make instead avoids that petrol and the carbon it would have released. We measure it from your inverter, an independent auditor checks it, and the carbon registry issues credits. Companies buy those credits, and your share is paid to you.",
  },
  {
    topic: "start",
    q: "Do I need to do anything each month?",
    a: "No. Keep your inverter switched on and connected. Readings arrive on their own, checks run every day, and you get a message when a report or payment is ready.",
  },
  {
    topic: "start",
    q: "Why was my generator scrapped?",
    a: "A credit only counts if the old generator can never run again. Your installer handed it to a licensed recycler, who issued the certificate number shown on your profile. That proof is part of what buyers pay for.",
  },
  {
    topic: "solar",
    q: "What are the daily checks?",
    a: "Every day we compare what your panels made with the sunlight NASA measured over your street, your own past days, and similar homes nearby. Readings that are impossible, flat, copied or missing are flagged before any tonne counts.",
  },
  {
    topic: "solar",
    q: "My home shows “no data”. What should I do?",
    a: "Check that the inverter screen is on and its Wi-Fi light is lit, then wait a day. If it is still offline, open Contact Support and choose “System not working”. We'll ask your installer to visit.",
  },
  {
    topic: "solar",
    q: "Why is a day marked “above what the sun allowed”?",
    a: "A panel can't make more than the sunlight that reached it. When a reading is higher, it is usually a meter fault, so that day is left out of your credits until it's explained. You are never charged for it.",
  },
  {
    topic: "payments",
    q: "How much of each credit do I receive?",
    a: "You receive 50% of what every credit from your home sells for. The rest pays your installer, the auditor and KlimateX's running costs. The Payouts tab shows each payment with the credit serials that paid for it.",
  },
  {
    topic: "payments",
    q: "When am I paid?",
    a: "After each audited period is signed off and the credits are sold. The money is sent the same day and you get a notification with the amount and reference.",
  },
  {
    topic: "payments",
    q: "Can I be paid into my own bank account?",
    a: "Yes. Open More, then Payment details, and add any Nigerian bank account in your name. The bank confirms the account name before it's saved. If you have a solar loan, payments go to the loan first.",
  },
  {
    topic: "payments",
    q: "What does “held” mean?",
    a: "A period is held when a check failed and the auditor needs to look closer. Nothing is lost: once it's cleared, the credits are issued and you're paid. Open the alert and tap “See why” for the plain-language reason.",
  },
  {
    topic: "certificate",
    q: "What does my grade mean?",
    a: "Your grade shows how much of your home's power still comes from a generator: A is 0 to 2%, G is over 75%. It is measured from your own inverter over months, not guessed in a one-day survey.",
  },
  {
    topic: "certificate",
    q: "How do I share my certificate?",
    a: "Open Certificate and tap “Share certificate”. For the A4 PDF with its QR code, open the KlimateX web app and press “Download PDF”.",
  },
  {
    topic: "certificate",
    q: "How can I reach grade A?",
    a: "Your certificate lists the next step for your home, usually a small battery. Less generator time earns more credits, and the step can be financed with an Access solar loan.",
  },
  {
    topic: "loan",
    q: "How do carbon payouts repay my loan?",
    a: "While your solar loan is open, every payout goes straight to Access Bank as a repayment. You'll see each one on the Loan screen and in your notifications. When the loan is cleared, payouts go to your wallet or bank.",
  },
  {
    topic: "loan",
    q: "Do I still pay my loan instalments?",
    a: "Yes. Carbon payouts reduce what you owe, but they don't replace your agreed instalments. For questions about your loan schedule, visit any Access Bank branch.",
  },
  {
    topic: "account",
    q: "How do I sign in?",
    a: "With your phone number and your 4-digit PIN. The first time, or if you forget your PIN, we send a 6-digit code to prove the phone is yours.",
  },
  {
    topic: "account",
    q: "Who can see my data?",
    a: "You, your installer, the auditor and KlimateX. The public carbon registry sees only a code for your home, never your name, phone or address. We read energy data only: no BVN or bank details leave your bank.",
  },
  {
    topic: "account",
    q: "Can I download my readings?",
    a: "Yes, from the KlimateX web app: open Settings, then Preferences, and use “Your data” to download your daily readings and payout history as spreadsheets.",
  },
];

export default function Help() {
  const { user } = useHousehold();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [open, setOpen] = useState<string | null>(FAQ[0].q);
  const q = query.trim().toLowerCase();
  const results = FAQ.filter((f) => (!topic || f.topic === topic) && (!q || `${f.q} ${f.a}`.toLowerCase().includes(q)));
  const label = topic ? TOPICS.find((x) => x.id === topic)!.label : q ? "Search results" : "Popular questions";

  return (
    <Screen>
      <View style={styles.hero}>
        <Text style={{ color: colors.lime, fontSize: 13, fontWeight: "600" }}>Help Center</Text>
        <Text style={{ color: colors.white, fontSize: 24, fontWeight: "700", letterSpacing: -0.5 }}>How can we help, {user.name.split(" ")[0]}?</Text>
        <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 14 }}>Plain answers about your solar, payouts, certificate and loan.</Text>
        <View style={styles.search}>
          <Icon name="search" size={18} color={colors.muted} />
          <TextInput
            value={query}
            onChangeText={(v) => {
              setQuery(v);
              setTopic(null);
            }}
            placeholder="Search, for example “held”"
            placeholderTextColor={colors.muted}
            style={{ flex: 1, fontSize: 15.5, color: colors.ink }}
            returnKeyType="search"
          />
        </View>
      </View>

      <View style={styles.topics}>
        {TOPICS.map((x) => {
          const active = topic === x.id;
          return (
            <Pressable
              key={x.id}
              onPress={() => {
                setTopic(active ? null : x.id);
                setQuery("");
                setOpen(null);
              }}
              style={[styles.topic, active && { borderColor: colors.forest, borderWidth: 2 }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
            >
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: x.bg, alignItems: "center", justifyContent: "center" }}>
                <Icon name={x.icon} size={18} color={x.fg} />
              </View>
              <Text style={{ fontSize: 13, fontWeight: "600", color: colors.ink }} numberOfLines={2}>
                {x.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <SectionHeader
        title={label}
        actionLabel={topic || q ? "Show all" : undefined}
        onAction={() => {
          setTopic(null);
          setQuery("");
        }}
      />
      <Card padded={false}>
        {results.length === 0 ? (
          <View style={{ padding: 20, alignItems: "center", gap: 6 }}>
            <Text style={t.h3}>No answers match “{query}”</Text>
            <Text style={t.body}>Try another word, or ask us directly.</Text>
          </View>
        ) : (
          results.map((f, i) => {
            const expanded = open === f.q;
            return (
              <View key={f.q} style={i < results.length - 1 ? { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line } : null}>
                <Pressable onPress={() => setOpen(expanded ? null : f.q)} style={styles.q} accessibilityRole="button" accessibilityState={{ expanded }}>
                  <Text style={{ flex: 1, fontSize: 14.5, color: expanded ? colors.forest : colors.ink, fontWeight: expanded ? "700" : "500" }}>{f.q}</Text>
                  <Icon name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
                </Pressable>
                {expanded && <Text style={[t.body, { paddingHorizontal: 16, paddingBottom: 16 }]}>{f.a}</Text>}
              </View>
            );
          })
        )}
      </Card>

      <Card style={{ gap: 10, backgroundColor: colors.mint }}>
        <Text style={t.h3}>Still need help?</Text>
        <Text style={t.body}>Send us a message. Your home and readings are attached, so you don&apos;t have to explain twice.</Text>
        <Button title="Contact Support" icon="headphones" onPress={() => router.push("/support")} />
      </Card>
      <Card style={{ gap: 6 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="shield" size={16} color={colors.leaf} />
          <Text style={t.h3}>Staying safe</Text>
        </View>
        <Text style={t.body}>• KlimateX will never ask for your PIN, BVN or card details.</Text>
        <Text style={t.body}>• We never ask you to pay to receive a payout.</Text>
        <Text style={t.body}>• Only open the inverter if your installer is with you.</Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.forest, borderRadius: 22, padding: 18, gap: 6 },
  search: { flexDirection: "row", alignItems: "center", gap: 8, height: 48, borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: 14, marginTop: 10 },
  topics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  topic: { flexBasis: "30%", flexGrow: 1, gap: 8, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  q: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingVertical: 14 },
});
