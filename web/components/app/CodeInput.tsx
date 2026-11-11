"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Digit boxes for a PIN or a one-time code. Underneath is one ordinary input, so fast typing,
 * paste, Backspace and the phone's SMS autofill all behave natively; the boxes only draw it.
 * `onComplete` fires once every box is filled.
 */
export function CodeInput({ length, value, onChange, onComplete, label, secret = false, invalid = false, autoFocus = true, disabled = false }: {
  length: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  label: string;
  secret?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  // Also refocus when a check finishes, so a wrong PIN can be retyped straight away.
  useEffect(() => {
    if (autoFocus && !disabled) ref.current?.focus();
  }, [autoFocus, disabled]);

  function change(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length && digits !== value) onComplete?.(digits);
  }

  return (
    <div className="relative" onClick={() => ref.current?.focus()}>
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={secret ? "off" : "one-time-code"}
        maxLength={length}
        value={value}
        disabled={disabled}
        aria-label={label}
        aria-invalid={invalid}
        onChange={(event) => change(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0 text-[16px]"
      />
      <div aria-hidden className="flex gap-2.5">
        {Array.from({ length }, (_, i) => {
          const filled = i < value.length;
          const active = focused && (i === value.length || (i === length - 1 && value.length === length));
          return (
            <div
              key={i}
              className={`flex h-14 min-w-0 flex-1 items-center justify-center rounded-xl border bg-white text-[22px] font-semibold text-ink transition ${disabled ? "opacity-60" : ""} ${
                invalid ? "border-red-300" : active ? "border-leaf ring-4 ring-leaf/12" : filled ? "border-forest/50" : "border-line"
              }`}
            >
              {filled ? (secret ? <span className="h-3 w-3 rounded-full bg-ink" /> : value[i]) : active ? <span className="h-6 w-px animate-pulse bg-ink" /> : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
