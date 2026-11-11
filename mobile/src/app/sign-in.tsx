import { useEffect, useRef, useState, type ReactNode, type ComponentRef } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CodeInput } from "@/components/CodeInput";
import { Logo } from "@/components/Logo";
import { Button, Icon, Notice, type IconName } from "@/components/ui";
import { API_BASE, ApiError, phoneComplete, phoneSignIn, phoneStart, phoneVerify } from "@/lib/api";
import { colors } from "@/theme";

type Step = "phone" | "pin" | "code" | "setup";

/** Synthetic sandbox homes. Numbers follow the seed: 0700 001 00NN is Home NN. */
const DEMO_HOMES = [
  { label: "Adaeze, Home 12", phone: "0700 001 0012" },
  { label: "Home 07, first visit", phone: "0700 001 0007" },
];

const RESEND_SECONDS = 30;

/** Mirrors the server's rule so a weak PIN is caught before the family types it twice. */
const RUNS = "0123456789";
const weakPin = (pin: string) =>
  new Set(pin).size === 1 || RUNS.includes(pin) || [...RUNS].reverse().join("").includes(pin) || ["1212", "2580", "1004", "2000", "2026"].includes(pin);

function StepHeading({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={styles.stepIcon}>
        <Icon name={icon} size={22} color={colors.forest} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.lead}>{children}</Text>
    </View>
  );
}

function BackLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 18 }} accessibilityRole="button">
      <Icon name="arrow-left" size={16} color={colors.body} />
      <Text style={{ color: colors.body, fontWeight: "600", fontSize: 14 }}>Use a different number</Text>
    </Pressable>
  );
}

