import Image from "next/image";

/**
 * Eén weergave voor elk bewaard bestand. Is er een verkleinde kopie, dan zie je die;
 * anders een tegel met het documenttype, zodat een PDF er niet uitziet als een
 * mislukte upload.
 */
export default function BestandTegel({
  naam,
  mime,
  voorbeeldUrl,
  zijde,
}: {
  naam: string;
  mime: string;
  voorbeeldUrl: string | null;
  /** Hoogte en breedte in pixels; de tegel is vierkant. */
  zijde: number;
}) {
  if (voorbeeldUrl) {
    return (
      <Image
        src={voorbeeldUrl}
        alt={naam}
        width={zijde}
        height={zijde}
        unoptimized
        style={{ width: zijde, height: zijde }}
        className="rounded-lg border border-rand object-cover"
      />
    );
  }

  const soort = soortVan(naam, mime);

  return (
    <span
      style={{ width: zijde, height: zijde }}
      className="flex flex-col items-center justify-center gap-1 rounded-xl border border-rand bg-verzonken"
      title={naam}
    >
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        style={{ width: zijde * 0.34, height: zijde * 0.34 }}
        className="text-gedempt"
      >
        {/* Blad met omgevouwen hoek. */}
        <path
          d="M6 2h7l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M13 2v5h5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="font-medium tracking-wide text-gedempt uppercase"
        style={{ fontSize: Math.max(9, zijde * 0.11) }}
      >
        {soort}
      </span>
    </span>
  );
}

const MIME_SOORTEN: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/csv": "csv",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
};

/** De extensie zegt meestal meer dan het mimetype; dat laatste is het vangnet. */
function soortVan(naam: string, mime: string): string {
  const extensie = naam.includes(".")
    ? (naam.split(".").pop() ?? "").toLowerCase()
    : "";
  if (extensie && extensie.length <= 4) return extensie;
  return MIME_SOORTEN[mime] ?? "bestand";
}
