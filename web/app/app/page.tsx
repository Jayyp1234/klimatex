import type { Metadata } from "next";
import { SignInForm } from "@/components/app/SignInForm";

export const metadata: Metadata = { title: "Sign in | KlimateX" };

export default function SignInPage() {
  return <SignInForm />;
}
