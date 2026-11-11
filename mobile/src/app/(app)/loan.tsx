import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { HouseholdGate } from "@/components/household";
import { Button, Card, EmptyState, Icon, Notice, Screen, SectionHeader, type IconName, type as t } from "@/components/ui";
import { formatNaira, homeCode, longDate, periodLabel, tco2 } from "@/lib/household";
import { useDashboard } from "@/lib/household-context";
import { colors } from "@/theme";

function addMonths(iso: string | null, months: number) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

const FLOW: { icon: IconName; title: string; body: string }[] = [
  { icon: "sun", title: "Panels make power", body: "Measured every day from your inverter" },
  { icon: "feather", title: "Petrol is avoided", body: "Each kWh replaces generator fuel" },
  { icon: "check-circle", title: "Credits issued", body: "Audited, then issued by the registry" },
  { icon: "briefcase", title: "A company buys", body: "50% of the price is your share" },
  { icon: "home", title: "Loan repaid", body: "Your share goes to Access Bank" },
];

function Loan() {
  const data = useDashboard();
  const { home, certificate: c } = data;
  const repayments = data.payouts.filter((p) => p.destination === "solar_loan");
  const repaid = repayments.reduce((s, p) => s + p.amountNaira, 0);
  const tonnesPaid = repayments.reduce((s, p) => s + p.tonnes, 0);
  const perTonne = tonnesPaid > 0 ? repaid / tonnesPaid : 0;
  const perYear = c ? c.credited_tco2e_per_year * perTonne : 0;
  const lastPeriodEnd = repayments[0]?.period?.end ?? data.dataAsOf;
  // The next audit covers the six months after the last paid period.
  const nextStart = lastPeriodEnd ? new Date(Date.parse(`${lastPeriodEnd.slice(0, 10)}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10) : null;
  const nextEnd = addMonths(lastPeriodEnd, 6);
  const nextPeriod = nextStart && nextEnd ? { start: nextStart, end: nextEnd } : null;
  const share = perYear > 0 ? Math.min(1, repaid / perYear) : 0;

  if (!home.loan) {
    return (
      <Screen>
        <EmptyState
          icon="home"
          title="No solar loan on this home"
          body="Your carbon payouts go to your own wallet or bank account. If you add a battery with an Access solar loan, payouts can repay it for you."
          action={<Button title="Payment details" icon="arrow-right" onPress={() => router.push("/payment-details")} style={{ marginTop: 10, alignSelf: "stretch" }} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={t.body}>Every carbon payout from your home goes straight to your Access solar loan.</Text>
      <View style={styles.card}>
        <Svg style={StyleSheet.absoluteFill} viewBox="0 0 400 260" preserveAspectRatio="xMaxYMin slice">
          {Array.from({ length: 8 }, (_, i) => (
            <Circle key={i} cx={380} cy={10} r={30 + i * 32} fill="none" stroke="#c7f36b" strokeOpacity={0.16} strokeWidth={1.2} />
          ))}
        </Svg>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <View>
            <Text style={styles.cardLabel}>ACCESS BANK · SOLAR LOAN</Text>
            <Text style={{ color: colors.white, fontFamily: "Menlo", fontSize: 14.5, marginTop: 3 }}>{home.loan}</Text>
          </View>
          <View style={styles.active}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.forest }} />
            <Text style={{ color: colors.forest, fontSize: 11.5, fontWeight: "700" }}>Active</Text>
          </View>
        </View>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, marginTop: 28 }}>Repaid by your carbon credits</Text>
        <Text style={{ color: colors.white, fontSize: 38, fontWeight: "700", letterSpacing: -0.8 }}>{formatNaira(repaid)}</Text>
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 13 }}>
          from {tco2(tonnesPaid)} sold · {repayments.length} repayment{repayments.length === 1 ? "" : "s"}
        </Text>
        <View style={styles.cardFoot}>
          <Foot label="Financed" value="Solar + 2.4 kWh battery" />
          <Foot label="Home" value={`${home.label} · ${homeCode(home.siteId)}`} />
          <Foot label="Paid automatically" value="After each audit" />
        </View>
      </View>

      <Card style={{ gap: 6 }}>
        <View style={styles.cap}>
          <Icon name="trending-up" size={15} color={colors.leaf} />
          <Text style={styles.capText}>Next 12 months from carbon</Text>
        </View>
        <Text style={{ fontSize: 28, fontWeight: "700", color: colors.ink }}>≈ {formatNaira(Math.round(perYear))}</Text>
        <Text style={t.small}>
          {c
            ? `Your home earns about ${tco2(c.credited_tco2e_per_year)} a year at ${formatNaira(Math.round(perTonne))} per tonne to you.`
            : "Shown once your first period is audited."}
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${share * 100}%` }]} />
        </View>
        {perYear > 0 && <Text style={t.small}>{Math.round((repaid / perYear) * 100)}% of a year&apos;s carbon already repaid</Text>}
      </Card>

      <Card style={{ gap: 4 }}>
        <View style={styles.cap}>
          <Icon name="clock" size={15} color={colors.leaf} />
          <Text style={styles.capText}>Next carbon repayment</Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: "700", color: colors.ink }}>After the {longDate(nextPeriod?.end ?? null)} audit</Text>
        <Text style={t.small}>Covers {periodLabel(nextPeriod)}. Sent the day the credits sell, no action needed.</Text>
      </Card>

      <SectionHeader title="How your sunshine repays the loan" />
      <Card style={{ gap: 0 }}>
        {FLOW.map((s, i) => (
          <View key={s.title} style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ alignItems: "center" }}>
              <View style={[styles.step, i === FLOW.length - 1 && { backgroundColor: colors.forest }]}>
                <Icon name={s.icon} size={17} color={i === FLOW.length - 1 ? colors.white : colors.forest} />
              </View>
              {i < FLOW.length - 1 && <View style={styles.stepLine} />}
            </View>
            <View style={{ flex: 1, paddingBottom: 14, paddingTop: 2 }}>
              <Text style={t.h3}>{s.title}</Text>
              <Text style={t.small}>{s.body}</Text>
            </View>
          </View>
        ))}
      </Card>

      <SectionHeader title="Carbon repayments" description="Tap one for the receipt" />
      {repayments.length === 0 ? (
        <EmptyState icon="dollar-sign" title="No repayments yet" body="The first arrives after your first audit." />
      ) : (
        repayments.map((p) => (
          <Pressable key={p.id} onPress={() => router.push({ pathname: "/payout/[id]", params: { id: String(p.id) } })} accessibilityRole="button">
            <Card style={{ gap: 4 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{formatNaira(p.amountNaira)}</Text>
                <Text style={{ color: colors.forest, fontWeight: "600", fontSize: 12, textTransform: "capitalize" }}>{p.status}</Text>
              </View>
              <Text style={t.small}>
                {periodLabel(p.period)} · {tco2(p.tonnes)} · paid {longDate(p.paidOn)}
              </Text>
              <Text style={[t.mono, { color: colors.muted, fontSize: 11.5 }]}>{p.reference}</Text>
            </Card>
          </Pressable>
        ))
      )}

      <Notice tone="info">
        Carbon payouts reduce what you owe but don&apos;t replace your agreed instalments. Your full balance and schedule are in your Access app or at any branch.
      </Notice>
    </Screen>
  );
}

function Foot({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={{ color: "rgba(255,255,255,0.6)", fontSize: 11.5 }}>{label}</Text>
      <Text style={{ color: colors.white, fontSize: 12.5, fontWeight: "600", marginTop: 2 }}>{value}</Text>
    </View>
  );
}

export default function LoanScreen() {
  return (
    <HouseholdGate>
      <Loan />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 24, backgroundColor: colors.leaf, padding: 20, overflow: "hidden" },
  cardLabel: { color: "rgba(255,255,255,0.6)", fontSize: 11, fontWeight: "600", letterSpacing: 1.2 },
  active: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: colors.lime, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 },
  cardFoot: { flexDirection: "row", gap: 10, marginTop: 22, paddingTop: 14, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.15)" },
  cap: { flexDirection: "row", alignItems: "center", gap: 6 },
  capText: { fontSize: 13, fontWeight: "600", color: colors.muted },
  track: { height: 8, borderRadius: 4, backgroundColor: "#eef3ec", overflow: "hidden", marginTop: 8 },
  fill: { height: "100%", borderRadius: 4, backgroundColor: "#4f9d2d" },
  step: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  stepLine: { width: 2, flex: 1, minHeight: 10, backgroundColor: "#cfe0cc", marginVertical: 2 },
});
