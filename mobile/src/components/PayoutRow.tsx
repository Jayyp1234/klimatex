import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { destinationLabel, formatNaira, longDate, periodLabel, tco2, type Payout } from "@/lib/household";
import { colors } from "@/theme";
import { Icon, PayoutStatus } from "./ui";

const DEST_ICON = { solar_loan: "home", bank: "briefcase", wallet: "credit-card" } as const;

/** One payout in a list. Tap for the receipt. */
export function PayoutRow({ payout: p, last = false }: { payout: Payout; last?: boolean }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/payout/[id]", params: { id: String(p.id) } })}
      style={({ pressed }) => [styles.row, !last && styles.border, pressed && { backgroundColor: colors.mint }]}
      accessibilityRole="button"
      accessibilityLabel={`${formatNaira(p.amountNaira)} for ${periodLabel(p.period)}, ${p.status}`}
    >
      <View style={styles.icon}>
        <Icon name={DEST_ICON[p.destination]} size={17} color={colors.forest} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.period}>{periodLabel(p.period)}</Text>
        <Text style={styles.sub}>
          {destinationLabel(p.destination)} · {tco2(p.tonnes)} · {longDate(p.paidOn)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end", gap: 4 }}>
        <Text style={styles.amount}>{formatNaira(p.amountNaira)}</Text>
        <PayoutStatus status={p.status} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  period: { fontSize: 14.5, fontWeight: "600", color: colors.ink },
  sub: { fontSize: 12, color: colors.muted },
  amount: { fontSize: 15.5, fontWeight: "700", color: colors.ink },
});
