import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Button, Card, ErrorState, Icon, Loading, Notice, Screen, type IconName, type as t } from "@/components/ui";
import { ApiError, errorMessage } from "@/lib/api";
import { checkAccount, fetchPayoutDetails, savePayoutDetails, type PayoutDetails } from "@/lib/extras";
import { longDate } from "@/lib/household";
import { colors } from "@/theme";

type Method = "wallet" | "bank";

function Choice({ selected, onSelect, icon, title, tag, children }: { selected: boolean; onSelect: () => void; icon: IconName; title: string; tag?: string; children: ReactNode }) {
  return (
    <Pressable onPress={onSelect} accessibilityRole="radio" accessibilityState={{ selected }} style={[styles.choice, selected && styles.choiceOn]}>
      <View style={[styles.choiceIcon, selected && { backgroundColor: colors.forest }]}>
        <Icon name={icon} size={19} color={selected ? colors.white : colors.forest} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text style={[t.h3, { fontSize: 15 }]}>{title}</Text>
          {tag && (
            <View style={{ backgroundColor: "#e4f3d5", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
              <Text style={{ fontSize: 11, color: "#27500a", fontWeight: "600" }}>{tag}</Text>
            </View>
          )}
        </View>
        <Text style={{ fontSize: 13, color: colors.body, lineHeight: 18 }}>{children}</Text>
      </View>
      <View style={[styles.radio, selected && { borderColor: colors.forest }]}>{selected && <View style={styles.radioDot} />}</View>
    </Pressable>
  );
}

/**
 * Where a family is paid. A bank account is checked with the bank first, and the family
 * confirms the name on it before anything is saved. Same flow as the web form.
 */
function PayoutForm({ details, onSaved }: { details: PayoutDetails; onSaved: (d: PayoutDetails) => void }) {
  const [method, setMethod] = useState<Method>(details.method);
  const [changingBank, setChangingBank] = useState(!details.bank);
  const [bankCode, setBankCode] = useState("");
  const [bankQuery, setBankQuery] = useState("");
  const [pickingBank, setPickingBank] = useState(false);
  const [account, setAccount] = useState("");
  const [lookup, setLookup] = useState<{ key: string; name?: string; error?: string } | null>(null);
  const [confirmedKey, setConfirmedKey] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const digits = account.replace(/\D/g, "");
  const key = `${bankCode}:${digits}`;
  const lookupReady = changingBank && method === "bank" && bankCode !== "" && digits.length === 10;

  useEffect(() => {
    if (!lookupReady || lookup?.key === key) return;
    let current = true;
    checkAccount(bankCode, digits)
      .then((result) => current && setLookup({ key, name: result.account_name }))
      .catch((e) => current && setLookup({ key, error: e instanceof ApiError ? e.message : "We couldn't check that account. Try again." }));
    return () => {
      current = false;
    };
  }, [lookupReady, key, bankCode, digits, lookup?.key]);

  const answered = lookupReady && lookup?.key === key ? lookup : null;
  const checking = lookupReady && !answered;
  const nameShown = answered?.name ?? null;
  const confirmed = nameShown !== null && confirmedKey === key;
  const usingSavedBank = method === "bank" && !changingBank && details.bank;
  const canSave = method === "wallet" ? Boolean(details.wallet) : usingSavedBank ? true : confirmed;
  const shownError = error || answered?.error || "";
  const bank = details.banks.find((b) => b.code === bankCode);
  const banks = details.banks.filter((b) => b.name.toLowerCase().includes(bankQuery.trim().toLowerCase()));

  async function save() {
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      const result = method === "wallet" ? await savePayoutDetails("wallet") : usingSavedBank ? await savePayoutDetails("bank") : await savePayoutDetails("bank", bankCode, digits);
      setChangingBank(!result.bank);
      setAccount("");
      setLookup(null);
      setConfirmedKey("");
      setSaved(true);
      onSaved(result);
    } catch (e) {
      setError(errorMessage(e, "That didn't save. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      {details.has_loan && (
        <Notice tone="info" icon="home">
          You have an Access solar loan, so while it runs your earnings go straight to your loan repayments. The choice below applies once the loan is paid off.
        </Notice>
      )}
      <Choice selected={method === "wallet"} onSelect={() => setMethod("wallet")} icon="credit-card" title="Access wallet" tag={details.wallet ? "Ready now" : undefined}>
        {details.wallet
          ? `Opened for you on ${details.wallet.phone ?? "your phone number"} when your solar was fitted. Nothing to set up.`
          : "Not open yet. Your installer can open one for you."}
      </Choice>
      <Choice selected={method === "bank"} onSelect={() => setMethod("bank")} icon="briefcase" title="My bank account">
        {details.bank
          ? `${details.bank.bank_name} ending ${details.bank.account_ending} · ${details.bank.account_name}`
          : "Any Nigerian bank or mobile money account. We check the name with the bank before saving."}
      </Choice>

      {usingSavedBank && (
        <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
            <Icon name="check-circle" size={16} color={colors.leaf} />
            <Text style={{ color: colors.ink, fontSize: 14 }}>Checked with {details.bank!.bank_name}</Text>
          </View>
          <Pressable onPress={() => setChangingBank(true)} hitSlop={8}>
            <Text style={{ color: colors.leaf, fontWeight: "600" }}>Use another</Text>
          </Pressable>
        </Card>
      )}

      {method === "bank" && changingBank && (
        <Card style={{ gap: 14 }}>
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Bank</Text>
            <Pressable onPress={() => setPickingBank(!pickingBank)} style={styles.field} accessibilityRole="button" accessibilityLabel="Choose your bank">
              <Text style={{ flex: 1, fontSize: 15.5, color: bank ? colors.ink : colors.muted }}>{bank?.name ?? "Choose your bank"}</Text>
              <Icon name={pickingBank ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
            </Pressable>
            {pickingBank && (
              <View style={styles.picker}>
                <TextInput value={bankQuery} onChangeText={setBankQuery} placeholder="Search banks" placeholderTextColor={colors.muted} style={styles.pickerSearch} autoFocus />
                {banks.slice(0, 40).map((b) => (
                  <Pressable
                    key={b.code}
                    onPress={() => {
                      setBankCode(b.code);
                      setPickingBank(false);
                      setBankQuery("");
                    }}
                    style={({ pressed }) => [styles.pickerRow, pressed && { backgroundColor: colors.mint }]}
                  >
                    <Text style={{ fontSize: 14.5, color: colors.ink, flex: 1 }}>{b.name}</Text>
                    {b.code === bankCode && <Icon name="check" size={16} color={colors.leaf} />}
                  </Pressable>
                ))}
                {banks.length === 0 && <Text style={[t.small, { padding: 12 }]}>No bank matches that.</Text>}
              </View>
            )}
          </View>
          <View style={{ gap: 6 }}>
            <Text style={styles.label}>Account number</Text>
            <TextInput
              value={account}
              onChangeText={(v) => {
                setAccount(v.replace(/[^\d ]/g, ""));
                setError("");
              }}
              keyboardType="number-pad"
              maxLength={13}
              placeholder="10 digits"
              placeholderTextColor={colors.muted}
              style={[styles.field, { fontFamily: "Menlo", fontSize: 17, letterSpacing: 1.5, color: colors.ink }]}
              accessibilityLabel="Account number"
            />
            <Text style={t.small}>{digits.length}/10 digits</Text>
          </View>
          {checking && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <ActivityIndicator size="small" color={colors.leaf} />
              <Text style={t.body}>Checking with the bank</Text>
            </View>
          )}
          {nameShown && (
            <Pressable onPress={() => setConfirmedKey(confirmed ? "" : key)} style={styles.confirm} accessibilityRole="checkbox" accessibilityState={{ checked: confirmed }}>
              <View style={[styles.box, confirmed && { backgroundColor: colors.leaf, borderColor: colors.leaf }]}>
                {confirmed && <Icon name="check" size={14} color={colors.white} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, color: colors.body }}>The bank says this account belongs to</Text>
                <Text style={{ fontSize: 16, fontWeight: "700", color: colors.ink }}>{nameShown}</Text>
                <Text style={{ fontSize: 13, color: colors.body }}>Tap to confirm this is your account.</Text>
              </View>
            </Pressable>
          )}
          {details.bank && (
            <Pressable
              onPress={() => {
                setChangingBank(false);
                setAccount("");
                setError("");
              }}
              hitSlop={8}
            >
              <Text style={{ color: colors.body, fontWeight: "600" }}>
                Keep {details.bank.bank_name} ending {details.bank.account_ending}
              </Text>
            </Pressable>
          )}
        </Card>
      )}

      {shownError ? <Notice tone="error">{shownError}</Notice> : null}
      {saved && !shownError ? <Notice tone="success">Saved. Your next payout goes here.</Notice> : null}
      <Button title="Save" icon="check-circle" busy={saving} disabled={!canSave} onPress={save} />
      {details.updated_at && <Text style={[t.small, { textAlign: "center" }]}>Last changed {longDate(details.updated_at)}</Text>}
    </View>
  );
}

export default function PaymentDetailsScreen() {
  const [details, setDetails] = useState<PayoutDetails | null>(null);
  const [error, setError] = useState<{ message: string; offline: boolean } | null>(null);

  const load = useCallback(() => {
    fetchPayoutDetails()
      .then((d) => {
        setError(null);
        setDetails(d);
      })
      .catch((e) => setError({ message: errorMessage(e, "Your payment details couldn't be loaded."), offline: e instanceof ApiError && e.offline }));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <ErrorState
        message={error.message}
        offline={error.offline}
        onRetry={() => {
          setError(null);
          load();
        }}
      />
    );
  if (!details) return <Loading label="Loading your payment details" />;
  return (
    <Screen>
      <Text style={t.body}>Where KlimateX sends your share of every credit sold.</Text>
      <PayoutForm details={details} onSaved={setDetails} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  choice: { flexDirection: "row", gap: 12, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white },
  choiceOn: { borderColor: colors.forest, backgroundColor: "#f4f8f3" },
  choiceIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center" },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: colors.line, alignItems: "center", justifyContent: "center", marginTop: 2 },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.forest },
  label: { fontSize: 14, fontWeight: "600", color: colors.ink },
  field: {
    height: 50,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.white,
  },
  picker: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: "hidden" },
  pickerSearch: { height: 44, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: colors.line, fontSize: 15, color: colors.ink },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  confirm: { flexDirection: "row", gap: 12, backgroundColor: colors.mint, borderRadius: 12, padding: 12 },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.muted, alignItems: "center", justifyContent: "center", marginTop: 2 },
});