export default function SignIn() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [masked, setMasked] = useState("");
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [pin, setPin] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [returning, setReturning] = useState(false);
  const [name, setName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);
  const phoneRef = useRef<ComponentRef<typeof TextInput>>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = setTimeout(() => setResendIn(resendIn - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendIn]);

  async function run(task: () => Promise<void>) {
    setError("");
    setBusy(true);
    try {
      await task();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const begin = (forgotPin = false) =>
    run(async () => {
      const result = await phoneStart(phone, forgotPin);
      setMasked(result.phone);
      if (result.next === "pin") {
        setPin("");
        setStep("pin");
        return;
      }
      setDemoCode(result.demo_code ?? null);
      setCode("");
      setResendIn(RESEND_SECONDS);
      setStep("code");
    });

  const signInWithPin = (value: string) =>
    run(async () => {
      try {
        await phoneSignIn(phone, value);
        // The root layout sees the new session and opens the app.
      } catch (e) {
        setPin("");
        throw e;
      }
    });

  const checkCode = (value: string) =>
    run(async () => {
      try {
        const result = await phoneVerify(phone, value);
        setSetupToken(result.setup_token);
        setReturning(result.returning);
        setName(result.name.startsWith("Household ") ? "" : result.name);
        setNewPin("");
        setConfirmPin("");
        setConfirming(false);
        setStep("setup");
      } catch (e) {
        setCode("");
        throw e;
      }
    });

  const finish = (pinValue: string) =>
    run(async () => {
      try {
        await phoneComplete(setupToken, pinValue, name.trim());
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) {
          // The setup window closed: go back to the start rather than leave a dead form.
          setStep("phone");
        } else {
          setNewPin("");
          setConfirmPin("");
          setConfirming(false);
        }
        throw e;
      }
    });

  function confirmChosenPin(value: string) {
    if (value !== newPin) {
      setError("Those PINs don't match. Choose your PIN again.");
      setNewPin("");
      setConfirmPin("");
      setConfirming(false);
      return;
    }
    finish(value);
  }

  function restart() {
    setStep("phone");
    setError("");
    setTimeout(() => phoneRef.current?.focus(), 50);
  }

  let body: ReactNode;

  if (step === "pin") {
    body = (
      <View>
        <BackLink onPress={restart} />
        <StepHeading icon="key" title="Enter your PIN">
          Signing in as {masked}.
        </StepHeading>
        <View style={{ marginTop: 28, gap: 18 }}>
          <CodeInput
            length={4}
            secret
            label="PIN"
            value={pin}
            onChange={(v) => {
              setPin(v);
              setError("");
            }}
            onComplete={signInWithPin}
            invalid={Boolean(error)}
            disabled={busy}
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button title={busy ? "Signing in" : "Sign in"} busy={busy} disabled={pin.length !== 4} onPress={() => signInWithPin(pin)} />
          <Pressable onPress={() => begin(true)} disabled={busy} hitSlop={8}>
            <Text style={styles.link}>Forgot your PIN? Get a code to reset it</Text>
          </Pressable>
        </View>
      </View>
    );
  } else if (step === "code") {
    body = (
      <View>
        <BackLink onPress={restart} />
        <StepHeading icon="message-square" title="Check your messages">
          We sent a 6-digit code to {masked}. It works for 10 minutes.
        </StepHeading>
        {demoCode && (
          <View style={styles.demo}>
            <Text style={{ color: "#633806", fontSize: 13.5, flex: 1, lineHeight: 19 }}>
              Sandbox: no SMS is sent. Your code is <Text style={{ fontFamily: "Menlo", fontWeight: "700", letterSpacing: 1 }}>{demoCode}</Text>
            </Text>
            <Pressable
              onPress={() => {
                setCode(demoCode);
                checkCode(demoCode);
              }}
              style={styles.fill}
              accessibilityRole="button"
            >
              <Text style={{ fontWeight: "600", color: colors.ink, fontSize: 13 }}>Fill it in</Text>
            </Pressable>
          </View>
        )}
        <View style={{ marginTop: 22, gap: 18 }}>
          <CodeInput
            length={6}
            label="Code"
            value={code}
            onChange={(v) => {
              setCode(v);
              setError("");
            }}
            onComplete={checkCode}
            invalid={Boolean(error)}
            disabled={busy}
          />
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button title={busy ? "Checking" : "Continue"} busy={busy} disabled={code.length !== 6} onPress={() => checkCode(code)} />
          <Text style={{ color: colors.body, fontSize: 14 }}>
            No code?{" "}
            {resendIn > 0 ? (
              <Text style={{ color: colors.muted }}>Send again in {resendIn}s</Text>
            ) : (
              <Text style={styles.link} onPress={() => !busy && begin(true)}>
                Send a new code
              </Text>
            )}
          </Text>
        </View>
      </View>
    );
  } else if (step === "setup") {
    const nameOk = returning || name.trim().length >= 2;
    body = (
      <View>
        <StepHeading icon="key" title={returning ? "Choose a new PIN" : "Set up your account"}>
          {returning ? "Pick 4 digits you'll remember. Don't use your birthday or 1234." : "Two quick things, then you're in."}
        </StepHeading>
        <View style={{ marginTop: 26, gap: 22 }}>
          {!returning && (
            <View style={{ gap: 6 }}>
              <Text style={styles.fieldLabel}>What should we call you?</Text>
              <View style={styles.field}>
                <Icon name="user" size={18} color={colors.muted} />
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="For example, Mama Tunde"
                  placeholderTextColor={colors.muted}
                  autoComplete="name"
                  textContentType="name"
                  maxLength={60}
                  style={styles.input}
                  returnKeyType="next"
                />
              </View>
            </View>
          )}
          <View style={{ gap: 4, opacity: nameOk ? 1 : 0.5 }}>
            <Text style={styles.fieldLabel}>{confirming ? "Enter your PIN again" : returning ? "New 4-digit PIN" : "Create a 4-digit PIN"}</Text>
            <Text style={{ color: colors.body, fontSize: 13, marginBottom: 10 }}>{confirming ? "Just to be sure." : "You'll use it every time you sign in."}</Text>
            {confirming ? (
              <CodeInput
                key="confirm"
                length={4}
                secret
                label="Confirm PIN"
                value={confirmPin}
                onChange={(v) => {
                  setConfirmPin(v);
                  setError("");
                }}
                onComplete={confirmChosenPin}
                invalid={Boolean(error)}
                disabled={busy}
              />
            ) : (
              <CodeInput
                key="choose"
                length={4}
                secret
                autoFocus={returning}
                label="New PIN"
                value={newPin}
                onChange={(v) => {
                  setNewPin(v);
                  setError("");
                }}
                onComplete={(value) => {
                  if (weakPin(value)) {
                    setError("That PIN is too easy to guess. Avoid repeats like 1111 and runs like 1234.");
                    setNewPin("");
                    return;
                  }
                  setConfirming(true);
                }}
                invalid={Boolean(error)}
                disabled={busy || !nameOk}
              />
            )}
          </View>
          {error ? <Notice tone="error">{error}</Notice> : null}
          {busy && <Text style={{ color: colors.body, fontSize: 14 }}>Saving your PIN…</Text>}
        </View>
      </View>
    );
  } else {
    body = (
      <View>
        <StepHeading icon="phone" title="Sign in to your home">
          Use the phone number your installer registered.
        </StepHeading>
        <View style={{ marginTop: 26, gap: 16 }}>
          <View style={{ gap: 6 }}>
            <Text style={styles.fieldLabel}>Phone number</Text>
            <View style={[styles.field, error ? { borderColor: "#fca5a5" } : null]}>
              <Icon name="phone" size={18} color={colors.muted} />
              <TextInput
                ref={phoneRef}
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  setError("");
                }}
                placeholder="0803 123 4567"
                placeholderTextColor={colors.muted}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                style={styles.input}
                onSubmitEditing={() => begin()}
                accessibilityLabel="Phone number"
              />
            </View>
          </View>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Button title={busy ? "Checking" : "Continue"} icon={busy ? undefined : "arrow-right"} busy={busy} disabled={!phone.trim()} onPress={() => begin()} />
          <View style={{ backgroundColor: colors.mint, borderRadius: 14, padding: 14 }}>
            <Text style={{ color: colors.body, fontSize: 13.5, lineHeight: 19 }}>
              <Text style={{ fontWeight: "700", color: colors.ink }}>First time here? </Text>
              Enter your number and we&apos;ll text you a code to set up your PIN. No password to remember.
            </Text>
          </View>
          <View style={{ marginTop: 10, gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <View style={styles.rule} />
              <Text style={{ color: colors.muted, fontSize: 12 }}>Demo homes</Text>
              <View style={styles.rule} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
              {DEMO_HOMES.map((home) => {
                const on = phone === home.phone;
                return (
                  <Pressable
                    key={home.phone}
                    onPress={() => {
                      setPhone(home.phone);
                      setError("");
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={[styles.demoChip, on && { backgroundColor: colors.forest, borderColor: colors.forest }]}
                  >
                    <Text style={{ color: on ? colors.white : colors.body, fontWeight: "600", fontSize: 13 }}>{home.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.forest }}>
      <SafeAreaView edges={["top"]} style={{ backgroundColor: colors.forest }}>
        <View style={styles.hero}>
          <Logo height={34} light />
          <Text style={styles.heroText}>Clean power at home, paid back to your family.</Text>
        </View>
      </SafeAreaView>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView style={styles.sheet} contentContainerStyle={{ padding: 24, paddingBottom: 48 }} keyboardShouldPersistTaps="handled">
          {body}
          {__DEV__ && <Text style={styles.server}>Server: {API_BASE}</Text>}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingTop: 18, paddingBottom: 26, gap: 10 },
  heroText: { color: "rgba(255,255,255,0.75)", fontSize: 14.5 },
  sheet: { flex: 1, backgroundColor: colors.white, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  stepIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: colors.mint, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  title: { fontSize: 28, fontWeight: "700", color: colors.ink, letterSpacing: -0.8 },
  lead: { fontSize: 15, color: colors.body, lineHeight: 21 },
  link: { color: colors.leaf, fontWeight: "600", fontSize: 14 },
  fieldLabel: { fontSize: 14, fontWeight: "600", color: colors.ink },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    backgroundColor: colors.white,
  },
  input: { flex: 1, fontSize: 16, color: colors.ink, height: "100%" },
  demo: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(227,166,0,0.6)",
    backgroundColor: "#fdf6e3",
    borderRadius: 14,
    padding: 12,
  },
  fill: { backgroundColor: colors.white, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: "rgba(227,166,0,0.4)" },
  rule: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.line },
  demoChip: { borderRadius: 999, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: colors.white },
  server: { marginTop: 28, textAlign: "center", color: colors.muted, fontSize: 11 },
});
