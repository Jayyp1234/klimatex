import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { fetchHomeTips, type HomeTips } from "./extras";
import type { Dashboard } from "./household";
import { earnMoreTips, fromServerTips, tipsToImprove, type Tip } from "./tips";

type EarnMore = {
  tips: Tip[];
  toImprove: number;
  /** Estimated cut to this home's credits until its evidence is complete, in whole percent. Zero when unknown. */
  cutPct: number;
  /** "server" when the API worked the tips out; "app" when this app did, from the dashboard. */
  source: "server" | "app";
};

/**
 * The home's "earn more" tips. Asks the server each time the screen comes into view (so a new fuel
 * receipt shows up straight away) and falls back to tips worked out in the app when the server
 * doesn't have the endpoint or can't be reached.
 */
export function useEarnMore(data: Dashboard): EarnMore {
  const siteId = data.home.siteId;
  const [server, setServer] = useState<{ siteId: number; result: HomeTips } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let stale = false;
      fetchHomeTips(siteId)
        .then((result) => !stale && setServer({ siteId, result }))
        .catch(() => !stale && setServer(null));
      return () => {
        stale = true;
      };
    }, [siteId]),
  );

  return useMemo(() => {
    if (server && server.siteId === siteId) {
      const tips = fromServerTips(server.result);
      return { tips, toImprove: tipsToImprove(tips), cutPct: server.result.credits_cut_pct, source: "server" as const };
    }
    const tips = earnMoreTips(data);
    return { tips, toImprove: tipsToImprove(tips), cutPct: 0, source: "app" as const };
  }, [server, siteId, data]);
}
