import type { BegrotingsPost } from "./begroting";

/**
 * Wat er in de PDF van de begroting komt, als platte lijst regels op volgorde. Los van
 * pdfkit gehouden zodat `node --test` het rekenwerk kan nalopen: dezelfde posten en
 * dezelfde bedragen als op het scherm, alleen anders opgeschreven.
 */

export type OverzichtRegel =
  | {
      soort: "post";
      /** 0 voor een hoofdpost, 1 voor een subpost. */
      niveau: 0 | 1;
      naam: string;
      kleur: string;
      begrootCent: number | null;
      besteedCent: number;
    }
  | {
      /** Onderbouwing: een regel die alleen in de begroting bestaat. */
      soort: "onderbouwing";
      niveau: 1 | 2;
      naam: string;
      bedragCent: number;
    };

/** Het begrote bedrag van een hoofdpost: zijn eigen regels plus die van zijn subposten. */
function begrootMetSubs(post: BegrotingsPost): number | null {
  const delen = [post.begrootCent, ...post.subposten.map((s) => s.begrootCent)]
    .filter((cent): cent is number => cent !== null);
  return delen.length === 0 ? null : delen.reduce((som, c) => som + c, 0);
}

function onderbouwing(post: BegrotingsPost, niveau: 1 | 2): OverzichtRegel[] {
  return post.regels
    .filter((regel) => regel.naam !== null)
    .map((regel) => ({
      soort: "onderbouwing" as const,
      niveau,
      naam: regel.naam?.trim() || "(zonder naam)",
      bedragCent: regel.bedragCent,
    }));
}

/**
 * De regels van het overzicht. Alleen wat dit jaar meedoet -- net als het scherm met
 * "Alle posten tonen" uit -- zodat een post die je uit dit jaar haalde er ook in de
 * PDF niet in staat.
 */
export function overzichtRegels(posten: readonly BegrotingsPost[]): OverzichtRegel[] {
  const regels: OverzichtRegel[] = [];
  for (const post of posten) {
    if (!post.inGebruik) continue;
    regels.push({
      soort: "post",
      niveau: 0,
      naam: post.naam,
      kleur: post.kleur,
      begrootCent: begrootMetSubs(post),
      besteedCent: post.werkelijkCent,
    });
    regels.push(...onderbouwing(post, 1));
    for (const sub of post.subposten) {
      if (!sub.inGebruik) continue;
      regels.push({
        soort: "post",
        niveau: 1,
        naam: sub.naam,
        kleur: sub.kleur,
        begrootCent: sub.begrootCent,
        besteedCent: sub.werkelijkCent,
      });
      regels.push(...onderbouwing(sub, 2));
    }
  }
  return regels;
}

/** De totalen bovenaan, op dezelfde manier geteld als de donkere tegel op het scherm. */
export function overzichtTotalen(posten: readonly BegrotingsPost[]): {
  begrootCent: number;
  besteedCent: number;
} {
  let begrootCent = 0;
  let besteedCent = 0;
  const loop = (lijst: readonly BegrotingsPost[]) => {
    for (const post of lijst) {
      if (post.begrootCent !== null) begrootCent += post.begrootCent;
      // Eigen bedragen, niet de opgetelde: anders telt een subpost dubbel.
      besteedCent += post.eigenCent;
      loop(post.subposten);
    }
  };
  loop(posten);
  return { begrootCent, besteedCent };
}
