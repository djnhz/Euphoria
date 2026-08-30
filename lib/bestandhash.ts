/**
 * Vingerafdruk van een bestand, om te herkennen dat dezelfde bon al is ingeladen.
 *
 * De browser rekent hem uit, zodat een dubbele bon opvalt vóór het uploaden en niet
 * pas erna. Dat betekent ook dat de waarde van de client komt en dus niet te
 * vertrouwen is; hij dient alleen om te waarschuwen, nooit om iets af te schermen.
 */
export async function bestandHash(bestand: Blob): Promise<string | null> {
  // `crypto.subtle` bestaat alleen op https en localhost. Op een gewoon http-adres
  // in het huisnetwerk is er dus geen hash, en dan slaan we de controle over in
  // plaats van het uploaden te blokkeren.
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  try {
    const ruw = await crypto.subtle.digest("SHA-256", await bestand.arrayBuffer());
    return [...new Uint8Array(ruw)]
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}
