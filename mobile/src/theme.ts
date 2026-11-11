/** Brand colours, taken from web/app/globals.css so the app and the web app look like one product. */
export const colors = {
  forest: "#0b3f2a",
  forestHover: "#0f5237",
  leaf: "#14683f",
  lime: "#86d92b",
  mint: "#eff5ee",
  mintStrong: "#e3eee1",
  ink: "#10201a",
  body: "#41504a",
  muted: "#6b7872",
  line: "#e1e7e0",
  white: "#ffffff",
  page: "#f6f8f5",
  sun: "#ffc629",
  amber: "#e3a600",
  amberBg: "#fdf6e6",
  amberText: "#5c3d00",
  red: "#b3261e",
  redBg: "#fef2f2",
  redText: "#991b1b",
  green: "#3f9f12",
};

/** Grade colours, from clean (A) to generator-heavy (G). Matches web/lib/streets.ts. */
export const gradeTone: Record<string, { bg: string; fg: string }> = {
  A: { bg: "#1f7a3a", fg: "#ffffff" },
  B: { bg: "#4f9d2d", fg: "#ffffff" },
  C: { bg: "#a4c43b", fg: "#1d2a07" },
  D: { bg: "#f2c94c", fg: "#3d2c00" },
  E: { bg: "#f2994a", fg: "#3d1d00" },
  F: { bg: "#e0603a", fg: "#ffffff" },
  G: { bg: "#b3261e", fg: "#ffffff" },
};

export const radius = { sm: 10, md: 14, lg: 20, xl: 24 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
