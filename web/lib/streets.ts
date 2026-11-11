import { api } from "./api";

export type Street = {
  id: number;
  name: string;
  area: string;
  grade: string;
  generator_share: number;
  homes_total: number;
  homes_on_klimatex: number;
  homes_verified: number;
  next_grade: string | null;
  homes_needed_for_next: number | null;
};

export const fetchStreets = () => api<{ streets: Street[]; as_of: string | null; method: string }>("/api/streets");

export const fetchHomeStreet = (siteId: number) =>
  api<{ street: Street; home_grade: string | null; as_of: string | null }>(`/api/homes/${siteId}/street`);

/** Grade colours, from clean (A) to generator-heavy (G). */
export const GRADE_TONE: Record<string, string> = {
  A: "bg-[#1f7a3a] text-white",
  B: "bg-[#4f9d2d] text-white",
  C: "bg-[#a4c43b] text-[#1d2a07]",
  D: "bg-[#f2c94c] text-[#3d2c00]",
  E: "bg-[#f2994a] text-[#3d1d00]",
  F: "bg-[#e0603a] text-white",
  G: "bg-[#b3261e] text-white",
};

export const nextStep = (s: Street) =>
  s.next_grade && s.homes_needed_for_next
    ? `${s.homes_needed_for_next} more verified solar ${s.homes_needed_for_next === 1 ? "home" : "homes"} would make it grade ${s.next_grade}.`
    : s.grade === "A"
      ? "Every home on this street runs mostly on clean power."
      : "More homes on verified solar will lift this grade.";
