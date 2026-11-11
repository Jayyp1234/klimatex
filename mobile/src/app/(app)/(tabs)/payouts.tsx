import { router } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { HouseholdGate, StaleNotice } from "@/components/household";
import { PayoutRow } from "@/components/PayoutRow";
import { Card, Chip, EmptyState, Kpi, ListRow, Screen, SectionHeader } from "@/components/ui";
import { formatNaira, tco2 } from "@/lib/household";
import { useDashboard, useHousehold } from "@/lib/household-context";

const DESTINATIONS = [
  { value: "all", label: "All" },
  { value: "solar_loan", label: "Solar loan" },
  { value: "wallet", label: "Access wallet" },
  { value: "bank", label: "Bank account" },
];

function Payouts() {
  const { refreshing, reload } = useHousehold();
  const data = useDashboard();
  const [dest, setDest] = useState("all");
  const rows = [...data.payouts].sort((a, b) => (b.paidOn ?? "").localeCompare(a.paidOn ?? "")).filter((p) => dest === "all" || p.destination === dest);
  const toLoan = data.payouts.filter((p) => p.destination === "solar_loan").reduce((s, p) => s + p.amountNaira, 0);
  const serials = data.payouts.reduce((s, p) => s + p.serials.length, 0);

  return (
    <Screen onRefresh={() => reload("refresh")} refreshing={refreshing}>
      <StaleNotice />
      <View style={styles.grid}>
        <Kpi
          style={styles.half}
          icon="credit-card"
          label="Total paid"
          value={formatNaira(data.paidNaira)}
          detail={`${data.payouts.length} payout${data.payouts.length === 1 ? "" : "s"} · your 50% share`}
        />
        <Kpi style={styles.half} icon="home" label="Into your solar loan" value={formatNaira(toLoan)} />
        <Kpi style={styles.half} icon="briefcase" label="Into wallet or bank" value={formatNaira(data.paidNaira - toLoan)} />
        <Kpi style={styles.half} icon="feather" label="Carbon paid for" value={tco2(data.payouts.reduce((s, p) => s + p.tonnes, 0))} />
      </View>

      <Card padded={false}>
        <ListRow
          icon="hash"
          title="Credits & serials"
          subtitle={`${serials} credit${serials === 1 ? "" : "s"} sold from your home, each checkable by anyone`}
          onPress={() => router.push("/credits")}
          last
        />
      </Card>

      <SectionHeader title="Payout history" description="Your 50% share of every credit sold, paid after each audit." />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
        <View style={{ width: 8 }} />
        {DESTINATIONS.map((d) => (
          <Chip key={d.value} label={d.label} selected={dest === d.value} onPress={() => setDest(d.value)} />
        ))}
        <View style={{ width: 8 }} />
      </ScrollView>
      {rows.length === 0 ? (
        <EmptyState icon="credit-card" title={data.payouts.length ? "No payouts to this destination" : "No payouts yet"} body="Your first one follows the next audit and sale." />
      ) : (
        <Card padded={false}>
          {rows.map((p, i) => (
            <PayoutRow key={p.id} payout={p} last={i === rows.length - 1} />
          ))}
        </Card>
      )}
    </Screen>
  );
}

export default function PayoutsTab() {
  return (
    <HouseholdGate>
      <Payouts />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  half: { flexBasis: "47%", flexGrow: 1 },
});
