import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { GradeBadge, HouseholdGate } from "@/components/household";
import { Button, Card, DetailRow, ListRow, Screen, SectionHeader, type as t } from "@/components/ui";
import { signOut } from "@/lib/api";
import { fetchPayoutDetails, formatPhone, realEmail, type PayoutDetails } from "@/lib/extras";
import { formatNaira, formatNumber, homeCode, initialsOf, kwh, longDate, tco2 } from "@/lib/household";
import { useDashboard, useHousehold } from "@/lib/household-context";
import { colors } from "@/theme";

/** A ring that fills to the trust score. */
function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const c = 2 * Math.PI * r;
  const tone = score >= 80 ? "#2f8f00" : score >= 50 ? "#e3a600" : "#c2410c";
  return (
    <View style={{ width: 100, height: 100 }}>
      <Svg width={100} height={100} viewBox="0 0 100 100" style={{ transform: [{ rotate: "-90deg" }] }}>
        <Circle cx={50} cy={50} r={r} fill="none" stroke="#eef2ec" strokeWidth={9} />
        <Circle cx={50} cy={50} r={r} fill="none" stroke={tone} strokeWidth={9} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
        <Text style={{ fontSize: 26, fontWeight: "700", color: colors.ink }}>{score}</Text>
        <Text style={{ fontSize: 10, color: colors.muted }}>out of 100</Text>
      </View>
    </View>
  );
}

function Profile() {
  const { user } = useHousehold();
  const data = useDashboard();
  const { home, certificate: c } = data;
  const [payout, setPayout] = useState<PayoutDetails | null>(null);

  useEffect(() => {
    fetchPayoutDetails()
      .then(setPayout)
      .catch(() => setPayout(null));
  }, []);

  const generated = home.daily.reduce((s, d) => s + d.generated, 0);
  const litres = home.months.reduce((s, m) => s + m.litres, 0);
  const tonnes = home.months.reduce((s, m) => s + m.tonnes, 0);
  const checks = c?.checks ?? home.checks;
  const passed = checks.filter((ch) => ch.result === "pass").length;
  const email = realEmail(user.email);
  const destination = home.loan
    ? { title: "Your Access solar loan", detail: `Loan ${home.loan} · every payout goes straight to repayments` }
    : payout?.method === "bank" && payout.bank
      ? { title: `${payout.bank.bank_name} ···${payout.bank.account_ending}`, detail: payout.bank.account_name ?? "Name confirmed by your bank" }
      : { title: "Access wallet", detail: payout?.wallet?.phone ? `Linked to ${payout.wallet.phone}` : (home.wallet ?? "Created at installation") };

  return (
    <Screen>
      <View style={styles.banner}>
        <View style={styles.avatar}>
          <Text style={{ color: colors.forest, fontSize: 24, fontWeight: "800" }}>{initialsOf(user.name)}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.white, fontSize: 21, fontWeight: "700" }}>{user.name}</Text>
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
            {home.label} · {homeCode(home.siteId)} · {home.area}, Lagos
          </Text>
        </View>
        {c && <GradeBadge grade={c.grade_now} size={48} />}
      </View>

      <SectionHeader title="Contact" />
      <Card style={{ paddingVertical: 4 }}>
        <DetailRow first label="Phone" value={formatPhone(user.phone) || "Not set"} />
        <DetailRow label="Email" value={email ?? "Not added"} />
        <DetailRow label="Signs in with" value="Phone and 4-digit PIN" />
      </Card>

      <SectionHeader title="Your solar system" />
      <Card style={{ paddingVertical: 4 }}>
        <DetailRow first label="Panels" value={`${home.panelKwp} kWp`} />
        <DetailRow label="Inverter" value={`${home.inverter.vendor} · ${home.inverter.serial}`} />
        <DetailRow label="Grid hours a day" value={`${home.gridHours} h`} />
        <DetailRow label="Old generator" value={`${home.generator.kva} kVA · ${home.generator.serial}`} />
        <DetailRow label="Scrapped" value={longDate(home.generator.scrappedOn)} />
        <DetailRow label="Recycler certificate" value={home.generator.certificate ?? "Pending"} mono />
      </Card>

      <SectionHeader title="Trust score" description="How your readings stand up to the daily checks." />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <ScoreRing score={c?.trust_score ?? home.score ?? 0} />
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={t.h3}>
            {passed} of {checks.length} checks passed
          </Text>
          <Text style={t.small}>Auditors use this score, with your readings, to decide your credits. A high score means faster payouts.</Text>
        </View>
      </Card>

      <SectionHeader title="Your impact so far" />
      <Card style={{ paddingVertical: 4 }}>
        <DetailRow first label="Solar measured" value={kwh(generated)} />
        <DetailRow label="Petrol avoided" value={`${formatNumber(Math.round(litres))} L`} />
        <DetailRow label="Carbon credited" value={tco2(tonnes)} />
        <DetailRow label="Paid to you" value={formatNaira(data.paidNaira)} />
      </Card>

      <SectionHeader title="Where we pay you" />
      <Card padded={false}>
        <ListRow icon={home.loan ? "home" : "credit-card"} title={destination.title} subtitle={destination.detail} onPress={() => router.push("/payment-details")} last />
      </Card>

      <Button
        title="Sign out"
        icon="log-out"
        variant="secondary"
        onPress={() =>
          Alert.alert("Sign out?", "You'll need your phone number and PIN to sign in again.", [
            { text: "Cancel", style: "cancel" },
            { text: "Sign out", style: "destructive", onPress: () => void signOut() },
          ])
        }
      />
    </Screen>
  );
}

export default function ProfileScreen() {
  return (
    <HouseholdGate>
      <Profile />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  banner: { backgroundColor: colors.forest, borderRadius: 22, padding: 18, flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: colors.lime, alignItems: "center", justifyContent: "center" },
});
