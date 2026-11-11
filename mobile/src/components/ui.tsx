import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { useOnline } from "@/lib/network";
import { colors, radius } from "@/theme";

/* ───────────── Icons ─────────────
 * Feather is closest to the lucide icons on the web. A few (petrol pump) come from Material Community.
 */

export type FeatherName = ComponentProps<typeof Feather>["name"];
export type IconName = FeatherName | `mci:${ComponentProps<typeof MaterialCommunityIcons>["name"]}`;

export function Icon({ name, size = 18, color = colors.forest }: { name: IconName; size?: number; color?: string }) {
  if (name.startsWith("mci:")) return <MaterialCommunityIcons name={name.slice(4) as ComponentProps<typeof MaterialCommunityIcons>["name"]} size={size} color={color} />;
  return <Feather name={name as FeatherName} size={size} color={color} />;
}

/* ───────────── Text ───────────── */

export const type = StyleSheet.create({
  h1: { fontSize: 26, fontWeight: "700", color: colors.ink, letterSpacing: -0.6 },
  h2: { fontSize: 18, fontWeight: "700", color: colors.ink, letterSpacing: -0.3 },
  h3: { fontSize: 15, fontWeight: "600", color: colors.ink },
  body: { fontSize: 14.5, color: colors.body, lineHeight: 21 },
  small: { fontSize: 12.5, color: colors.muted, lineHeight: 17 },
  label: { fontSize: 12, fontWeight: "600", color: colors.muted, letterSpacing: 0.6, textTransform: "uppercase" },
  mono: { fontFamily: "Menlo", fontSize: 12.5, color: colors.ink },
});

/* ───────────── Layout ───────────── */

/** A scrolling screen with pull-to-refresh and an offline notice. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  contentStyle,
  fullBleedTop = false,
  onScrollY,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** For screens without a navigation header that draw their own coloured header under the status bar. */
  fullBleedTop?: boolean;
  onScrollY?: (y: number) => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.page }}>
      <OfflineBanner />
      <ScrollView
        contentContainerStyle={[{ padding: 16, paddingBottom: 40, gap: 14 }, contentStyle]}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.leaf} /> : undefined}
        keyboardShouldPersistTaps="handled"
        onScroll={onScrollY ? (e) => onScrollY(e.nativeEvent.contentOffset.y) : undefined}
        scrollEventThrottle={onScrollY ? 64 : undefined}
        contentInsetAdjustmentBehavior={fullBleedTop ? "never" : "automatic"}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <View style={styles.offline} accessibilityRole="alert">
      <Icon name="wifi-off" size={15} color={colors.amberText} />
      <Text style={{ color: colors.amberText, fontSize: 13, flex: 1 }}>You&apos;re offline. Showing what was last loaded.</Text>
    </View>
  );
}

