/**
 * De rekenregels van de begroting, los van database en React zodat ze met
 * `node --test` te draaien zijn -- dezelfde opzet als lib/reservering.ts en
 * lib/meldingregels.ts.
 *
 * Een post wordt op twee manieren onderverdeeld, en het verschil is één ding:
 *
 * - Een **subpost** is een echte post. Je kunt er bonnen op boeken en later zien wat
 *   eraan is uitgegeven.
 * - Een **begrotingsregel** bestaat alleen hier. Hij laat zien hoe je aan een bedrag
 *   komt en verschijnt nergens als categorie.
 */

/**
 * Een rij uit `budgets`. `naam === null` is het losse bedrag van de post; staat er
 * iets in -- ook een lege string -- dan is het een begrotingsregel.
 */
export type PostRegel = {
  id: number;
  naam: string | null;
  bedragCent: number;
  volgorde: number;
};

/** Heeft deze post een onderbouwing, of staat er alleen een los bedrag? */
export function heeftRegels(rijen: readonly PostRegel[]): boolean {
  return rijen.some((rij) => rij.naam !== null);
}

/**
 * Wat er voor deze post begroot staat. `null` betekent "niet begroot", en dat is iets
 * anders dan nul: een post waar je bewust 0 voor uittrekt hoort niet te lezen als een
 * post waar je nog niet over hebt nagedacht.
 *
 * Zijn er regels, dan tellen alleen die mee. Een losse rij die is blijven staan wordt
 * dus genegeerd in plaats van erbij opgeteld -- zo kan een half afgebroken bewerking
 * nooit een bedrag verzinnen, en heelt de boel zichzelf.
 */
export function bedragVanPost(rijen: readonly PostRegel[]): number | null {
  if (rijen.length === 0) return null;
  const regels = rijen.filter((rij) => rij.naam !== null);
  if (regels.length > 0) {
    return regels.reduce((som, rij) => som + rij.bedragCent, 0);
  }
  return rijen.reduce((som, rij) => som + rij.bedragCent, 0);
}

/** De rijen zoals ze op het scherm horen te staan. */
export function opVolgorde(rijen: readonly PostRegel[]): PostRegel[] {
  return [...rijen].sort((a, b) => a.volgorde - b.volgorde || a.id - b.id);
}

export type BegrotingsPost = {
  id: number;
  naam: string;
  kleur: string;
  actief: boolean;
  /** Null voor een hoofdpost. */
  ouderId: number | null;
  /** De rijen van dit jaar, op volgorde. */
  regels: PostRegel[];
  /** De som van `regels`; null als er niets staat. */
  begrootCent: number | null;
  /** Alleen wat rechtstreeks op deze post is geboekt. */
  eigenCent: number;
  /** Inclusief de subposten eronder; voor een subpost gelijk aan `eigenCent`. */
  werkelijkCent: number;
  /**
   * Doet deze post dit jaar mee: er staat een bedrag voor, er is op geboekt, of een
   * subpost eronder doet mee. Een post die je pas volgend jaar gaat gebruiken hoort
   * niet in het overzicht van dit jaar te staan.
   */
  inGebruik: boolean;
  subposten: BegrotingsPost[];
};

type RuwePost = {
  id: number;
  naam: string;
  kleur: string;
  actief: boolean;
  ouderId: number | null;
};

/**
 * De hoofdposten met hun subposten eronder, elk met wat ervoor begroot staat en wat
 * er werkelijk is uitgegeven.
 */
export function bouwBoom(
  posten: readonly RuwePost[],
  regelsPerPost: ReadonlyMap<number, PostRegel[]>,
  eigenPerPost: ReadonlyMap<number, number>,
): BegrotingsPost[] {
  function maakPost(post: RuwePost): BegrotingsPost {
    const subposten = posten
      .filter((p) => p.ouderId === post.id)
      .map((p) => maakPost(p));
    const regels = opVolgorde(regelsPerPost.get(post.id) ?? []);
    const eigenCent = eigenPerPost.get(post.id) ?? 0;
    const begrootCent = bedragVanPost(regels);
    return {
      id: post.id,
      naam: post.naam,
      kleur: post.kleur,
      actief: post.actief,
      ouderId: post.ouderId,
      regels,
      begrootCent,
      eigenCent,
      werkelijkCent:
        eigenCent + subposten.reduce((som, s) => som + s.werkelijkCent, 0),
      inGebruik:
        begrootCent !== null ||
        eigenCent > 0 ||
        subposten.some((sub) => sub.inGebruik),
      subposten,
    };
  }

  return posten.filter((p) => p.ouderId === null).map((p) => maakPost(p));
}

/** Zo min mogelijk eisen, zodat ook een verrijkte rij uit het dashboard erin past. */
type MetSubposten = {
  begrootCent: number | null;
  subposten: MetSubposten[];
};

/** Begroot op deze post plus alles wat eronder hangt; null als nergens iets staat. */
export function totaalBegroot(post: MetSubposten): number | null {
  const delen = [
    post.begrootCent,
    ...post.subposten.map((sub) => totaalBegroot(sub)),
  ].filter((cent): cent is number => cent !== null);
  return delen.length === 0 ? null : delen.reduce((som, cent) => som + cent, 0);
}
