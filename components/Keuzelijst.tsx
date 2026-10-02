"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";

export type Optie<T extends string | number> = {
  waarde: T;
  label: string;
  /** Een tweede, kleinere regel: wat deze keuze doet. */
  uitleg?: string;
  /** Een kleurblokje, voor een post. */
  kleur?: string;
  /** Een subpost: staat ingesprongen onder de optie ervoor. */
  inspringen?: boolean;
};

/**
 * Een keuzelijst in huisstijl. Vervangt de gewone `select`, waarvan de lijst die
 * opengaat van het besturingssysteem is: blauw geselecteerd, grijs lettertype, niets
 * dat bij de rest van de app past, en per toestel anders.
 *
 * Op een laptop een lijst onder het veld; op een telefoon een blad van onderen met
 * grote rijen, want met een duim mik je daar beter dan op een rij van veertig
 * pixels in een vliegend uitklapmenu. Beide hebben dezelfde opmaak: de gekozen
 * optie in marine-tint met een vinkje, een kleurblokje waar een post een kleur heeft.
 *
 * Toetsenbord volgens het listbox-patroon: pijltjes, Home en End, Enter en spatie
 * kiezen, Escape sluit en zet de focus terug, en een letter springt naar de eerste
 * optie die ermee begint.
 */
export default function Keuzelijst<T extends string | number>({
  label,
  waarde,
  opties,
  onKies,
  variant = "veld",
  breed = true,
  voorvoegsel,
  gekozen,
  placeholder = "Kies…",
  className = "",
}: {
  /** De naam voor schermlezers, en de kop van het blad op een telefoon. */
  label: string;
  waarde: T;
  opties: readonly Optie<T>[];
  onKies: (waarde: T) => void;
  /** `veld` voor in een formulier, `pil` voor de filterbalk. */
  variant?: "veld" | "pil";
  /** Het hele vak vullen; uit voor een keuzelijst die zijn inhoud volgt. */
  breed?: boolean;
  /** Een klein woord voor de keuze, zodat een pil zegt wat hij regelt. */
  voorvoegsel?: string;
  /** Bij een pil: wijkt de keuze af van de standaard? Dan kleurt hij donker. */
  gekozen?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const [open, zetOpen] = useState(false);
  const [actief, zetActief] = useState(0);
  const [plek, zetPlek] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    breedte: number;
    maxHoogte: number;
  } | null>(null);

  const knop = useRef<HTMLButtonElement>(null);
  const lijst = useRef<HTMLDivElement>(null);
  const typ = useRef({ tekst: "", tijd: 0 });
  const breedScherm = useSyncExternalStore(
    (herteken) => {
      const vraag = window.matchMedia("(min-width: 640px)");
      vraag.addEventListener("change", herteken);
      return () => vraag.removeEventListener("change", herteken);
    },
    () => window.matchMedia("(min-width: 640px)").matches,
    () => true,
  );

  const gekozenIndex = opties.findIndex((o) => o.waarde === waarde);
  const gekozenOptie = gekozenIndex >= 0 ? opties[gekozenIndex] : undefined;

  const sluit = useCallback((focusTerug = true) => {
    zetOpen(false);
    if (focusTerug) knop.current?.focus();
  }, []);

  const kies = useCallback(
    (index: number) => {
      const optie = opties[index];
      if (optie) onKies(optie.waarde);
      sluit();
    },
    [opties, onKies, sluit],
  );

  /**
   * Het veld meten en de lijst eronder zetten, of erboven als daaronder geen plek is.
   * Vast gepositioneerd in plaats van in het veld zelf: de filterbalk schuift opzij en
   * zou een lijst die eraan hangt gewoon afknippen.
   */
  const meet = useCallback(() => {
    const doos = knop.current?.getBoundingClientRect();
    if (!doos) return;
    const marge = 8;
    const ruimteOnder = window.innerHeight - doos.bottom - marge;
    const ruimteBoven = doos.top - marge;
    const naarBoven = ruimteOnder < 220 && ruimteBoven > ruimteOnder;
    const breedte = Math.max(doos.width, 280);
    zetPlek({
      left: Math.max(
        marge,
        Math.min(doos.left, window.innerWidth - breedte - marge),
      ),
      breedte,
      maxHoogte: Math.min(340, (naarBoven ? ruimteBoven : ruimteOnder) - 6),
      ...(naarBoven
        ? { bottom: window.innerHeight - doos.top + 6 }
        : { top: doos.bottom + 6 }),
    });
  }, []);

  function openen() {
    zetActief(Math.max(0, gekozenIndex));
    meet();
    zetOpen(true);
  }

  // Meebewegen als het scherm verandert of er onder de lijst gescrold wordt.
  useEffect(() => {
    if (!open || !breedScherm) return;
    window.addEventListener("resize", meet);
    window.addEventListener("scroll", meet, true);
    return () => {
      window.removeEventListener("resize", meet);
      window.removeEventListener("scroll", meet, true);
    };
  }, [open, breedScherm, meet]);

  // De lijst krijgt de focus, zodat het toetsenbord er meteen in werkt.
  useEffect(() => {
    if (open) lijst.current?.focus({ preventScroll: true });
  }, [open, plek]);

  // De actieve optie in beeld houden bij pijltjes en bij het openen.
  useEffect(() => {
    if (!open) return;
    document
      .getElementById(`${id}-${actief}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [open, actief, id]);

  useEffect(() => {
    if (!open) return;
    const buiten = (e: MouseEvent) => {
      const doel = e.target as Node;
      if (lijst.current?.contains(doel) || knop.current?.contains(doel)) return;
      sluit(false);
    };
    document.addEventListener("mousedown", buiten);
    return () => document.removeEventListener("mousedown", buiten);
  }, [open, sluit]);

  function toets(e: React.KeyboardEvent) {
    const laatste = opties.length - 1;
    // Alles behalve een letter begint het typen opnieuw: na een pijl telt een letter
    // van daarvoor niet meer mee.
    if (e.key.length !== 1) typ.current.tekst = "";
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        zetActief((i) => Math.min(laatste, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        zetActief((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        zetActief(0);
        break;
      case "End":
        e.preventDefault();
        zetActief(laatste);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        kies(actief);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        sluit();
        break;
      case "Tab":
        sluit(false);
        break;
      default: {
        // Een of meer letters achter elkaar springen naar de eerste optie die zo begint.
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        const nu = Date.now();
        typ.current.tekst =
          nu - typ.current.tijd > 700
            ? e.key.toLowerCase()
            : typ.current.tekst + e.key.toLowerCase();
        typ.current.tijd = nu;
        const treffer = opties.findIndex((o) =>
          o.label.toLowerCase().startsWith(typ.current.tekst),
        );
        if (treffer >= 0) zetActief(treffer);
      }
    }
  }

  const tekst = gekozenOptie?.label ?? placeholder;
  const pil = variant === "pil";

  return (
    <>
      <button
        ref={knop}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => (open ? sluit(false) : openen())}
        onKeyDown={(e) => {
          if (["ArrowDown", "ArrowUp"].includes(e.key)) {
            e.preventDefault();
            openen();
          }
        }}
        className={`group flex items-center justify-between gap-2 text-left transition ${
          pil
            ? `min-h-10 shrink-0 rounded-full px-3.5 text-xs whitespace-nowrap ${
                gekozen
                  ? "bg-inkt font-semibold text-linnen"
                  : "border border-rand-sterk bg-paneel text-inkt hover:border-inkt"
              }`
            : `min-h-11 rounded-xl border bg-paneel px-3.5 text-sm hover:border-inkt ${
                open ? "border-inkt" : "border-rand-sterk"
              } ${breed ? "w-full" : ""}`
        } ${className}`}
      >
        <span className="flex min-w-0 items-center gap-2">
          {voorvoegsel && (
            <span
              className={
                gekozen ? "font-normal text-linnen/70" : "text-gedempt"
              }
            >
              {voorvoegsel}
            </span>
          )}
          {gekozenOptie?.kleur && (
            <span
              aria-hidden
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: gekozenOptie.kleur }}
            />
          )}
          <span className={`truncate ${gekozenOptie ? "" : "text-gedempt"}`}>
            {tekst}
          </span>
        </span>
        <Chevron open={open} />
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60]">
            {/* Op een telefoon dimt de achtergrond en sluit een tik ernaast het blad. */}
            {!breedScherm && (
              <div
                aria-hidden
                className="absolute inset-0 bg-inkt-diep/45"
                onMouseDown={() => sluit(false)}
              />
            )}
            <div
              ref={lijst}
              id={`${id}-lijst`}
              role="listbox"
              aria-label={label}
              aria-activedescendant={`${id}-${actief}`}
              tabIndex={-1}
              onKeyDown={toets}
              style={
                breedScherm && plek
                  ? {
                      left: plek.left,
                      width: plek.breedte,
                      top: plek.top,
                      bottom: plek.bottom,
                      maxHeight: plek.maxHoogte,
                      visibility: "visible",
                    }
                  : undefined
              }
              className={
                breedScherm
                  ? "schuif absolute overflow-auto rounded-xl border border-rand-sterk bg-paneel p-1 shadow-[0_18px_40px_-18px_rgba(22,40,63,0.45)] outline-none"
                  : "absolute inset-x-0 bottom-0 flex max-h-[75vh] flex-col rounded-t-3xl bg-paneel pb-[env(safe-area-inset-bottom)] outline-none"
              }
            >
              {!breedScherm && (
                <div className="flex items-center justify-between gap-3 border-b border-rand px-[18px] py-3.5">
                  <span className="titel text-lg">{label}</span>
                  <button
                    type="button"
                    onClick={() => sluit()}
                    className="min-h-11 text-[15px] text-gedempt"
                  >
                    Sluiten
                  </button>
                </div>
              )}
              <div
                className={
                  breedScherm ? "" : "schuif flex-1 overflow-auto p-2 pb-3"
                }
              >
                {opties.map((optie, index) => {
                  const aan = optie.waarde === waarde;
                  const nu = index === actief;
                  return (
                    <div
                      key={String(optie.waarde)}
                      id={`${id}-${index}`}
                      role="option"
                      aria-selected={aan}
                      onClick={() => kies(index)}
                      onMouseMove={() => zetActief(index)}
                      className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-3 ${
                        breedScherm
                          ? "min-h-10 py-2 text-sm"
                          : "min-h-12 py-2.5 text-[15px]"
                      } ${optie.inspringen ? "pl-8" : ""} ${
                        aan
                          ? "bg-marine-tint font-semibold"
                          : nu
                            ? "bg-verzonken"
                            : ""
                      }`}
                    >
                      {optie.kleur && (
                        <span
                          aria-hidden
                          className="h-2.5 w-2.5 shrink-0 rounded-sm"
                          style={{ background: optie.kleur }}
                        />
                      )}
                      <span className="min-w-0 flex-1">
                        <span
                          className={`block text-pretty ${
                            optie.inspringen && !aan ? "text-tekst/80" : ""
                          }`}
                        >
                          {optie.label}
                        </span>
                        {optie.uitleg && (
                          <span className="block text-[11.5px] font-normal text-gedempt">
                            {optie.uitleg}
                          </span>
                        )}
                      </span>
                      {aan && <Vinkje />}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 12 12"
      width="11"
      height="11"
      aria-hidden
      className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
    >
      <path
        d="M2.5 4.5 6 8l3.5-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Vinkje() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M3.5 8.5 6.5 11.5 12.5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