export function Card({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  return <View style={[styles.card, padded && { padding: 16 }, style]}>{children}</View>;
}

export function SectionHeader({ title, actionLabel, onAction, description }: { title: string; actionLabel?: string; onAction?: () => void; description?: ReactNode }) {
  return (
    <View style={{ marginTop: 6, gap: 2 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={type.h2}>{title}</Text>
        {actionLabel && onAction && (
          <Pressable onPress={onAction} hitSlop={10} accessibilityRole="link">
            <Text style={{ color: colors.leaf, fontWeight: "600", fontSize: 14 }}>{actionLabel}</Text>
          </Pressable>
        )}
      </View>
      {description ? typeof description === "string" ? <Text style={type.small}>{description}</Text> : description : null}
    </View>
  );
}

export function IconBadge({ name, bg = colors.mint, color = colors.forest, size = 40 }: { name: IconName; bg?: string; color?: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.3, backgroundColor: bg, alignItems: "center", justifyContent: "center" }}>
      <Icon name={name} size={size * 0.46} color={color} />
    </View>
  );
}

/* ───────────── Figures ───────────── */

export function Sparkline({ values, width = 84, height = 30, color = colors.leaf }: { values: number[]; width?: number; height?: number; color?: string }) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * (width - 4) + 2},${height - 2 - ((v - min) / span) * (height - 4)}`).join(" ");
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

export function Kpi({
  icon,
  label,
  value,
  detail,
  trend,
  style,
}: {
  icon: IconName;
  label: string;
  value: string;
  detail?: ReactNode;
  trend?: number[];
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Card style={[{ gap: 6 }, style]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <IconBadge name={icon} size={30} />
        <Text style={{ fontSize: 13, fontWeight: "600", color: colors.body, flex: 1 }} numberOfLines={2}>
          {label}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 6 }}>
        <Text style={{ fontSize: 22, fontWeight: "700", color: colors.ink, letterSpacing: -0.5, flex: 1 }} adjustsFontSizeToFit numberOfLines={1}>
          {value}
        </Text>
        {trend && <Sparkline values={trend} width={48} height={24} />}
      </View>
      {detail ? <Text style={type.small}>{detail}</Text> : null}
    </Card>
  );
}

const PILL_TONES = {
  green: { bg: "#e4f3d5", fg: "#27500a" },
  amber: { bg: "#faeeda", fg: "#633806" },
  red: { bg: "#fde8e8", fg: "#9b1c1c" },
  grey: { bg: "#eef1ed", fg: colors.body },
};

export function Pill({ tone, children, icon }: { tone: keyof typeof PILL_TONES; children: ReactNode; icon?: IconName }) {
  const t = PILL_TONES[tone];
  return (
    <View
      style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: t.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" }}
    >
      {icon && <Icon name={icon} size={11} color={t.fg} />}
      <Text style={{ color: t.fg, fontSize: 11.5, fontWeight: "600" }}>{children}</Text>
    </View>
  );
}

export function PayoutStatus({ status }: { status: string }) {
  if (status === "paid")
    return (
      <Pill tone="green" icon="check-circle">
        Paid
      </Pill>
    );
  if (status === "failed") return <Pill tone="red">Retrying</Pill>;
  return <Pill tone="amber">Processing</Pill>;
}

/* ───────────── Controls ───────────── */

export function Button({
  title,
  onPress,
  variant = "primary",
  busy = false,
  disabled = false,
  icon,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "light";
  busy?: boolean;
  disabled?: boolean;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    primary: { bg: colors.forest, fg: colors.white, border: colors.forest },
    secondary: { bg: colors.white, fg: colors.forest, border: colors.line },
    light: { bg: colors.white, fg: colors.forest, border: colors.white },
  }[variant];
  const off = disabled || busy;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off, busy }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: off ? 0.55 : pressed ? 0.85 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] },
        style,
      ]}
    >
      {busy ? <ActivityIndicator color={palette.fg} size="small" /> : icon ? <Icon name={icon} size={17} color={palette.fg} /> : null}
      <Text style={{ color: palette.fg, fontSize: 15.5, fontWeight: "600" }}>{title}</Text>
    </Pressable>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={[styles.chip, selected ? { backgroundColor: colors.forest, borderColor: colors.forest } : { backgroundColor: colors.white, borderColor: colors.line }]}
    >
      <Text style={{ color: selected ? colors.white : colors.ink, fontSize: 13.5, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

/** A tappable row, as in iOS settings lists. */
export function ListRow({
  icon,
  iconBg,
  iconColor,
  title,
  subtitle,
  right,
  onPress,
  last = false,
  titleStyle,
}: {
  icon?: IconName;
  iconBg?: string;
  iconColor?: string;
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  titleStyle?: StyleProp<TextStyle>;
}) {
  const content = (
    <View style={[styles.row, !last && styles.rowBorder]}>
      {icon && <IconBadge name={icon} size={36} bg={iconBg} color={iconColor} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={[type.h3, titleStyle]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? typeof subtitle === "string" ? <Text style={[type.small, { marginTop: 1 }]}>{subtitle}</Text> : subtitle : null}
      </View>
      {right}
      {onPress && <Icon name="chevron-right" size={18} color={colors.muted} />}
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ backgroundColor: pressed ? colors.mint : "transparent" })}>
      {content}
    </Pressable>
  );
}

/** A label and value on one line, for receipts and details. */
export function DetailRow({ label, value, mono = false, first = false }: { label: string; value: ReactNode; mono?: boolean; first?: boolean }) {
  return (
    <View
      style={[
        { flexDirection: "row", justifyContent: "space-between", gap: 16, paddingVertical: 10 },
        !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
      ]}
    >
      <Text style={{ color: colors.muted, fontSize: 14 }}>{label}</Text>
      {typeof value === "string" || typeof value === "number" ? (
        <Text style={[{ color: colors.ink, fontSize: 14, fontWeight: "600", textAlign: "right", flexShrink: 1 }, mono && type.mono]} selectable>
          {value}
        </Text>
      ) : (
        value
      )}
    </View>
  );
}

/* ───────────── States ───────────── */

export function Notice({
  tone = "warning",
  icon,
  children,
  action,
}: {
  tone?: "warning" | "error" | "info" | "success";
  icon?: IconName;
  children: ReactNode;
  action?: ReactNode;
}) {
  const t = {
    warning: { bg: colors.amberBg, border: "#f1d9a6", fg: colors.amberText, icon: "alert-triangle" as IconName },
    error: { bg: colors.redBg, border: "#fecaca", fg: colors.redText, icon: "alert-triangle" as IconName },
    info: { bg: colors.mint, border: colors.mintStrong, fg: colors.body, icon: "info" as IconName },
    success: { bg: colors.mint, border: "#cfe5d2", fg: colors.forest, icon: "check-circle" as IconName },
  }[tone];
  return (
    <View
      style={{ flexDirection: "row", gap: 10, backgroundColor: t.bg, borderColor: t.border, borderWidth: 1, borderRadius: radius.md, padding: 12 }}
      accessibilityRole={tone === "error" ? "alert" : undefined}
    >
      <Icon name={icon ?? t.icon} size={17} color={t.fg} />
      <View style={{ flex: 1, gap: 6 }}>
        {typeof children === "string" ? <Text style={{ color: t.fg, fontSize: 13.5, lineHeight: 19 }}>{children}</Text> : children}
        {action}
      </View>
    </View>
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 12 }}>
      <ActivityIndicator color={colors.leaf} />
      <Text style={type.small}>{label}</Text>
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body?: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: "center", paddingVertical: 32, gap: 8 }}>
      <IconBadge name={icon} size={52} />
      <Text style={[type.h3, { textAlign: "center", marginTop: 4 }]}>{title}</Text>
      {body && <Text style={[type.body, { textAlign: "center", maxWidth: 300 }]}>{body}</Text>}
      {action}
    </Card>
  );
}

export function ErrorState({ message, onRetry, offline = false }: { message: string; onRetry?: () => void; offline?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10, backgroundColor: colors.page }}>
      <IconBadge name={offline ? "wifi-off" : "alert-triangle"} size={56} bg={offline ? colors.amberBg : colors.redBg} color={offline ? colors.amberText : colors.redText} />
      <Text style={[type.h2, { textAlign: "center", marginTop: 6 }]}>{offline ? "You're offline" : "That didn't load"}</Text>
      <Text style={[type.body, { textAlign: "center", maxWidth: 320 }]}>{message}</Text>
      {onRetry && <Button title="Try again" icon="refresh-cw" onPress={onRetry} style={{ marginTop: 8, alignSelf: "stretch" }} />}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  offline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.amberBg,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "#f1d9a6",
  },
  button: { height: 50, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 18 },
  chip: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
