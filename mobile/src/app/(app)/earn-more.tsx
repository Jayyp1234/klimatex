import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { HouseholdGate, StaleNotice } from "@/components/household";
import { Card, Icon, Pill, Screen, SectionHeader, type as t } from "@/components/ui";
import { useDashboard, useHousehold } from "@/lib/household-context";
import type { Tip } from "@/lib/tips";
import { useEarnMore } from "@/lib/use-earn-more";
import { colors } from "@/theme";

const TONE = {
  urgent: { bg: "#fef2f2", fg: "#b91c1c", pill: "red", label: "Costing you credits" },
  improve: { bg: "#fdf3d7", fg: "#8a5a00", pill: "amber", label: "Worth improving" },
  good: { bg: colors.mint, fg: colors.forest, pill: "green", label: "Doing well" },
} as const;

function TipCard({ tip }: { tip: Tip }) {
  const tone = TONE[tip.state];
  return (
    <Card style={{ gap: 10 }}>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <View style={[styles.icon, { backgroundColor: tone.bg }]}>
          <Icon name={tip.icon} size={18} color={tone.fg} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Pill tone={tone.pill}>{tone.label}</Pill>
            {tip.installer && tip.state !== "good" && <Pill tone="grey">Your installer</Pill>}
          </View>
          <Text style={[t.h3, { fontSize: 15.5 }]}>{tip.title}</Text>
          <Text style={t.body}>{tip.body}</Text>
        </View>
      </View>
      {tip.step ? (
        <View style={styles.step}>
          <Icon name="arrow-right-circle" size={16} color={colors.leaf} />
          <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: colors.ink }}>{tip.step}</Text>
        </View>
      ) : null}
      {tip.action ? (
        <Pressable onPress={() => router.push(tip.action!.href)} hitSlop={8} style={{ alignSelf: "flex-start" }} accessibilityRole="link">
          <Text style={{ color: colors.leaf, fontWeight: "700", fontSize: 14 }}>{tip.action.label} ›</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

function EarnMore() {
  const { refreshing, reload } = useHousehold();
  const data = useDashboard();
  const { tips, toImprove: open, cutPct } = useEarnMore(data);
  const todo = tips.filter((x) => x.state !== "good");
  const done = tips.filter((x) => x.state === "good");
  const score = data.certificate?.trust_score ?? data.home.score;

  return (
    <Screen onRefresh={() => reload("refresh")} refreshing={refreshing}>
      <View style={styles.hero}>
        <Text style={{ color: colors.lime, fontSize: 13, fontWeight: "600" }}>Earn more from your solar</Text>
        <Text style={styles.heroTitle}>{open === 0 ? "Your home is earning all it can" : `${open} thing${open === 1 ? "" : "s"} could earn you more`}</Text>
        <Text style={styles.heroBody}>A day that fails a check earns nothing, and a failed period isn&apos;t paid until it&apos;s cleared. These come from your own readings.</Text>
        {cutPct > 0 && <Text style={[styles.heroBody, { color: colors.lime }]}>Until your evidence is complete, your credits are about {cutPct}% lower (estimate).</Text>}
        {score !== null && score !== undefined && (
          <View style={styles.score}>
            <Text style={{ color: colors.white, fontSize: 22, fontWeight: "700" }}>{score}</Text>
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 12.5 }}>out of 100 · trust score an auditor sees</Text>
          </View>
        )}
      </View>

      <StaleNotice />

      {todo.length > 0 && (
        <>
          <SectionHeader title="What to improve" />
          {todo.map((tip) => (
            <TipCard key={tip.id} tip={tip} />
          ))}
        </>
      )}

      {done.length > 0 && (
        <>
          <SectionHeader title="What you're doing well" />
          {done.map((tip) => (
            <TipCard key={tip.id} tip={tip} />
          ))}
        </>
      )}

      <Pressable onPress={() => router.push("/calculation")} accessibilityRole="button">
        <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={[styles.icon, { backgroundColor: colors.mint }]}>
            <Icon name="hash" size={18} color={colors.forest} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={t.h3}>How your credits are calculated</Text>
            <Text style={t.small}>See the working for any month, with its sources.</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.muted} />
        </Card>
      </Pressable>
    </Screen>
  );
}

export default function EarnMoreScreen() {
  return (
    <HouseholdGate>
      <EarnMore />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.forest, borderRadius: 22, padding: 18, gap: 6 },
  heroTitle: { color: colors.white, fontSize: 22, fontWeight: "700", letterSpacing: -0.4, lineHeight: 27 },
  heroBody: { color: "rgba(255,255,255,0.78)", fontSize: 13.5, lineHeight: 19 },
  score: { flexDirection: "row", alignItems: "baseline", gap: 8, marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  step: { flexDirection: "row", gap: 8, backgroundColor: "#f7faf6", borderRadius: 12, padding: 12 },
});
