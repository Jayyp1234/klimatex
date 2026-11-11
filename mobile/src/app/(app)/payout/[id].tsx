import { router, useLocalSearchParams } from "expo-router";
import { ScrollView, Text, View } from "react-native";
import { HouseholdGate } from "@/components/household";
import { Button, DetailRow, EmptyState, PayoutStatus, type as t } from "@/components/ui";
import { destinationLabel, formatNaira, longDate, periodLabel, tco2 } from "@/lib/household";
import { useDashboard } from "@/lib/household-context";
import { colors } from "@/theme";

function Receipt() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useDashboard();
  const payout = data.payouts.find((p) => String(p.id) === id);
  if (!payout) return <EmptyState icon="credit-card" title="This payout isn't on your home." />;
  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 4 }} style={{ backgroundColor: colors.white }}>
      <Text style={[t.label, { marginBottom: 4 }]}>Payout details</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 34, fontWeight: "700", color: colors.forest, letterSpacing: -0.8 }}>{formatNaira(payout.amountNaira)}</Text>
        <PayoutStatus status={payout.status} />
      </View>
      <View style={{ marginTop: 10 }}>
        <DetailRow first label="Paid into" value={destinationLabel(payout.destination)} />
        <DetailRow label="Paid on" value={longDate(payout.paidOn)} />
        <DetailRow label="Audit period" value={periodLabel(payout.period)} />
        <DetailRow label="Your share of the credits" value={tco2(payout.tonnes)} />
        <DetailRow label="Credits sold" value={payout.serials.length} />
        <DetailRow label="Reference" value={payout.reference} mono />
      </View>
      <Text style={[t.small, { marginTop: 8 }]}>Each credit sold carries a slice of your home&apos;s savings. See them all under Payouts › Credits &amp; serials.</Text>
      {payout.serials.length > 0 && (
        <Button
          title="See the credit serials"
          variant="secondary"
          icon="hash"
          onPress={() => {
            router.back();
            router.push("/credits");
          }}
          style={{ marginTop: 14 }}
        />
      )}
    </ScrollView>
  );
}

export default function PayoutSheet() {
  return (
    <HouseholdGate>
      <Receipt />
    </HouseholdGate>
  );
}
