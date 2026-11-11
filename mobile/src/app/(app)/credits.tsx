import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { HouseholdGate } from "@/components/household";
import { EmptyState, Icon, OfflineBanner, Pill, type as t } from "@/components/ui";
import { api, errorMessage } from "@/lib/api";
import { longDate, periodLabel, tco2, type Payout } from "@/lib/household";
import { useDashboard } from "@/lib/household-context";
import { colors } from "@/theme";

type CreditRow = { serial: string; payout: Payout; share: number };
type Verified = { serial: string; status: string; retired_for: string | null; retired_at: string | null; auditor: string | null; simulated?: boolean };
type Check = { state: "loading" } | { state: "done"; result: Verified } | { state: "error"; message: string };

/** Checks a serial against the public registry, the same lookup anyone can do from the website. */
function VerifyButton({ serial }: { serial: string }) {
  const [check, setCheck] = useState<Check | null>(null);
  const run = () => {
    setCheck({ state: "loading" });
    api<Verified>(`/api/verify/${encodeURIComponent(serial)}`)
      .then((result) => setCheck({ state: "done", result }))
      .catch((e) => setCheck({ state: "error", message: errorMessage(e, "The registry couldn't be reached. Try again.") }));
  };
  if (check?.state === "done") {
    const r = check.result;
    return (
      <View style={styles.verified}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="check-circle" size={15} color={colors.leaf} />
          <Text style={{ fontWeight: "700", color: colors.forest, fontSize: 13.5 }}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)} on the registry</Text>
        </View>
        {r.retired_for ? (
          <Text style={t.small}>
            Retired for {r.retired_for} on {longDate(r.retired_at)}
          </Text>
        ) : null}
        {r.auditor ? (
          <Text style={t.small}>
            Signed by {r.auditor}
            {r.simulated ? " · sandbox" : ""}
          </Text>
        ) : null}
      </View>
    );
  }
  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      <Pressable onPress={run} disabled={check?.state === "loading"} style={styles.verify} accessibilityRole="button">
        {check?.state === "loading" ? <ActivityIndicator size="small" color={colors.forest} /> : <Icon name="shield" size={14} color={colors.forest} />}
        <Text style={{ color: colors.forest, fontWeight: "600", fontSize: 13 }}>Verify on the registry</Text>
      </Pressable>
      {check?.state === "error" ? <Text style={{ color: colors.redText, fontSize: 12.5 }}>{check.message}</Text> : null}
    </View>
  );
}

function Credits() {
  const data = useDashboard();
  const [query, setQuery] = useState("");
  const all: CreditRow[] = data.payouts.flatMap((p) => p.serials.map((serial) => ({ serial, payout: p, share: p.serials.length ? p.tonnes / p.serials.length : 0 })));
  const rows = all.filter((r) => r.serial.toLowerCase().includes(query.trim().toLowerCase())).sort((a, b) => a.serial.localeCompare(b.serial));

  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <OfflineBanner />
      <FlatList
        data={rows}
        keyExtractor={(r) => r.serial}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Text style={t.body}>Every credit your home helped earn. Each one is a slice of all eligible homes, retired once in a buyer&apos;s name and checkable by anyone.</Text>
            <View style={styles.search}>
              <Icon name="search" size={16} color={colors.muted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Search serial"
                placeholderTextColor={colors.muted}
                autoCapitalize="characters"
                style={{ flex: 1, fontSize: 15, color: colors.ink }}
              />
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="hash" title={all.length ? "No serial matches that search." : "No credits sold from your home yet."} />}
        renderItem={({ item: r }) => (
          <View style={styles.card}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
              <Text style={[t.mono, { flex: 1 }]} selectable numberOfLines={1}>
                {r.serial}
              </Text>
              <Pill tone="grey">Retired</Pill>
            </View>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
              <Text style={t.small}>
                {periodLabel(r.payout.period)} · your share {tco2(r.share, 3)} · retired {longDate(r.payout.paidOn)}
              </Text>
            </View>
            <VerifyButton serial={r.serial} />
          </View>
        )}
      />
    </View>
  );
}

export default function CreditsScreen() {
  return (
    <HouseholdGate>
      <Credits />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    paddingHorizontal: 12,
  },
  card: { backgroundColor: colors.white, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: 14 },
  verify: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  verified: { marginTop: 10, gap: 3, backgroundColor: colors.mint, borderRadius: 10, padding: 10 },
});
