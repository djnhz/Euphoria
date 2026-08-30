/**
 * Verdelen en saldo. Bewust vrij van database- en React-imports zodat
 * `node --test test/split.test.ts` dit rechtstreeks kan draaien.
 */

/** Hoe een bedrag over de twee huishoudens valt. Som van de delen is exact het bedrag. */
export function verdeelRegel(
  bedragCent: number,
  aandeelAPct: number,
): { deelA: number; deelB: number } {
  const pct = Math.min(100, Math.max(0, Math.round(aandeelAPct)));
  const deelA = Math.round((bedragCent * pct) / 100);
  // Rest in plaats van een tweede afronding: zo lekt er nooit een cent weg.
  return { deelA, deelB: bedragCent - deelA };
}

export type SaldoRegel = {
  bedragCent: number;
  aandeelAPct: number;
  /** Heeft huishouden A (volgorde 1) deze uitgave voorgeschoten? */
  betaaldDoorA: boolean;
};

/**
 * Positief: huishouden B moet dit bedrag nog aan A betalen.
 * Negatief: A moet het aan B betalen.
 */
export function saldoCent(regels: readonly SaldoRegel[]): number {
  let saldo = 0;
  for (const regel of regels) {
    const { deelA, deelB } = verdeelRegel(regel.bedragCent, regel.aandeelAPct);
    saldo += regel.betaaldDoorA ? deelB : -deelA;
  }
  return saldo;
}

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function formatEuro(cent: number): string {
  return euro.format(cent / 100);
}

/** "12,34" of "12" naar centen. Geeft null bij onzin. */
export function parseEuro(invoer: string): number | null {
  const schoon = invoer.trim().replace(/[^\d,.-]/g, "").replace(",", ".");
  if (schoon === "" || schoon === "-") return null;
  const waarde = Number(schoon);
  if (!Number.isFinite(waarde)) return null;
  return Math.round(waarde * 100);
}

export type VerrekenRegel = SaldoRegel;

export type Verrekening = {
  /** Wat elk huishouden daadwerkelijk heeft voorgeschoten. */
  voorgeschotenA: number;
  voorgeschotenB: number;
  /** Wat elk huishouden volgens de verdeelsleutels hoort te dragen. */
  aandeelA: number;
  aandeelB: number;
  /** Positief: B moet dit aan A betalen. Negatief: andersom. */
  saldo: number;
  totaal: number;
};

/**
 * Voorgeschoten min eigen aandeel is per definitie hetzelfde getal als `saldoCent`;
 * die gelijkheid is de kern van de verrekening en staat in de test.
 */
export function verrekening(regels: readonly VerrekenRegel[]): Verrekening {
  let voorgeschotenA = 0;
  let voorgeschotenB = 0;
  let aandeelA = 0;
  let aandeelB = 0;

  for (const regel of regels) {
    const { deelA, deelB } = verdeelRegel(regel.bedragCent, regel.aandeelAPct);
    aandeelA += deelA;
    aandeelB += deelB;
    if (regel.betaaldDoorA) voorgeschotenA += regel.bedragCent;
    else voorgeschotenB += regel.bedragCent;
  }

  return {
    voorgeschotenA,
    voorgeschotenB,
    aandeelA,
    aandeelB,
    saldo: voorgeschotenA - aandeelA,
    totaal: voorgeschotenA + voorgeschotenB,
  };
}
