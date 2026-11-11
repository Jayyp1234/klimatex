import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { EnergyChart, SERIES } from "@/components/EnergyChart";
import { HouseholdGate, StaleNotice } from "@/components/household";
import { Card, Chip, Kpi, ListRow, Screen, type as t } from "@/components/ui";
import { dayStatus, healthOf, kwh, longDate, shortDate } from "@/lib/household";
import { useDashboard, useHousehold } from "@/lib/household-context";
import { colors } from "@/theme";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 0, label: "Whole period" },
];

function Energy() {
  const { refreshing, reload } = useHousehold();
  const data = useDashboard();
  const health = healthOf(data.alerts);
  const [range, setRange] = useState(14);
  const [solar, setSolar] = useState(true);
  const [ceiling, setCeiling] = useState(true);
  const days = range ? data.home.daily.slice(-range) : data.home.daily;
  const total = days.reduce((s, d) => s + d.generated, 0);
  const best = days.length ? days.reduce((b, d) => (d.generated > b.generated ? d : b), days[0]) : null;
  const withCeiling = days.filter((d) => d.ceiling);
  const usage = withCeiling.length ? withCeiling.reduce((s, d) => s + d.generated / (d.ceiling as number), 0) / withCeiling.length : 0;
  const low = days.filter((d) => dayStatus(d) !== "normal").length;

  return (
    <Screen onRefresh={() => reload("refresh")} refreshing={refreshing}>
      <Text style={t.body}>
        What your panels made, against the most the sun allowed. {data.home.panelKwp} kWp system · inverter {data.home.inverter.serial}.
      </Text>
      <StaleNotice />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
        <View style={{ width: 8 }} />
        {RANGES.map((r) => (
          <Chip key={r.value} label={r.label} selected={range === r.value} onPress={() => setRange(r.value)} />
        ))}
        <View style={{ width: 8 }} />
      </ScrollView>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: health.tone }} />
          <Text style={t.small}>{health.text} · kWh per day</Text>
        </View>
        <EnergyChart days={days} showSolar={solar} showCeiling={ceiling} legend={false} />
        <View style={styles.toggles}>
          <Toggle label="Solar energy" colour={SERIES.solar} value={solar} onChange={setSolar} />
          <Toggle label="Sunlight ceiling" colour={SERIES.ceiling} value={ceiling} onChange={setCeiling} />
        </View>
        <Text style={t.small}>The ceiling is the day&apos;s sunlight × your panel size × 1.1. A day above it fails the sunlight check and earns nothing.</Text>
      </Card>

      <View style={styles.grid}>
        <Kpi
          style={styles.half}
          icon="zap"
          label="Solar generated"
          value={kwh(total)}
          detail={`${shortDate(days[0]?.day ?? null)} to ${longDate(days[days.length - 1]?.day ?? null)}`}
        />
        <Kpi style={styles.half} icon="calendar" label="Daily average" value={kwh(total / Math.max(1, days.length))} detail={`${days.length} days of readings`} />
        <Kpi style={styles.half} icon="award" label="Best day" value={best ? kwh(best.generated) : "n/a"} detail={best ? longDate(best.day) : ""} />
        <Kpi
          style={styles.half}
          icon="sun"
          label="Sunlight captured"
          value={`${Math.round(usage * 100)}%`}
          detail={low ? `${low} day${low === 1 ? "" : "s"} need a look` : "Every day within range"}
        />
      </View>

      <Card padded={false}>
        <ListRow icon="list" title="Daily readings" subtitle="Every day your inverter reported" onPress={() => router.push("/readings")} />
        <ListRow icon="layers" title="Monthly summary" subtitle="How each month became carbon credits" onPress={() => router.push("/monthly")} />
        <ListRow icon="hash" title="How it's calculated" subtitle="The working for any month, with its sources" onPress={() => router.push("/calculation")} last />
      </Card>
    </Screen>
  );
}

function Toggle({ label, colour, value, onChange }: { label: string; colour: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: colour, false: colors.line }} style={{ transform: [{ scale: 0.8 }] }} accessibilityLabel={label} />
      <Text style={{ fontSize: 13, color: colors.body, flexShrink: 1 }}>{label}</Text>
    </View>
  );
}

export default function EnergyTab() {
  return (
    <HouseholdGate>
      <Energy />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  toggles: { flexDirection: "row", gap: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  half: { flexBasis: "47%", flexGrow: 1 },
});
