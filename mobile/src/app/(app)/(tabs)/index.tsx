import { router, useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AlertList, HouseholdGate, StaleNotice, StreetCard } from "@/components/household";
import { EnergyChart } from "@/components/EnergyChart";
import { LogoMark } from "@/components/Logo";
import { PayoutRow } from "@/components/PayoutRow";
import { Card, Icon, Kpi, Notice, Screen, SectionHeader, type as t } from "@/components/ui";
import { destinationLabel, formatNaira, healthOf, homeCode, kwh, longDate, monthLabel, monthName, overviewFigures, periodLabel, shortDate, tco2 } from "@/lib/household";
import { useDashboard, useHousehold } from "@/lib/household-context";
import { useEarnMore } from "@/lib/use-earn-more";
import { colors } from "@/theme";

function Overview() {
  const { user, alerts, refreshing, reload } = useHousehold();
  const data = useDashboard();
  const insets = useSafeAreaInsets();
  const { home, certificate } = data;
  const f = overviewFigures(data);
  const health = healthOf(data.alerts);
  const warning = alerts.find((a) => a.severity !== "info");
  const months = home.months;
  const { toImprove } = useEarnMore(data);

  // White status bar text over the green header while this tab is showing. The status bar
  // follows the native stack screen that holds the tabs, so the option is set there.
  // Once the header has scrolled away, it goes back to dark text over the light page.
  const navigation = useNavigation();
  const overHeader = useRef(true);
  const [scrolled, setScrolled] = useState(false);
  const setBar = useCallback((light: boolean) => navigation.getParent()?.setOptions({ statusBarStyle: light ? "light" : "dark" }), [navigation]);
  useFocusEffect(
    useCallback(() => {
      setBar(overHeader.current);
      return () => setBar(false);
    }, [setBar]),
  );
  const onScrollY = (y: number) => {
    const light = y < 90;
    if (light !== overHeader.current) {
      overHeader.current = light;
      setScrolled(!light);
      setBar(light);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      {scrolled && <View style={[styles.statusBackdrop, { height: insets.top }]} />}
      <Screen onRefresh={() => reload("refresh")} refreshing={refreshing} contentStyle={{ paddingTop: 0 }} fullBleedTop onScrollY={onScrollY}>
        <View style={[styles.top, { paddingTop: insets.top + 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <LogoMark size={30} />
            <View style={{ flex: 1 }}>
              <Text style={styles.hello} numberOfLines={1}>
                Welcome back, {user.name}
              </Text>
              <Text style={styles.meta} numberOfLines={2}>
                {homeCode(home.siteId)} · {home.area}, Lagos · Latest reading {longDate(data.dataAsOf)}
                {f.firstDay ? ` · audited period ${periodLabel({ start: f.firstDay, end: data.dataAsOf ?? f.firstDay })}` : ""}
              </Text>
            </View>
            <Pressable onPress={() => router.push("/notifications")} hitSlop={10} accessibilityLabel={`Notifications, ${alerts.length}`}>
              <Icon name="bell" size={22} color={colors.white} />
              {alerts.length > 0 && <View style={styles.dot} />}
            </Pressable>
          </View>
        </View>
        {/* Grade hero, overlapping the green header. */}
        <View style={styles.hero}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
            <View style={styles.sun}>
              <Icon name="sun" size={22} color={colors.sun} />
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              {!certificate ? (
                <>
                  <Text style={styles.heroTitle}>Keep your home running on clean energy</Text>
                  <Text style={styles.heroBody}>Your grade, savings and payouts appear after your first audited period.</Text>
                </>
              ) : f.canImprove ? (
                <>
                  <Text style={styles.heroTitle}>
                    Your home is grade {certificate.grade_now}. Grade {f.potential} is within reach.
                  </Text>
                  <Text style={styles.heroBody}>Next step: {f.step}. Less generator time earns you more from every payout.</Text>
                </>
              ) : (
                <>
                  <Text style={styles.heroTitle}>Your home is grade {certificate.grade_now}, the top grade.</Text>
                  <Text style={styles.heroBody}>Almost all your power is clean. Keep the generator off and every month keeps earning.</Text>
                </>
              )}
            </View>
          </View>
          <Pressable onPress={() => router.push("/certificate")} style={({ pressed }) => [styles.heroButton, pressed && { opacity: 0.85 }]} accessibilityRole="button">
            <Text
              style={{
                color: colors.forest,
                fontWeight: "700",
                fontSize: 14.5,
              }}
            >
              {f.canImprove ? "Improve my grade" : "View my certificate"}
            </Text>
          </Pressable>
        </View>

        <StaleNotice />

        {warning && (
          <Notice
            tone="warning"
            action={
              warning.kind === "held" ? (
                <Pressable onPress={() => router.push("/held")} hitSlop={8}>
                  <Text
                    style={{
                      fontWeight: "700",
                      color: colors.amberText,
                      textDecorationLine: "underline",
                    }}
                  >
                    See why
                  </Text>
                </Pressable>
              ) : undefined
            }
          >
            <Text
              style={{
                color: colors.amberText,
                fontSize: 13.5,
                lineHeight: 19,
              }}
            >
              <Text style={{ fontWeight: "700" }}>{warning.title}.</Text> {warning.body}
            </Text>
          </Notice>
        )}

        <View style={styles.grid}>
          {f.latest && (
            <Kpi
              style={styles.half}
              icon="mci:gas-station-outline"
              label="Saved on petrol"
              value={`≈ ${formatNaira(Math.round(f.savedMonth))}`}
              trend={months.map((m) => m.litres)}
              detail={`${Math.round(f.litresMonth)} L in ${monthName(f.latest.month)} · ≈ ${formatNaira(Math.round(f.savedAll))} since you switched`}
            />
          )}
          <Kpi
            style={styles.half}
            icon="credit-card"
            label="Paid to you"
            value={formatNaira(data.paidNaira)}
            detail={f.lastPaid ? `Last paid ${shortDate(f.lastPaid.paidOn)} · ${destinationLabel(f.lastPaid.destination)}` : "First payment after your first audit"}
          />
          <Kpi
            style={styles.half}
            icon="calendar"
            label="Next payment"
            value={f.nextEstimate > 0 ? `≈ ${formatNaira(Math.round(f.nextEstimate))}` : "After next audit"}
            detail={f.nextAudit ? `${f.nextEstimate > 0 ? "Similar to last time · " : ""}after the ${longDate(f.nextAudit)} audit` : "Paid automatically"}
          />
          {f.latest && (
            <Kpi
              style={styles.half}
              icon="zap"
              label="Clean energy"
              value={kwh(f.latest.solarKwh)}
              trend={months.map((m) => m.solarKwh)}
              detail={`${monthLabel(f.latest.month)} · ${tco2(f.latest.tonnes)} avoided`}
            />
          )}
        </View>

        <Pressable onPress={() => router.push("/message")} accessibilityRole="button">
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={styles.msgIcon}>
              <Icon name="message-square" size={18} color={colors.lime} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={t.h3}>This month&apos;s message</Text>
              <Text style={t.small}>Your grade, petrol saved and next payout, in your language.</Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.muted} />
          </Card>
        </Pressable>

        <Pressable onPress={() => router.push("/earn-more")} accessibilityRole="button">
          <Card style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
            <View style={[styles.msgIcon, { backgroundColor: toImprove ? "#fdf3d7" : colors.mint }]}>
              <Icon name="trending-up" size={18} color={toImprove ? "#8a5a00" : colors.forest} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={t.h3}>Earn more from your solar</Text>
              <Text style={t.small}>
                {toImprove
                  ? `${toImprove} thing${toImprove === 1 ? "" : "s"} could earn you more. See what to do.`
                  : "Your home is earning all it can. See what you're doing well."}
              </Text>
            </View>
            <Icon name="chevron-right" size={18} color={colors.muted} />
          </Card>
        </Pressable>

        <StreetCard siteId={home.siteId} />

        <SectionHeader
          title="Your energy, last 14 days"
          actionLabel="Energy"
          onAction={() => router.push("/energy")}
          description={
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 4,
                  backgroundColor: health.tone,
                }}
              />
              <Text style={t.small}>{health.text} · kWh per day</Text>
            </View>
          }
        />
        <Card>
          <EnergyChart days={home.daily.slice(-14)} />
        </Card>

        <SectionHeader title="Recent payouts" actionLabel="View all" onAction={() => router.push("/payouts")} />
        <Card padded={false}>
          {data.payouts.length === 0 ? (
            <Text style={[t.body, { padding: 18, textAlign: "center" }]}>No payouts yet. Your first one follows the next audit and sale.</Text>
          ) : (
            data.payouts.slice(0, 5).map((p, i, all) => <PayoutRow key={p.id} payout={p} last={i === all.length - 1} />)
          )}
        </Card>

        <SectionHeader title="Notifications" actionLabel="View all" onAction={() => router.push("/notifications")} />
        <AlertList alerts={alerts.slice(0, 3)} dismissable />
      </Screen>
    </View>
  );
}

export default function HomeTab() {
  return (
    <HouseholdGate>
      <Overview />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  statusBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.page,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  top: {
    backgroundColor: colors.forest,
    paddingHorizontal: 16,
    paddingBottom: 58,
    marginHorizontal: -16,
  },
  hello: {
    color: colors.white,
    fontSize: 19,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  meta: { color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 2 },
  dot: {
    position: "absolute",
    top: -2,
    right: -3,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.lime,
    borderWidth: 1.5,
    borderColor: colors.forest,
  },
  hero: {
    marginTop: -46,
    backgroundColor: colors.leaf,
    borderRadius: 22,
    padding: 16,
    gap: 14,
    shadowColor: colors.forest,
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
  },
  sun: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    color: colors.white,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: -0.2,
    lineHeight: 22,
  },
  heroBody: { color: "rgba(255,255,255,0.78)", fontSize: 13.5, lineHeight: 19 },
  heroButton: {
    backgroundColor: colors.white,
    borderRadius: 12,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  half: { flexBasis: "47%", flexGrow: 1 },
  msgIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.forest,
    alignItems: "center",
    justifyContent: "center",
  },
});
