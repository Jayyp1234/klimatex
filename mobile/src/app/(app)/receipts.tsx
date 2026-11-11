import { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { ComingSoon, HouseholdGate } from "@/components/household";
import { Button, Card, Chip, DetailRow, ErrorState, Icon, Loading, Notice, Pill, Screen, SectionHeader, type as t } from "@/components/ui";
import { ApiError, errorMessage } from "@/lib/api";
import { addFuelReceipt, fetchEvidence, notYetLive, type Evidence } from "@/lib/extras";
import { formatNaira, formatNumber, longDate, monthLabel } from "@/lib/household";
import { useDashboard } from "@/lib/household-context";
import { colors } from "@/theme";

/** The 12 months before solar: the ones already added (inside the window) plus the ones still missing. */
function windowMonths(e: Evidence): string[] {
  const { from, to } = e.baseline;
  const have = e.receipts.map((r) => r.month).filter((m) => from !== null && m >= from && m <= (to ?? m));
  return [...new Set([...have, ...e.baseline.missing_months])].sort();
}

type Load = { state: "loading" } | { state: "missing" } | { state: "error"; message: string; offline: boolean } | { state: "ready" };

/** Fuel receipts from the year before solar: 12 of them make the home's baseline measured instead of estimated. */
function Receipts() {
  const { home } = useDashboard();
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [month, setMonth] = useState("");
  const [litres, setLitres] = useState("");
  const [naira, setNaira] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState("");
  const [error, setError] = useState("");

  const fetchIt = useCallback(() => {
    fetchEvidence(home.siteId)
      .then((e) => {
        setEvidence(e);
        setMonth(e.baseline.missing_months[0] ?? e.baseline.to ?? "");
        setLoad({ state: "ready" });
      })
      .catch((e) =>
        setLoad(
          notYetLive(e)
            ? { state: "missing" }
            : { state: "error", message: errorMessage(e, "Your receipts couldn't be loaded. Try again."), offline: e instanceof ApiError && e.offline },
        ),
      );
  }, [home.siteId]);

  useEffect(() => {
    fetchIt();
  }, [fetchIt]);

  if (load.state === "missing")
    return (
      <Screen>
        <ComingSoon
          icon="file-text"
          title="Fuel receipts are coming soon"
          body="Add your petrol or diesel receipts from the year before solar, and your credits use your real fuel use instead of an estimate."
        />
      </Screen>
    );
  if (load.state === "error")
    return (
      <ErrorState
        message={load.message}
        offline={load.offline}
        onRetry={() => {
          setLoad({ state: "loading" });
          fetchIt();
        }}
      />
    );
  if (!evidence) return <Loading label="Loading your receipts" />;

  const b = evidence.baseline;
  const months = windowMonths(evidence);
  const byMonth = new Map(evidence.receipts.map((r) => [r.month, r]));
  const measured = b.tier === "measured";
  const litresValue = Number(litres.replace(",", "."));
  const nairaValue = Number(naira);
  const canSave = month !== "" && litres.trim() !== "" && naira.trim() !== "" && Number.isFinite(litresValue) && litresValue > 0 && nairaValue > 0;

  async function submit() {
    setError("");
    setSaved("");
    setSaving(true);
    try {
      const next = await addFuelReceipt(month, litresValue, nairaValue);
      setEvidence(next);
      setSaved(`${monthLabel(month)} saved.`);
      setLitres("");
      setNaira("");
      setMonth(next.baseline.missing_months[0] ?? month);
    } catch (e) {
      setError(errorMessage(e, "That receipt couldn't be saved. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Text style={t.body}>
        Your receipts for petrol or diesel from {b.from ? monthLabel(b.from) : "?"} to {b.to ? monthLabel(b.to) : "?"}, the year before your solar was installed.
      </Text>

      <View style={[styles.status, { backgroundColor: measured ? "#e4f3d5" : "#fdf3d7" }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Icon name={measured ? "check-circle" : "file-text"} size={18} color={measured ? "#27500a" : "#5c3d00"} />
          <Text style={{ fontSize: 16, fontWeight: "700", color: measured ? "#27500a" : "#5c3d00" }}>
            {measured ? "Your baseline is measured" : `${b.months} of ${b.needed} months added`}
          </Text>
        </View>
        <Text style={{ fontSize: 13.5, lineHeight: 19, color: measured ? "#27500a" : "#5c3d00" }}>
          {measured
            ? `Your credits now use your real fuel use before solar${b.litres_per_month ? ` (about ${formatNumber(b.litres_per_month)} litres a month)` : ""} instead of an estimate.`
            : `With all ${b.needed} months, your baseline is measured instead of estimated, and your credits are no longer cut by ${Math.round(b.deduction * 100)}%. It applies from the next audit.`}
        </Text>
        <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: b.needed, now: b.months }} accessibilityLabel="Months added">
          <View style={[styles.fill, { width: `${Math.min(100, (b.months / Math.max(1, b.needed)) * 100)}%` }]} />
        </View>
      </View>

      <SectionHeader title="Add a month" description="Add up every receipt from that month. Keep the paper receipts: your installer or the auditor may ask to see them." />
      <Card style={{ gap: 14 }}>
        <View style={{ gap: 8 }}>
          <Text style={styles.label}>Month</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {months.map((m) => (
              <Chip key={m} label={`${monthLabel(m)}${byMonth.has(m) ? " ✓" : ""}`} selected={month === m} onPress={() => setMonth(m)} />
            ))}
          </View>
          {byMonth.has(month) && <Text style={t.small}>{monthLabel(month)} is already added. Saving replaces it.</Text>}
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.label}>Litres bought</Text>
            <TextInput
              value={litres}
              onChangeText={(v) => setLitres(v.replace(/[^\d.,]/g, ""))}
              keyboardType="decimal-pad"
              placeholder="e.g. 90"
              placeholderTextColor={colors.muted}
              style={styles.input}
              accessibilityLabel="Litres bought"
            />
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={styles.label}>Amount paid (₦)</Text>
            <TextInput
              value={naira}
              onChangeText={(v) => setNaira(v.replace(/[^\d]/g, ""))}
              keyboardType="number-pad"
              placeholder="e.g. 63000"
              placeholderTextColor={colors.muted}
              style={styles.input}
              accessibilityLabel="Amount paid in naira"
            />
          </View>
        </View>
        {error ? <Notice tone="error">{error}</Notice> : null}
        {saved && !error ? <Notice tone="success">{saved}</Notice> : null}
        <Button title="Save receipt" icon="check-circle" busy={saving} disabled={!canSave} onPress={submit} />
      </Card>

      <SectionHeader title={`Your ${b.needed} months`} />
      <Card padded={false}>
        {months.map((m, i) => {
          const r = byMonth.get(m);
          return (
            <View key={m} style={[styles.row, i < months.length - 1 && styles.rowBorder]}>
              <Text style={[t.h3, { fontSize: 14.5 }]}>{monthLabel(m)}</Text>
              {r ? (
                <Text style={{ fontSize: 13.5, color: colors.body }}>
                  {formatNumber(r.litres, r.litres % 1 === 0 ? 0 : 1)} L · {formatNaira(r.amount_naira)}
                </Text>
              ) : (
                <Pill tone="amber">Missing</Pill>
              )}
            </View>
          );
        })}
      </Card>

      <SectionHeader title="Other evidence on your home" description="Your installer looks after these." />
      <Card style={{ paddingVertical: 4 }}>
        <DetailRow
          first
          label="Meter accuracy"
          value={
            evidence.meter.accuracy_pct === null
              ? "No calibration record yet"
              : `±${evidence.meter.accuracy_pct}%${evidence.meter.within_limit ? ", within the limit" : ", above the limit"}`
          }
        />
        <DetailRow
          label="Old generator"
          value={
            evidence.generator.scrapped
              ? `Scrapped${evidence.generator.scrapped_on ? ` ${longDate(evidence.generator.scrapped_on)}` : ""}`
              : `Not scrapped yet${evidence.generator.deadline ? `, due by ${longDate(evidence.generator.deadline)}` : ""}`
          }
        />
      </Card>
    </Screen>
  );
}

export default function ReceiptsScreen() {
  return (
    <HouseholdGate>
      <Receipts />
    </HouseholdGate>
  );
}

const styles = StyleSheet.create({
  status: { borderRadius: 18, padding: 16, gap: 8 },
  track: { height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.7)", overflow: "hidden", marginTop: 4 },
  fill: { height: "100%", borderRadius: 4, backgroundColor: colors.leaf },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  input: { height: 48, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, fontSize: 16, color: colors.ink, backgroundColor: colors.white },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingVertical: 13 },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
