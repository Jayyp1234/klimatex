import { router } from "expo-router";
import { Text, View } from "react-native";
import { HouseholdGate } from "@/components/household";
import { Button, Card, DetailRow, EmptyState, Kpi, Screen, type as t } from "@/components/ui";
import { formatNumber, kwh, monthLabel, tco2 } from "@/lib/household";
import { useDashboard } from "@/lib/household-context";
import { colors } from "@/theme";

function Monthly() {
  const data = useDashboard();
  const months = data.home.months;
  const totals = months.reduce((s, m) => ({ solar: s.solar + m.solarKwh, litres: s.litres + m.litres, tonnes: s.tonnes + m.tonnes }), { solar: 0, litres: 0, tonnes: 0 });
  return (
    <Screen>
      <Text style={t.body}>How each month&apos;s solar became carbon credits, using Gold Standard&apos;s generator method.</Text>
      <Kpi icon="zap" label="Solar credited" value={kwh(totals.solar)} detail={`${months.length} months audited`} />
      <View style={{ flexDirection: "row", gap: 12 }}>
        <Kpi
          style={{ flex: 1 }}
          icon="mci:gas-station-outline"
          label="Petrol avoided"
          value={`${formatNumber(Math.round(totals.litres))} L`}
          detail="Generator share × 0.7 L per kWh"
        />
        <Kpi
          style={{ flex: 1 }}
          icon="feather"
          label="Credited"
          value={tco2(totals.tonnes)}
          detail={data.home.status === "eligible" ? "Eligible for sale" : `Status: ${data.home.status ?? "not computed"}`}
        />
      </View>
      {months.length === 0 ? (
        <EmptyState icon="layers" title="No audited months yet" body="Your monthly summary appears after your first audited period." />
      ) : (
        months.map((m) => (
          <Card key={m.month} style={{ paddingVertical: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", paddingTop: 8, paddingBottom: 4 }}>
              <Text style={t.h3}>{monthLabel(m.month)}</Text>
              <Text style={{ fontWeight: "700", color: colors.forest, fontSize: 15 }}>{tco2(m.tonnes, 3)}</Text>
            </View>
            <DetailRow label="Solar" value={kwh(m.solarKwh)} />
            <DetailRow label="Fuel cap" value={kwh(m.capKwh)} />
            <DetailRow label="Petrol" value={`${Math.round(m.litres)} L`} />
            <DetailRow label="Baseline" value={tco2(m.baselineT, 3)} />
            <DetailRow label="Project" value={tco2(m.projectT, 3)} />
            <DetailRow label="Leakage" value={tco2(m.leakageT, 3)} />
          </Card>
        ))
      )}
      <Card style={{ gap: 6 }}>
        <Text style={t.h3}>How a month is credited</Text>
        <Text style={t.body}>
          <Text style={{ fontWeight: "700", color: colors.ink }}>Credited = Baseline − Project emissions − Leakage.</Text> The baseline is the solar your home used, capped at what
          the old generator could have made, at a mix of generator and grid emission factors. Project emissions cover any backup generator use. Leakage applies when solar falls
          short of the home&apos;s usual need. Days that fail a check earn nothing.
        </Text>
        <Button title="See the working for a month" icon="hash" variant="secondary" onPress={() => router.push("/calculation")} />
      </Card>
    </Screen>
  );
}

export default function MonthlyScreen() {
  return (
    <HouseholdGate>
      <Monthly />
    </HouseholdGate>
  );
}
