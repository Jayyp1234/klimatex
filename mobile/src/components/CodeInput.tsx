import { useEffect, useRef, type ComponentRef } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "@/theme";

/**
 * Digit boxes for a PIN or a one-time code. Underneath is one ordinary text field, so typing,
 * paste, delete and iOS one-time-code autofill all behave natively; the boxes only draw it.
 * `onComplete` fires once every box is filled.
 */
export function CodeInput({
  length,
  value,
  onChange,
  onComplete,
  label,
  secret = false,
  invalid = false,
  disabled = false,
  autoFocus = true,
}: {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  label: string;
  secret?: boolean;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<ComponentRef<typeof TextInput>>(null);

  // Refocus when a check finishes, so a wrong PIN can be retyped straight away.
  useEffect(() => {
    if (autoFocus && !disabled) {
      const t = setTimeout(() => ref.current?.focus(), 250);
      return () => clearTimeout(t);
    }
  }, [autoFocus, disabled]);

  function change(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) onComplete?.(digits);
  }

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel={label} accessibilityHint={`${length} digits`}>
      <View style={styles.row}>
        {Array.from({ length }, (_, i) => {
          const filled = i < value.length;
          const active = i === Math.min(value.length, length - 1) && !disabled;
          return (
            <View key={i} style={[styles.box, length > 4 && styles.boxSmall, active && styles.active, invalid && styles.invalid]}>
              <Text style={styles.digit}>{filled ? (secret ? "•" : value[i]) : ""}</Text>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        value={value}
        onChangeText={change}
        editable={!disabled}
        keyboardType="number-pad"
        textContentType={secret ? "password" : "oneTimeCode"}
        autoComplete={secret ? "off" : "sms-otp"}
        maxLength={length}
        caretHidden
        secureTextEntry={false}
        style={styles.hidden}
        accessibilityLabel={label}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  box: { width: 56, height: 62, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  boxSmall: { width: 46, height: 56 },
  active: { borderColor: colors.leaf, shadowColor: colors.leaf, shadowOpacity: 0.18, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  invalid: { borderColor: "#f3a5a5" },
  digit: { fontSize: 24, fontWeight: "700", color: colors.ink },
  hidden: { position: "absolute", width: 1, height: 1, opacity: 0 },
});
