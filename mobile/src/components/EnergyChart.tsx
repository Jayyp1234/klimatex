import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";
import { kwh, longDate, type Day } from "@/lib/household";
import { colors } from "@/theme";

export const SERIES = { solar: colors.leaf, ceiling: colors.amber };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HEIGHT = 200;
const LEFT = 30;
const TOP = 10;
const BOTTOM = 24;
const plot = HEIGHT - TOP - BOTTOM;

function niceStep(rough: number) {
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const leading = rough / magnitude;
  return (leading <= 1 ? 1 : leading <= 2 ? 2 : leading <= 5 ? 5 : 10) * magnitude;
}

const date = (day: string) => new Date(`${day}T00:00:00Z`);

/** Daily solar (bars) against the most the sun allowed that day (dashed line). Tap a bar for its numbers. Same chart as the web. */
export function EnergyChart({ days, showSolar = true, showCeiling = true, legend = true }: { days: Day[]; showSolar?: boolean; showCeiling?: boolean; legend?: boolean }) {
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  if (days.length === 0) return <Text style={{ color: colors.muted, fontSize: 13, paddingVertical: 30, textAlign: "center" }}>No readings yet.</Text>;

  const weekly = days.length <= 7;
  const peak = Math.max(1, ...days.map((d) => Math.max(d.generated, d.ceiling ?? 0)));
  const step = niceStep(peak / 4);
  const axisMax = Math.ceil(peak / step) * step;
  const ticks = Array.from({ length: Math.round(axisMax / step) + 1 }, (_, i) => Number((i * step).toFixed(6)));
  const y = (v: number) => TOP + plot * (1 - v / axisMax);
  const band = width > LEFT ? (width - LEFT) / days.length : 0;
  const barWidth = Math.min(28, band * 0.62);
  const centre = (i: number) => LEFT + band * i + band / 2;
  const labelEvery = days.length > 16 ? Math.ceil(days.length / 8) : 1;
  const ceilingPath = days
    .map((d, i) => (d.ceiling === null ? null : `${centre(i)},${y(d.ceiling)}`))
    .reduce<string[]>((parts, p, i, all) => {
      if (p) parts.push(`${i === 0 || all[i - 1] === null ? "M" : "L"}${p}`);
      return parts;
    }, [])
    .join(" ");
  const picked = active === null ? null : days[active];

  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 && (
        <Svg width={width} height={HEIGHT}>
          {ticks.map((t) => (
            <Line key={t} x1={LEFT} x2={width} y1={y(t)} y2={y(t)} stroke={colors.line} strokeWidth={1} />
          ))}
          {ticks.map((t) => (
            <SvgText key={`l${t}`} x={LEFT - 6} y={y(t) + 4} fontSize={10} fill={colors.muted} textAnchor="end">
              {t}
            </SvgText>
          ))}
          {showSolar &&
            days.map((d, i) => (
              <Rect
                key={d.day}
                x={centre(i) - barWidth / 2}
                y={y(d.generated)}
                width={barWidth}
                height={Math.max(0, y(0) - y(d.generated))}
                rx={Math.min(4, barWidth / 3)}
                fill={d.ceiling !== null && d.generated > d.ceiling ? "#c2410c" : SERIES.solar}
                opacity={active === null || active === i ? 1 : 0.45}
              />
            ))}
          {showCeiling && ceilingPath && <Path d={ceilingPath} stroke={SERIES.ceiling} strokeWidth={2} strokeDasharray="5 4" fill="none" />}
          {days.map((d, i) =>
            i % labelEvery === 0 ? (
              <SvgText key={`x${d.day}`} x={centre(i)} y={HEIGHT - 8} fontSize={10} fill={colors.muted} textAnchor="middle">
                {weekly ? WEEKDAYS[date(d.day).getUTCDay()] : String(date(d.day).getUTCDate())}
              </SvgText>
            ) : null,
          )}
        </Svg>
      )}
      {/* Tap targets laid over the bars. */}
      <View style={{ position: "absolute", left: LEFT, top: 0, right: 0, height: HEIGHT, flexDirection: "row" }}>
        {days.map((d, i) => (
          <Pressable
            key={d.day}
            style={{ flex: 1 }}
            onPress={() => setActive(active === i ? null : i)}
            accessibilityLabel={`${longDate(d.day)}: ${kwh(d.generated)} made${d.ceiling !== null ? `, ceiling ${kwh(d.ceiling)}` : ""}`}
          />
        ))}
      </View>
      <View style={{ minHeight: 20, marginTop: 4 }}>
        {picked ? (
          <Text style={{ fontSize: 12.5, color: colors.ink }}>
            <Text style={{ fontWeight: "700" }}>{longDate(picked.day)}</Text> · {kwh(picked.generated)} made
            {picked.ceiling !== null ? ` · ceiling ${kwh(picked.ceiling)}` : ""}
          </Text>
        ) : !legend ? (
          <Text style={{ fontSize: 12, color: colors.muted }}>Tap a bar for that day&apos;s numbers.</Text>
        ) : (
          <View style={{ flexDirection: "row", gap: 16 }}>
            <Legend colour={SERIES.solar} label="Solar energy" />
            <Legend colour={SERIES.ceiling} label="Sunlight ceiling" dashed />
          </View>
        )}
      </View>
    </View>
  );
}

function Legend({ colour, label, dashed = false }: { colour: string; label: string; dashed?: boolean }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <View
        style={
          dashed ? { width: 14, height: 0, borderTopWidth: 2, borderStyle: "dashed", borderColor: colour } : { width: 10, height: 10, borderRadius: 2, backgroundColor: colour }
        }
      />
      <Text style={{ fontSize: 12, color: colors.body }}>{label}</Text>
    </View>
  );
}
