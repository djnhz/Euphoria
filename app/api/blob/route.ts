import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { huidigeGebruiker } from "@/lib/auth";

/**
 * De browser uploadt rechtstreeks naar Blob. Dat omzeilt de limiet van 4,5 MB op
 * server actions, waardoor een foto op volledige resolutie gewoon binnenkomt.
 */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

const TOEGESTAAN = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  try {
    const antwoord = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async () => {
        // Zonder deze controle kan iedereen die de route kent bestanden neerzetten.
        const gebruiker = await huidigeGebruiker();
        if (!gebruiker) throw new Error("Niet ingelogd");
        return {
          allowedContentTypes: TOEGESTAAN,
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
      // Draait op de servers van Vercel en dus niet op localhost. De databaserij
      // wordt daarom vanuit de client-actie geschreven, niet hier.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(antwoord);
  } catch (fout) {
    return NextResponse.json(
      { error: (fout as Error).message },
      { status: 400 },
    );
  }
}
