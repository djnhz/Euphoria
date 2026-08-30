"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { registreerDocumentAction } from "@/app/(app)/documenten/actions";
import { MAPPEN, type DocumentMap } from "@/lib/mappen";

export default function DocumentUpload() {
  const router = useRouter();
  const [map, setMap] = useState<DocumentMap>("overig");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState<string | null>(null);

  async function verwerk(bestanden: FileList) {
    setBezig(true);
    setFout(null);
    try {
      for (const bestand of Array.from(bestanden)) {
        const blob = await upload(bestand.name, bestand, {
          access: "public",
          handleUploadUrl: "/api/blob",
        });
        await registreerDocumentAction({
          url: blob.url,
          naam: bestand.name,
          mime: bestand.type || "application/octet-stream",
          grootteBytes: bestand.size,
          map,
          expenseId: null,
        });
      }
      router.refresh();
    } catch (e) {
      setFout((e as Error).message);
    } finally {
      setBezig(false);
    }
  }

  return (
    <section className="rounded-xl border border-rand bg-paneel p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-gedempt">Map</span>
          <select
            value={map}
            onChange={(e) =>
              setMap(e.target.value as DocumentMap)
            }
            className="rounded-lg border border-rand bg-achtergrond px-3 py-2 text-sm"
          >
            {MAPPEN.map((naam) => (
              <option key={naam} value={naam}>
                {naam}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="text-gedempt">Bestanden</span>
          <input
            type="file"
            multiple
            disabled={bezig}
            onChange={(e) => {
              if (e.target.files?.length) void verwerk(e.target.files);
              e.target.value = "";
            }}
            className="text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:text-white"
          />
        </label>
      </div>
      {bezig && <p className="mt-3 text-sm text-gedempt">Uploaden…</p>}
      {fout && <p className="mt-3 text-sm text-slecht">{fout}</p>}
    </section>
  );
}
