import { router } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { fetchHomeStreet, nextStep, type Street } from "@/lib/extras";
import { shortDate, type Alert } from "@/lib/household";
import { useHousehold } from "@/lib/household-context";
import { colors, gradeTone } from "@/theme";
import { Card, ErrorState, Icon, IconBadge, Loading, Notice, type IconName, type as t } from "./ui";

/** Shows the loading or error state until the dashboard is in, then the screen. */
export function HouseholdGate({ children }: { children: ReactNode }) {
  const { data, loading, error, offline, reload } = useHousehold();
  if (data) return <>{children}</>;
  if (loading) return <Loading label="Loading your home" />;
  return <ErrorState message={error || "Your home couldn't be loaded."} offline={offline} onRetry={() => reload()} />;
}

/** A failed reload over data that's already on screen: say so, but keep the figures. */
export function StaleNotice() {
  const { data, error, reload } = useHousehold();
  if (!data || !error) return null;
  return (
    <Notice
      tone="warning"
      action={
        <Pressable onPress={() => reload("refresh")} hitSlop={8}>
          <Text style={{ color: colors.leaf, fontWeight: "700", fontSize: 13.5 }}>Try again</Text>
        </Pressable>
      }
    >
      {`${error} Showing what was last loaded.`}
    </Notice>
  );
}

export const ALERT_ICON: Record<Alert["kind"], { icon: IconName; bg: string; fg: string }> = {
  payout: { icon: "calendar", bg: "#fdf3d7", fg: "#8a5a00" },
  low_output: { icon: "alert-triangle", bg: "#fef2f2", fg: "#b91c1c" },
  no_data: { icon: "wifi-off", bg: "#fef2f2", fg: "#b91c1c" },
  held: { icon: "pause-circle", bg: "#faeeda", fg: "#633806" },
};

export function AlertItem({ alert, onDismiss }: { alert: Alert; onDismiss?: () => void }) {
  const tone = ALERT_ICON[alert.kind];
  return (
    <View style={{ flexDirection: "row", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fbfcfa" }}>
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: tone.bg, alignItems: "center", justifyContent: "center" }}>
        <Icon name={tone.icon} size={18} color={tone.fg} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
          <Text style={[t.h3, { flex: 1, fontSize: 14 }]}>{alert.title}</Text>
          {onDismiss && (
            <Pressable onPress={onDismiss} hitSlop={10} accessibilityLabel={`Dismiss ${alert.title}`}>
              <Icon name="x" size={16} color={colors.muted} />
            </Pressable>
          )}
        </View>
        <Text style={{ fontSize: 13, color: colors.body, lineHeight: 18 }}>{alert.body}</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
          {alert.kind === "held" ? (
            <Pressable onPress={() => router.push("/held")} hitSlop={8}>
              <Text style={{ color: colors.leaf, fontWeight: "600", fontSize: 12.5 }}>See why</Text>
            </Pressable>
          ) : (
            <View />
          )}
          <Text style={t.small}>{shortDate(alert.at)}</Text>
        </View>
      </View>
    </View>
  );
}

export function AlertList({ alerts, dismissable = false }: { alerts: Alert[]; dismissable?: boolean }) {
  const { dismiss } = useHousehold();
  if (alerts.length === 0)
    return (
      <View style={{ backgroundColor: colors.mint, borderRadius: 14, padding: 18 }}>
        <Text style={{ textAlign: "center", color: colors.body, fontSize: 13.5 }}>All clear. Nothing needs your attention.</Text>
      </View>
    );
  return (
    <View style={{ gap: 10 }}>
      {alerts.map((a) => (
        <AlertItem key={a.id} alert={a} onDismiss={dismissable ? () => dismiss(a.id) : undefined} />
      ))}
    </View>
  );
}

export function GradeBadge({ grade, size = 56 }: { grade: string; size?: number }) {
  const tone = gradeTone[grade] ?? gradeTone.G;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: tone.bg, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: tone.fg, fontSize: size * 0.46, fontWeight: "800" }}>{grade}</Text>
    </View>
  );
}

type StreetState = { street: Street; homeGrade: string | null; asOf: string | null } | "missing" | "loading";

/** The street's grade, from the v6 API. Hidden quietly when the server doesn't have it yet. */
export function useStreet(siteId: number): StreetState {
  const [state, setState] = useState<StreetState>("loading");
  useEffect(() => {
    let stale = false;
    fetchHomeStreet(siteId)
      .then((r) => !stale && setState({ street: r.street, homeGrade: r.home_grade, asOf: r.as_of }))
      .catch(() => !stale && setState("missing"));
    return () => {
      stale = true;
    };
  }, [siteId]);
  return state;
}

/** The family's street grade beside their own: a little friendly competition, and a reason to tell the neighbours. */
export function StreetCard({ siteId }: { siteId: number }) {
  const state = useStreet(siteId);
  if (state === "missing" || state === "loading") return null;
  const { street, homeGrade } = state;
  const ahead = homeGrade && homeGrade < street.grade;
  return (
    <Pressable onPress={() => router.push("/street")} accessibilityRole="button">
      <Card style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="map-pin" size={15} color={colors.leaf} />
            <Text style={{ fontSize: 13, fontWeight: "600", color: colors.body }}>Your street</Text>
          </View>
          <Icon name="chevron-right" size={17} color={colors.muted} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
          <GradeBadge grade={street.grade} />
          <View style={{ flex: 1 }}>
            <Text style={[t.h3, { fontSize: 16 }]}>
              {street.name} is grade {street.grade}
            </Text>
            <Text style={[t.small, { fontSize: 13, color: colors.body, marginTop: 2 }]}>
              {ahead ? `Your home is grade ${homeGrade}, ahead of your street. ` : homeGrade ? `Your home is grade ${homeGrade}. ` : ""}
              {nextStep(street)}
            </Text>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

/** A "coming soon" card for features the live server doesn't have yet. */
export function ComingSoon({ icon, title, body }: { icon: IconName; title: string; body: string }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: 30, gap: 8 }}>
      <IconBadge name={icon} size={52} />
      <View style={{ backgroundColor: "#fdf3d7", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, marginTop: 4 }}>
        <Text style={{ color: "#8a5a00", fontSize: 11.5, fontWeight: "700" }}>COMING SOON</Text>
      </View>
      <Text style={[t.h3, { textAlign: "center" }]}>{title}</Text>
      <Text style={[t.body, { textAlign: "center", maxWidth: 300 }]}>{body}</Text>
    </Card>
  );
}
