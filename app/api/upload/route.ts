import { NextResponse } from "next/server";
import { huidigeGebruiker } from "@/lib/auth";
import { bewaarBestand, heeftBlob } from "@/lib/opslag";

/**
 * Ontvangstpunt voor uploads als er geen Vercel Blob is aangesloten. Met Blob gaat de
 * browser er rechtstreeks heen via /api/blob; dat omzeilt de limiet van 4,5 MB op wat
 * een server mag ontvangen, en die route blijft dus de weg voor productie.
 */
export async function POST(request: Request): Promise<NextResponse> {
  const gebruiker = await huidigeGebruiker();
  if (!gebruiker) {
    return NextResponse.json({ fout: "Niet ingelogd" }, { status: 401 });
  }
  if (heeftBlob()) {
    return NextResponse.json(
      { fout: "Blob is aangesloten; gebruik /api/blob." },
      { status: 400 },
    );
  }

  const formulier = await request.formData();
  const bestand = formulier.get("bestand");
  if (!(bestand instanceof File)) {
    return NextResponse.json({ fout: "Geen bestand ontvangen" }, { status: 400 });
  }

  const bewaard = await bewaarBestand(
    bestand.name,
    bestand.type || "application/octet-stream",
    Buffer.from(await bestand.arrayBuffer()),
  );
  return NextResponse.json(bewaard);
}
