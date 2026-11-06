import "server-only";
import { begroting } from "./data";
import { tekenBegrotingPdf } from "./begrotingpdfopmaak";

/** De begroting van een jaar als PDF; de opmaak staat in lib/begrotingpdfopmaak.ts. */
export async function begrotingPdf(jaar: number): Promise<Buffer> {
  return tekenBegrotingPdf(jaar, await begroting(jaar));
}
