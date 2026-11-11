import NetInfo from "@react-native-community/netinfo";
import { useEffect, useState } from "react";

/** False when the phone has no connection. Unknown counts as online, so a slow start never shows a false alarm. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(
    () =>
      NetInfo.addEventListener((state) => {
        setOnline(state.isConnected !== false && state.isInternetReachable !== false);
      }),
    [],
  );
  return online;
}
