"use client";

import { useEffect, useState, useTransition } from "react";
import {
  meldToestelAanAction,
  meldToestelAfAction,
  proefMeldingAction,
  zetVoorkeurAction,
  type MeldingState,
} from "@/app/(app)/instellingen/meldingen";

export type Keuze = {
  soort: string;
  titel: string;
  uitleg: string;
  aan: boolean;
};

type Stand =
  "laden" | "kan-niet" | "zet-op-beginscherm" | "geweigerd" | "uit" | "aan";

export default function MeldingenFormulier({
  vapidPubliek,
  keuzes,
  toestellen,
}: {
  /** Null zolang de beheerder de sleutels nog niet heeft aangemaakt. */
  vapidPubliek: string | null;
  keuzes: Keuze[];
  toestellen: number;
}) {
  const [stand, setStand] = useState<Stand>("laden");
  const [melding, setMelding] = useState<MeldingState>(null);
  const [bezig, start] = useTransition();

  useEffect(() => {
    let afgebroken = false;

    async function kijk() {
      const kanPush =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        typeof Notification !== "undefined";

      if (!kanPush) {
        // Op een iPhone bestaat pushen alleen als de app op het beginscherm staat.
        // Dat onderscheid is het melden waard, anders lijkt het kapot.
        const isApple = /iphone|ipad|ipod/i.test(navigator.userAgent);
        const losstaand =
          window.matchMedia("(display-mode: standalone)").matches ||
          (navigator as { standalone?: boolean }).standalone === true;
        if (!afgebroken) {
          setStand(isApple && !losstaand ? "zet-op-beginscherm" : "kan-niet");
        }
        return;
      }

      if (Notification.permission === "denied") {
        if (!afgebroken) setStand("geweigerd");
        return;
      }

      const registratie = await navigator.serviceWorker.ready;
      const bestaand = await registratie.pushManager.getSubscription();
      if (!afgebroken) setStand(bestaand ? "aan" : "uit");
    }

    void kijk().catch(() => {
      if (!afgebroken) setStand("kan-niet");
    });
    return () => {
      afgebroken = true;
    };
  }, []);

  async function zetAan() {
    if (!vapidPubliek) return;
    setMelding(null);
    try {
      const toestemming = await Notification.requestPermission();
      if (toestemming !== "granted") {
        setStand(toestemming === "denied" ? "geweigerd" : "uit");
        return;
      }

      const registratie = await navigator.serviceWorker.ready;
      const abonnement = await registratie.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: naarBytes(vapidPubliek),
      });

      const rauw = abonnement.toJSON();
      const uitkomst = await meldToestelAanAction(
        {
          endpoint: abonnement.endpoint,
          p256dh: rauw.keys?.p256dh ?? "",
          auth: rauw.keys?.auth ?? "",
        },
        navigator.userAgent,
      );
      setMelding(uitkomst);
      if (!uitkomst?.fout) setStand("aan");
    } catch (fout) {
      setMelding({ fout: `Aanzetten mislukte: ${(fout as Error).message}` });
    }
  }

  async function zetUit() {
    setMelding(null);
    try {
      const registratie = await navigator.serviceWorker.ready;
      const abonnement = await registratie.pushManager.getSubscription();
      if (abonnement) {
        await meldToestelAfAction(abonnement.endpoint);
        await abonnement.unsubscribe();
      }
      setStand("uit");
    } catch (fout) {
      setMelding({ fout: `Uitzetten mislukte: ${(fout as Error).message}` });
    }
  }

  if (!vapidPubliek) {
    return (
      <p className="text-sm text-gedempt text-pretty">
        Meldingen zijn nog niet ingesteld. De beheerder moet daar eerst de
        sleutels voor aanmaken.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-pretty">{uitleg(stand)}</p>

        {(stand === "uit" || stand === "aan") && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bezig}
              onClick={() => void (stand === "aan" ? zetUit() : zetAan())}
              className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
                stand === "aan"
                  ? "border border-rand-sterk bg-paneel hover:border-inkt"
                  : "bg-inkt text-linnen hover:bg-inkt-hover"
              }`}
            >
              {stand === "aan"
                ? "Meldingen uitzetten op dit toestel"
                : "Meldingen aanzetten op dit toestel"}
            </button>

            {stand === "aan" && (
              <button
                type="button"
                disabled={bezig}
                onClick={() =>
                  start(async () => setMelding(await proefMeldingAction()))
                }
                className="text-sm text-link underline"
              >
                proefbericht sturen
              </button>
            )}
          </div>
        )}

        {toestellen > 0 && (
          <p className="mt-2 text-xs text-gedempt">
            {toestellen} {toestellen === 1 ? "toestel" : "toestellen"} van jou
            {toestellen === 1 ? " staat" : " staan"} aangemeld.
          </p>
        )}
      </div>

      {keuzes.length > 0 && (
        <div className="border-t border-rand pt-4">
          <p className="bovenschrift mb-2.5">Waarover</p>
          <ul className="flex flex-col gap-2.5">
            {keuzes.map((keuze) => (
              <li key={keuze.soort} className="flex items-start gap-3">
                <input
                  id={`meld-${keuze.soort}`}
                  type="checkbox"
                  defaultChecked={keuze.aan}
                  onChange={(e) => {
                    const aan = e.target.checked;
                    start(async () =>
                      setMelding(await zetVoorkeurAction(keuze.soort, aan)),
                    );
                  }}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--inkt)]"
                />
                <label
                  htmlFor={`meld-${keuze.soort}`}
                  className="min-w-0 cursor-pointer"
                >
                  <span className="block text-sm font-medium">
                    {keuze.titel}
                  </span>
                  <span className="block text-xs text-gedempt text-pretty">
                    {keuze.uitleg}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}

      {melding?.fout && <p className="text-sm text-slecht">{melding.fout}</p>}
      {melding?.gelukt && <p className="text-sm text-goed">{melding.gelukt}</p>}
    </div>
  );
}

function uitleg(stand: Stand): string {
  switch (stand) {
    case "laden":
      return "Even kijken wat dit toestel kan…";
    case "kan-niet":
      return "Deze browser kan geen meldingen ontvangen.";
    case "zet-op-beginscherm":
      return "Op een iPhone werken meldingen alleen als de app op je beginscherm staat. Tik op Deel en dan op “Zet op beginscherm”, open hem daar en zet ze hier aan.";
    case "geweigerd":
      return "Je hebt meldingen voor deze website geweigerd. Dat kan alleen in de instellingen van de browser zelf teruggedraaid worden.";
    case "uit":
      return "Dit toestel krijgt nog geen meldingen.";
    case "aan":
      return "Dit toestel krijgt meldingen.";
  }
}

/**
 * De publieke sleutel komt als base64url binnen; de browser wil er bytes van.
 * Zonder deze omzetting weigert subscribe() met een onbegrijpelijke fout.
 */
function naarBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const opvulling = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + opvulling).replace(/-/g, "+").replace(/_/g, "/");
  const rauw = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(rauw.length));
  for (let i = 0; i < rauw.length; i++) bytes[i] = rauw.charCodeAt(i);
  return bytes;
}
