import { useMemo, useState } from "react";
import { FlatList, ScrollView, StyleSheet, Text, View } from "react-native";
import { HouseholdGate } from "@/components/household";
import { Chip, EmptyState, OfflineBanner, Pill, type as t } from "@/components/ui";
import { dayStatus, kwh, longDate, monthLabel, type Day } from "@/lib/household";
import { useDashboard } from "@/lib/household-context";
import { colors } from "@/theme";

const STATUSES = [
  { value: "all", label: "All statuses" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low output" },
  { value: "above", label: "Above ceiling" },
];

function DayPill({ day }: { day: Day }) {
  const s = dayStatus(day);
  if (s === "above") return <Pill tone="red">Above ceiling</Pill>;
  if (s === "low") return <Pill tone="amber">Low output</Pill>;
  return <Pill tone="green">Normal</Pill>;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ minWidth: "30%", flexGrow: 1 }}>
      <Text style={{ fontSize: 11, color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 13.5, color: colors.ink, fontWeight: "600" }}>{value}</Text>
    </View>
  );
}

function Readings() {
  const data = useDashboard();
  const months = useMemo(() => [...new Set(data.home.daily.map((d) => d.day.slice(0, 7)))], [data.home.daily]);
  const [month, setMonth] = useState("all");
  const [status, setStatus] = useState("all");
  const rows = data.home.daily.filter((d) => (month === "all" || d.day.startsWith(month)) && (status === "all" || dayStatus(d) === status)).reverse();

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <OfflineBanner />
      <FlatList
        data={rows}
        keyExtractor={(d) => d.day}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        initialNumToRender={15}
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Text style={t.body}>
              Every day your inverter ({data.home.inverter.serial}) reported. Latest reading {longDate(data.dataAsOf)}.
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
              <Chip label="All months" selected={month === "all"} onPress={() => setMonth("all")} />
              {months.map((m) => (
                <Chip key={m} label={monthLabel(m)} selected={month === m} onPress={() => setMonth(m)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ marginHorizontal: -16 }}>
              {STATUSES.map((s) => (
                <Chip key={s.value} label={s.label} selected={status === s.value} onPress={() => setStatus(s.value)} />
              ))}
            </ScrollView>
            <Text style={t.small}>
              {rows.length} day{rows.length === 1 ? "" : "s"}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="search" title="No readings match these filters." />}
        renderItem={({ item: d }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={t.h3}>{longDate(d.day)}</Text>
              <DayPill day={d} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
              <Figure label="Generated" value={kwh(d.generated)} />
              <Figure label="To your home" value={kwh(d.toLoad)} />
              <Figure label="Grid" value={kwh(d.grid)} />
              <Figure label="Backup generator" value={kwh(d.backup)} />
              <Figure label="Sunlight ceiling" value={d.ceiling === null ? "n/a" : kwh(d.ceiling)} />
              <Figure label="Of ceiling" value={d.ceiling ? `${Math.round((d.generated / d.ceiling) * 100)}%` : "n/a"} />
            </View>
          </View>
        )}
      />
    </View>
  );
}

export default function ReadingsScreen() {
  return (
    <HouseholdGate>
      <Readings />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: 14 },
});
