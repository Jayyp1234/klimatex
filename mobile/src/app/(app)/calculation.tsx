import { router } from "expo-router";
import { useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { HouseholdGate } from "@/components/household";
import { Card, Chip, DetailRow, EmptyState, ListRow, Notice, Screen, SectionHeader, type as t } from "@/components/ui";
import { formatNaira, formatNumber, kwh, longDate, monthLabel, PETROL_NAIRA_PER_LITRE, tco2, type Month } from "@/lib/household";
import { useDashboard } from "@/lib/household-context";
import { colors } from "@/theme";

/** The method the server's carbon engine follows (backend-php/src/Services/Carbon/Carbon.php). */
const METHOD = "Gold Standard JUST: Fossil Fuel Generators v1.0, Scenario B (unreliable grid)";

function Step({ n, title, value, children, total = false }: { n: string; title: string; value: string; children: ReactNode; total?: boolean }) {
  return (
    <View style={[styles.step, total && styles.total]}>
      <View style={[styles.n, total && { backgroundColor: colors.forest }]}>
        <Text style={{ color: total ? colors.white : colors.forest, fontWeight: "700", fontSize: 13 }}>{n}</Text>
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
          <Text style={[t.h3, { flex: 1 }]}>{title}</Text>
          <Text style={{ fontSize: 15, fontWeight: "700", color: total ? colors.forest : colors.ink }}>{value}</Text>
        </View>
        <Text style={t.small}>{children}</Text>
      </View>
    </View>
  );
}

function Working({ month: m }: { month: Month }) {
  const { home } = useDashboard();
  const days = home.daily.filter((d) => d.day.startsWith(m.month));
  const backup = days.reduce((s, d) => s + d.backup, 0);
  const generatorShare = 1 - home.gridHours / 24;
  const credited = Math.min(m.solarKwh, m.capKwh);
  // The emission factor the baseline works out to, read back from the server's own figures.
  const factor = credited > 0 ? m.baselineT / (credited / 1000) : 0;
  const net = Math.max(0, m.baselineT - m.projectT - m.leakageT);

  return (
    <Card style={{ gap: 0, paddingVertical: 6 }}>
      <Step n="1" title="Solar your home used" value={kwh(m.solarKwh)}>
        Measured by inverter {home.inverter.serial} on {days.length} day{days.length === 1 ? "" : "s"} in {monthLabel(m.month)}. A day that fails a check earns nothing.
      </Step>
      <Step n="2" title="Most the old generator could have made" value={kwh(m.capKwh)}>
        From your scrapped {home.generator.kva} kVA generator. Solar is only credited up to this cap{m.solarKwh <= m.capKwh ? ", and yours is under it" : ""}.
      </Step>
      <Step n="3" title="Baseline: what the generator and grid would have emitted" value={tco2(m.baselineT, 3)}>
        {kwh(credited)} at {factor.toFixed(2)} t per MWh. That blends generator and grid emissions for a home with {home.gridHours} hours of grid a day (
        {Math.round(generatorShare * 100)}% generator), less the method&apos;s adjustment.
      </Step>
      <Step n="4" title="Project emissions" value={`− ${tco2(m.projectT, 3)}`}>
        Backup generator use ({kwh(backup)} this month) plus the equipment&apos;s own footprint.
      </Step>
      <Step n="5" title="Leakage" value={`− ${tco2(m.leakageT, 3)}`}>
        Applies only when solar falls short of your home&apos;s usual need.
      </Step>
      <Step n="=" title="Credited to your home" value={tco2(m.tonnes, 3)} total>
        {m.baselineT.toFixed(3)} − {m.projectT.toFixed(3)} − {m.leakageT.toFixed(3)} = {net.toFixed(3)} tCO₂e
      </Step>
      <Step n="L" title="Petrol avoided" value={`${formatNumber(Math.round(m.litres))} L`}>
        {kwh(m.solarKwh)} × {Math.round(generatorShare * 100)}% generator share × 0.7 L per kWh. At about {formatNaira(PETROL_NAIRA_PER_LITRE)} a litre that is ≈{" "}
        {formatNaira(Math.round(m.litres) * PETROL_NAIRA_PER_LITRE)}, shown as an estimate.
      </Step>
    </Card>
  );
}

function Calculation() {
  const data = useDashboard();
  const { home, certificate } = data;
  const months = home.months;
  const [picked, setPicked] = useState<string | null>(null);
  const month = months.find((m) => m.month === picked) ?? months[months.length - 1];
  const checks = home.checks.length ? home.checks : (certificate?.checks ?? []);
  const passed = checks.filter((c) => c.result === "pass").length;
  const sunRule = String(checks.find((c) => c.name === "sunlight")?.evidence?.rule ?? "");
  const simulated = home.inverter.vendor === "simulator";

  if (!month) {
    return (
      <Screen>
        <EmptyState icon="hash" title="No audited months yet" body="The working appears after your first audited period." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={t.body}>Every figure in this app comes from your inverter&apos;s daily readings. Here is the working for one month, so anyone can check it.</Text>
      {simulated && (
        <Notice tone="info">Sandbox: this home&apos;s readings come from a simulator, for the demo. The method and checks are the ones a real inverter goes through.</Notice>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
        {[...months].reverse().map((m) => (
          <Chip key={m.month} label={monthLabel(m.month)} selected={m.month === month.month} onPress={() => setPicked(m.month)} />
        ))}
      </ScrollView>

      <Working month={month} />

      <SectionHeader title="Where the numbers come from" />
      <Card style={{ paddingVertical: 4 }}>
        <DetailRow first label="Method" value={METHOD} />
        <DetailRow label="Energy" value={`Inverter ${home.inverter.serial}`} />
        <DetailRow label="Readings" value={`${home.daily.length} days, ${longDate(home.daily[0]?.day ?? null)} to ${longDate(data.dataAsOf)}`} />
        <DetailRow
          label="Sunlight"
          value={sunRule.includes("NASA") ? `NASA daily sunlight for ${home.area}. A day can't exceed sunlight × ${home.panelKwp} kWp × 1.1` : `Daily sunlight for ${home.area}`}
        />
        <DetailRow label="Old generator" value={`${home.generator.kva} kVA, scrapped ${longDate(home.generator.scrappedOn)}`} />
        <DetailRow label="Recycler certificate" value={home.generator.certificate ?? "Pending"} mono />
      </Card>

      <SectionHeader title="Who checks it" />
      <Card padded={false}>
        <ListRow
          icon="shield"
          title={`${passed} of ${checks.length} daily checks passed`}
          subtitle={`Trust score ${certificate?.trust_score ?? home.score ?? "not computed"} out of 100. An auditor signs off each period.`}
          onPress={() => router.push("/certificate")}
        />
        <ListRow icon="hash" title="Every credit has a public serial" subtitle="Anyone can check a serial on the registry." onPress={() => router.push("/credits")} last />
      </Card>
    </Screen>
  );
}

export default function CalculationScreen() {
  return (
    <HouseholdGate>
      <Calculation />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  step: { flexDirection: "row", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  total: { backgroundColor: colors.mint, marginHorizontal: -16, paddingHorizontal: 16 },
  n: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
});
