import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { HouseholdGate } from "@/components/household";
import { RichText } from "@/components/RichText";
import { Pill, type as t } from "@/components/ui";
import { errorMessage } from "@/lib/api";
import { checkLabel, fetchMessage } from "@/lib/household";
import { useDashboard, useHousehold } from "@/lib/household-context";
import { colors } from "@/theme";

/** Why the latest period is on hold, in the family's language, with the checks that need attention. */
function Held() {
  const { lang } = useHousehold();
  const { home } = useDashboard();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const failed = home.checks.filter((c) => c.result !== "pass");

  useEffect(() => {
    let stale = false;
    fetchMessage(home.siteId, lang)
      .then((m) => !stale && setMessage(m.text))
      .catch((e) => !stale && setError(errorMessage(e, "The explanation couldn't be loaded.")));
    return () => {
      stale = true;
    };
  }, [home.siteId, lang]);

  return (
    <ScrollView contentContainerStyle={{ padding: 20, paddingTop: 28, gap: 14 }} style={{ backgroundColor: colors.white }}>
      <Text style={t.h2}>Why this period is on hold</Text>
      <View style={{ backgroundColor: colors.mint, borderRadius: 14, padding: 14 }}>
        {message ? (
          <RichText style={{ color: colors.ink, fontSize: 14.5, lineHeight: 21 }}>{message}</RichText>
        ) : error ? (
          <Text style={{ color: colors.redText, fontSize: 14 }}>{error}</Text>
        ) : (
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <ActivityIndicator size="small" color={colors.leaf} />
            <Text style={t.body}>Writing your explanation</Text>
          </View>
        )}
      </View>
      <Text style={t.h3}>Checks that need attention</Text>
      {failed.length === 0 ? (
        <Text style={t.body}>Every check on your latest period passed.</Text>
      ) : (
        failed.map((check) => (
          <View
            key={check.name}
            style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12 }}
          >
            <Text style={[t.h3, { fontSize: 14 }]}>{checkLabel(check.name)}</Text>
            <Pill tone="amber">{check.result}</Pill>
          </View>
        ))
      )}
      <Text style={t.small}>An auditor reviews every held home. Nothing is paid for this period until it is cleared.</Text>
    </ScrollView>
  );
}

export default function HeldSheet() {
  return (
    <HouseholdGate>
      <Held />
    </HouseholdGate>
  );
}
