import { useEffect, useState } from "react";
import { Pressable, Switch, Text, View } from "react-native";
import { Button, Card, DetailRow, Icon, Notice, Screen, SectionHeader, type as t } from "@/components/ui";
import { api, API_BASE, getSession, refreshStats, spoilAccessToken } from "@/lib/api";
import { LANGUAGES } from "@/lib/household";
import { useHousehold } from "@/lib/household-context";
import { readPref, writePref } from "@/lib/prefs";
import { colors } from "@/theme";

/** Developer-only check that an expired access token is refreshed once, even when several calls fail together. */
function RefreshCheck() {
  const { data, reload } = useHousehold();
  const [report, setReport] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async () => {
    if (!data) return;
    setBusy(true);
    const before = refreshStats.sent;
    const oldRefresh = getSession()?.refresh_token;
    spoilAccessToken();
    // Four calls at once with the spoiled token: all get 401 together and must share one refresh.
    const id = data.home.siteId;
    const calls = ["/api/homes/mine", `/api/homes/${id}/payouts`, `/api/homes/${id}/alerts`, `/api/homes/${id}/certificate`];
    const results = await Promise.allSettled(calls.map((path) => api(path)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const after = getSession();
    setReport(
      `${calls.length} calls at once · ${ok} succeeded · ${refreshStats.sent - before} refresh call sent · refresh token ${after && after.refresh_token !== oldRefresh ? "rotated" : "unchanged"} · ${after ? "still signed in" : "session ended"}`,
    );
    if (after) await reload("quiet");
    setBusy(false);
  };
  return (
    <Card style={{ gap: 10 }}>
      <Text style={t.small}>Server: {API_BASE}</Text>
      <Text style={t.body}>Spoil the access token, then make four calls at once. They all get 401 and should share a single refresh.</Text>
      <Button title="Test token refresh" icon="refresh-cw" variant="secondary" busy={busy} onPress={run} />
      {report ? <Notice tone="success">{report}</Notice> : null}
    </Card>
  );
}

export default function Preferences() {
  const { lang, setLang, dismissedCount, restoreAlerts } = useHousehold();
  const [speak, setSpeak] = useState(false);

  useEffect(() => {
    readPref("speak").then((v) => setSpeak(v === "1"));
  }, []);

  return (
    <Screen>
      <SectionHeader title="Language" description="Your monthly message, assistant answers and held-period explanations are written in this language." />
      <Card padded={false}>
        {LANGUAGES.map((l, i) => (
          <Pressable
            key={l.code}
            onPress={() => setLang(l.code)}
            accessibilityRole="radio"
            accessibilityState={{ selected: lang === l.code }}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: i < LANGUAGES.length - 1 ? 0.5 : 0,
              borderBottomColor: colors.line,
              backgroundColor: pressed ? colors.mint : "transparent",
            })}
          >
            <Text style={{ flex: 1, fontSize: 15.5, color: colors.ink, fontWeight: lang === l.code ? "700" : "400" }}>{l.label}</Text>
            {lang === l.code && <Icon name="check" size={18} color={colors.leaf} />}
          </Pressable>
        ))}
      </Card>

      <SectionHeader title="Ask KlimateX" />
      <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={t.h3}>Read answers aloud</Text>
          <Text style={t.small}>Hear each answer as it arrives, in your language where the phone has a voice for it.</Text>
        </View>
        <Switch
          value={speak}
          onValueChange={(v) => {
            setSpeak(v);
            writePref("speak", v ? "1" : "0");
          }}
          trackColor={{ true: colors.leaf, false: colors.line }}
        />
      </Card>

      <SectionHeader title="Notifications" />
      <Card style={{ paddingVertical: 4 }}>
        <DetailRow first label="Dismissed on this phone" value={String(dismissedCount)} />
      </Card>
      {dismissedCount > 0 && <Button title="Show dismissed notifications again" variant="secondary" icon="bell" onPress={restoreAlerts} />}

      {__DEV__ && (
        <>
          <SectionHeader title="Developer" description="Only in development builds." />
          <RefreshCheck />
        </>
      )}
    </Screen>
  );
}
