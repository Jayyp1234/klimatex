import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { AlertItem, HouseholdGate, StaleNotice } from "@/components/household";
import { Chip, EmptyState, Screen, type as t } from "@/components/ui";
import { longDate, type Alert } from "@/lib/household";
import { useHousehold } from "@/lib/household-context";
import { colors } from "@/theme";

const FILTERS: { value: "all" | Alert["kind"]; label: string }[] = [
  { value: "all", label: "All" },
  { value: "payout", label: "Payments" },
  { value: "held", label: "On hold" },
  { value: "low_output", label: "Low output" },
  { value: "no_data", label: "No data" },
];

function Notifications() {
  const { alerts, data, dismiss, dismissedCount, restoreAlerts, reload, refreshing } = useHousehold();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("all");
  const shown = alerts.filter((a) => filter === "all" || a.kind === filter);

  return (
    <Screen onRefresh={() => reload("refresh")} refreshing={refreshing}>
      <Text style={t.body}>Payments, held periods and anything wrong with your system. Latest reading {longDate(data?.dataAsOf ?? null)}.</Text>
      <StaleNotice />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} style={{ marginHorizontal: -16 }}>
        <View style={{ width: 8 }} />
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
        ))}
        <View style={{ width: 8 }} />
      </ScrollView>
      {shown.length === 0 ? (
        <EmptyState icon="bell" title="All clear" body={filter === "all" ? "Nothing needs your attention." : "Nothing of this kind right now."} />
      ) : (
        <View style={{ gap: 10 }}>
          {shown.map((a) => (
            <AlertItem key={a.id} alert={a} onDismiss={() => dismiss(a.id)} />
          ))}
        </View>
      )}
      {dismissedCount > 0 && (
        <Pressable onPress={restoreAlerts} hitSlop={8} style={{ alignSelf: "center", marginTop: 4 }}>
          <Text style={{ color: colors.leaf, fontWeight: "600" }}>
            Show {dismissedCount} dismissed notification{dismissedCount === 1 ? "" : "s"}
          </Text>
        </Pressable>
      )}
    </Screen>
  );
}

export default function NotificationsScreen() {
  return (
    <HouseholdGate>
      <Notifications />
    </HouseholdGate>
  );
}
