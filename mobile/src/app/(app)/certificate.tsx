import { Share, StyleSheet, Text, View } from "react-native";
import { HouseholdGate } from "@/components/household";
import { Button, Card, DetailRow, EmptyState, Icon, Screen, SectionHeader, type as t } from "@/components/ui";
import { checkLabel, formatNumber, homeCode, longDate, tco2 } from "@/lib/household";
import { useDashboard } from "@/lib/household-context";
import { colors } from "@/theme";

/** EPC-style bands: the share of the home's power that still comes from a generator. Same as the web certificate. */
const BANDS = [
  { grade: "A", range: "0–2%", colour: "#14683f" },
  { grade: "B", range: "3–10%", colour: "#2f8f00" },
  { grade: "C", range: "11–25%", colour: "#86b82b" },
  { grade: "D", range: "26–40%", colour: "#cdb51f" },
  { grade: "E", range: "41–55%", colour: "#e3a600" },
  { grade: "F", range: "56–75%", colour: "#e07a1f" },
  { grade: "G", range: "over 75%", colour: "#c2410c" },
];

function addYear(iso: string | null) {
  if (!iso) return null;
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function Marker({ label, share, tone }: { label: string; share: string; tone: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View
        style={{
          width: 0,
          height: 0,
          borderTopWidth: 11,
          borderBottomWidth: 11,
          borderRightWidth: 9,
          borderTopColor: "transparent",
          borderBottomColor: "transparent",
          borderRightColor: tone,
        }}
      />
      <View
        style={{ backgroundColor: tone, height: 22, borderTopRightRadius: 6, borderBottomRightRadius: 6, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 5 }}
      >
        <Text style={{ color: colors.white, fontWeight: "700", fontSize: 12 }}>{label}</Text>
        <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 11.5 }}>{share}</Text>
      </View>
    </View>
  );
}

function CertificateView() {
  const data = useDashboard();
  const c = data.certificate;
  const { home } = data;
  if (!c) {
    return (
      <Screen>
        <EmptyState icon="award" title="Home Energy Certificate" body="Your certificate appears after your first audited period." />
      </Screen>
    );
  }
  const passed = c.checks.filter((ch) => ch.result === "pass").length;
  const issued = data.dataAsOf;
  const share = () =>
    Share.share({
      message: `KlimateX Home Energy Certificate ${c.certificate}\n${home.label}, ${home.area}, Lagos\nGrade ${c.grade_now} (was ${c.grade_before})\nTrust score ${c.trust_score}/100\nIssued ${longDate(issued)}`,
    });

  return (
    <Screen>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headLabel}>HOME ENERGY CERTIFICATE</Text>
          <Text style={{ color: colors.white, fontFamily: "Menlo", fontSize: 13.5, fontWeight: "600", marginTop: 4 }} selectable>
            {c.certificate}
          </Text>
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12.5, marginTop: 6 }}>
            Issued {longDate(issued)} · valid until {longDate(addYear(issued))}
          </Text>
        </View>
        <View style={[styles.big, { backgroundColor: BANDS.find((b) => b.grade === c.grade_now)?.colour ?? colors.leaf }]}>
          <Text style={{ color: colors.white, fontSize: 40, fontWeight: "800" }}>{c.grade_now}</Text>
        </View>
      </View>

      <SectionHeader title="Generator share of your power" description="Measured from your inverter, not a one-day survey." />
      <Card style={{ gap: 6 }}>
        {BANDS.map((b, i) => (
          <View key={b.grade} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <View style={[styles.band, { backgroundColor: b.colour, width: `${30 + i * 6.5}%` }]}>
              <Text style={styles.bandGrade}>{b.grade}</Text>
              <Text style={styles.bandRange}>{b.range}</Text>
            </View>
            <View style={{ gap: 3 }}>
              {c.grade_now === b.grade && <Marker label="Now" share={`${Math.round(c.generator_share_now * 100)}%`} tone={colors.forest} />}
              {c.grade_before === b.grade && <Marker label="Before" share={`${Math.round(c.generator_share_before * 100)}%`} tone={colors.muted} />}
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 4, backgroundColor: colors.mint }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="trending-up" size={15} color={colors.leaf} />
          <Text style={[t.h3, { fontSize: 14 }]}>Your potential</Text>
        </View>
        <Text style={t.body}>{c.potential}. Less generator time earns more credits, and the step can be financed with an Access solar loan.</Text>
      </Card>

      <Card style={{ paddingVertical: 4 }}>
        <DetailRow first label="Credited this period" value={tco2(c.credited_tco2e_period)} />
        <DetailRow label="Credited a year" value={tco2(c.credited_tco2e_per_year)} />
        <DetailRow label="Petrol avoided" value={`${formatNumber(c.petrol_litres_avoided_period)} L`} />
        <DetailRow label="Trust score" value={`${c.trust_score} / 100`} />
        <DetailRow label="Checks passed" value={`${passed} of ${c.checks.length}`} />
      </Card>

      <SectionHeader title="Your home" />
      <Card style={{ paddingVertical: 4 }}>
        <DetailRow first label="Household" value={home.householdName} />
        <DetailRow label="Home" value={`${home.label} · ${homeCode(home.siteId)}`} />
        <DetailRow label="Location" value={`${home.area}, Lagos`} />
        <DetailRow label="Solar system" value={`${home.panelKwp} kWp · ${home.inverter.serial}`} />
        <DetailRow label="Measured" value={`${longDate(home.daily[0]?.day ?? null)} to ${longDate(data.dataAsOf)}`} />
        <DetailRow label="Generator" value={`${home.generator.kva} kVA, scrapped ${longDate(home.generator.scrappedOn)}`} />
        <DetailRow label="Recycler certificate" value={home.generator.certificate ?? "Pending"} mono />
      </Card>

      <SectionHeader title="Checks" />
      <Card padded={false}>
        {c.checks.map((ch, i) => (
          <View key={ch.name} style={[styles.check, i < c.checks.length - 1 && styles.checkBorder]}>
            <Icon name={ch.result === "pass" ? "check-circle" : "alert-circle"} size={17} color={ch.result === "pass" ? colors.leaf : "#c2410c"} />
            <Text style={{ flex: 1, fontSize: 14, color: colors.ink }}>{checkLabel(ch.name)}</Text>
            <Text style={{ fontSize: 12.5, color: ch.result === "pass" ? colors.leaf : "#c2410c", fontWeight: "600" }}>{ch.result}</Text>
          </View>
        ))}
      </Card>

      <Button title="Share certificate" icon="share" variant="secondary" onPress={share} />
      <Text style={[t.small, { textAlign: "center" }]}>Built from {home.daily.length} days of inverter readings. Anyone can check it with the certificate number.</Text>
    </Screen>
  );
}

export default function CertificateScreen() {
  return (
    <HouseholdGate>
      <CertificateView />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: colors.forest, borderRadius: 22, padding: 18, flexDirection: "row", alignItems: "center", gap: 12 },
  headLabel: { color: colors.lime, fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  big: { width: 72, height: 72, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "rgba(255,255,255,0.25)" },
  band: {
    height: 28,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderTopLeftRadius: 6,
    borderBottomLeftRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
  },
  bandGrade: { color: colors.white, fontWeight: "800", fontSize: 15 },
  bandRange: { color: "rgba(255,255,255,0.9)", fontSize: 11.5, fontWeight: "600" },
  check: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12 },
  checkBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
