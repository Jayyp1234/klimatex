/** Every destination that doesn't live on the landing page, in one place. */
export const links = {
  app: "/app/",
  signIn: "/app/",
  /** Companies, installers, auditors and lenders: opens the work-email sign-in. Families use signIn (phone). */
  workSignIn: "/app/?as=work",
  requestDemo: "/app/?as=work",
  /** The household app for Android, served from the site itself. */
  androidApk: "/downloads/klimatex.apk",
};

/** Details of the APK in public/downloads; update them with each new build. */
export const androidApp = {
  version: "1.0.0",
  sizeMb: 48,
  sha256: "64e75a2ca764450ec7a92df8292eb94ab723ed766eb3d7ca86a5bad77b7f25ed",
  builtOn: "11 Nov 2026",
  /** Built for ARM phones only (arm64-v8a, armeabi-v7a), minSdk 24. */
  requires: "Android 7 or later, on a phone",
};

export const solutions = [
  { id: "families", label: "Families" },
  { id: "installers", label: "Installers" },
  { id: "auditors", label: "Auditors" },
  { id: "buyers", label: "Buyers" },
  { id: "bank", label: "Access Bank" },
] as const;

export type SolutionId = (typeof solutions)[number]["id"];

export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE ??
  (process.env.NODE_ENV === "development" ? "http://localhost:8080" : "");
