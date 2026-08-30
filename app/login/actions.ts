"use server";

import { redirect } from "next/navigation";
import { probeerInloggen, uitloggen } from "@/lib/auth";
import { isGeldigePin } from "@/lib/pin";

export type LoginState = { fout: string } | null;

export async function inloggenAction(
  _vorige: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const userId = Number(formData.get("userId"));
  const pin = String(formData.get("pin") ?? "");
  if (!Number.isInteger(userId)) return { fout: "Kies eerst een naam." };
  if (!isGeldigePin(pin)) return { fout: "Vul vier cijfers in." };

  const resultaat = await probeerInloggen(userId, pin);
  if (!resultaat.ok) return { fout: resultaat.fout };
  redirect("/");
}

export async function uitloggenAction() {
  await uitloggen();
  redirect("/login");
}
