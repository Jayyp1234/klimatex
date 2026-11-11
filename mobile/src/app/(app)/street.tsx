import { Text, View } from "react-native";
import { ComingSoon, GradeBadge, HouseholdGate, useStreet } from "@/components/household";
import { Card, DetailRow, Loading, Screen, type as t } from "@/components/ui";
import { nextStep } from "@/lib/extras";
import { longDate } from "@/lib/household";
import { useDashboard } from "@/lib/household-context";
import { colors } from "@/theme";

function StreetView() {
  const { home } = useDashboard();
  const state = useStreet(home.siteId);
  if (state === "loading") return <Loading label="Loading your street" />;
  if (state === "missing")
    return (
      <Screen>
        <ComingSoon icon="map-pin" title="Street grades are coming soon" body="See how your street compares, and how many more solar homes would lift its grade." />
      </Screen>
    );
  const { street: s, homeGrade, asOf } = state;
  const share = s.homes_total ? s.homes_on_klimatex / s.homes_total : 0;
  return (
    <Screen>
      <Card style={{ alignItems: "center", gap: 10, paddingVertical: 24 }}>
        <GradeBadge grade={s.grade} size={84} />
        <Text style={[t.h2, { textAlign: "center" }]}>
          {s.name} is grade {s.grade}
        </Text>
        <Text style={[t.body, { textAlign: "center" }]}>
          {homeGrade && homeGrade < s.grade ? `Your home is grade ${homeGrade}, ahead of your street. ` : homeGrade ? `Your home is grade ${homeGrade}. ` : ""}
          {nextStep(s)}
        </Text>
      </Card>
      <Card style={{ gap: 8 }}>
        <Text style={t.h3}>Homes on KlimateX</Text>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: "#eef3ec", overflow: "hidden" }}>
          <View style={{ height: "100%", width: `${share * 100}%`, backgroundColor: colors.leaf }} />
        </View>
        <Text style={t.small}>
          {s.homes_on_klimatex} of {s.homes_total} homes · {s.homes_verified} verified
        </Text>
      </Card>
      <Card style={{ paddingVertical: 4 }}>
        <DetailRow first label="Area" value={s.area} />
        <DetailRow label="Generator share" value={`${Math.round(s.generator_share * 100)}%`} />
        {s.next_grade && <DetailRow label="Next grade" value={`${s.next_grade}, with ${s.homes_needed_for_next ?? "more"} more homes`} />}
        <DetailRow label="As of" value={longDate(asOf)} />
      </Card>
      <Text style={[t.small, { textAlign: "center" }]}>Street grades use the same A to G bands as your home certificate. Tell your neighbours.</Text>
    </Screen>
  );
}

export default function StreetScreen() {
  return (
    <HouseholdGate>
      <StreetView />
    </HouseholdGate>
  );
}
