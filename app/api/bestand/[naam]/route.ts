import { NextResponse } from "next/server";
import { huidigeGebruiker } from "@/lib/auth";
import { leesLokaal } from "@/lib/opslag";

/** Serveert lokaal bewaarde uploads. Alleen voor ingelogde gebruikers. */
export async function GET(
  _request: Request,
  { params }: RouteContext<"/api/bestand/[naam]">,
): Promise<NextResponse> {
  if (!(await huidigeGebruiker())) {
    return NextResponse.json({ fout: "Niet ingelogd" }, { status: 401 });
  }

  const { naam } = await params;
  const inhoud = await leesLokaal(naam);
  if (!inhoud) {
    return NextResponse.json({ fout: "Niet gevonden" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(inhoud), {
    headers: {
      "content-type": mimeVoor(naam),
      // Privé: dit zijn bonnen, geen publieke bestanden.
      "cache-control": "private, max-age=3600",
      "content-disposition": "inline",
    },
  });
}

const MIMES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
};

function mimeVoor(naam: string): string {
  const extensie = naam.split(".").pop()?.toLowerCase() ?? "";
  return MIMES[extensie] ?? "application/octet-stream";
}
