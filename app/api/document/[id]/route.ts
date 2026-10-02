import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, documents } from "@/db";
import { huidigeGebruiker } from "@/lib/auth";
import { leesBestand } from "@/lib/opslag";

/**
 * Serveert een geüpload document -- bon, factuur of voorbeeld -- aan een ingelogde
 * gebruiker. De bestanden zelf staan privé op Vercel Blob, dus de kale URL ernaartoe
 * is zonder het schrijftoken niet meer te openen; deze route is de enige weg naar
 * binnen, en die vraagt een sessie voordat hij de inhoud doorgeeft.
 * Met `?voorbeeld=1` gaat het om de verkleinde kopie in plaats van het origineel.
 */
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/document/[id]">,
): Promise<NextResponse> {
  if (!(await huidigeGebruiker())) {
    return NextResponse.json({ fout: "Niet ingelogd" }, { status: 401 });
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ fout: "Ongeldig document" }, { status: 400 });
  }

  const [rij] = await db
    .select({
      naam: documents.naam,
      mime: documents.mime,
      url: documents.url,
      voorbeeldUrl: documents.voorbeeldUrl,
    })
    .from(documents)
    .where(eq(documents.id, id));
  if (!rij) {
    return NextResponse.json({ fout: "Niet gevonden" }, { status: 404 });
  }

  const voorbeeld = new URL(request.url).searchParams.get("voorbeeld") === "1";
  const url = voorbeeld ? rij.voorbeeldUrl : rij.url;
  if (!url) {
    return NextResponse.json({ fout: "Niet gevonden" }, { status: 404 });
  }

  const inhoud = await leesBestand(url);
  if (!inhoud) {
    return NextResponse.json({ fout: "Niet gevonden" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(inhoud), {
    headers: {
      // Het voorbeeld is altijd de verkleinde JPEG uit `maakVoorbeeld`.
      "content-type": voorbeeld ? "image/jpeg" : rij.mime,
      "cache-control": "private, max-age=3600",
      "content-disposition": `inline; filename="${encodeURIComponent(rij.naam)}"`,
    },
  });
}
