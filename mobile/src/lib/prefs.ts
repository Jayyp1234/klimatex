import * as SecureStore from "expo-secure-store";

/** Small per-device preferences (language, dismissed alerts, read-aloud). Kept in SecureStore so no extra storage module is needed. */

export async function readPref(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(`klimatex.pref.${key}`);
  } catch {
    return null;
  }
}

export function writePref(key: string, value: string | null) {
  const k = `klimatex.pref.${key}`;
  (value === null ? SecureStore.deleteItemAsync(k) : SecureStore.setItemAsync(k, value)).catch(() => undefined);
}
