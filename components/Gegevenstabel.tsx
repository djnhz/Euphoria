import type { ReactNode } from "react";

/**
 * Een kolom van de tabel. `titel` markeert de kolom die op een telefoon de kop van
 * het kaartje wordt; de rest komt daaronder als label met waarde.
 */
export type Kolom<T> = {
  kop: string;
  cel: (rij: T) => ReactNode;
  /** Bedragen rechts uitlijnen, zoals in een echte tabel. */
  rechts?: boolean;
  titel?: boolean;
  /** Alleen op de kaart weglaten, bijvoorbeeld omdat het al in de kop staat. */
  verbergOpKaart?: boolean;
};

/**
 * Een tabel die op een telefoon geen tabel is.
 *
 * Horizontaal scrollen werkt wel maar leest niet: je ziet nooit een hele regel in
 * een keer. Vanaf `sm` staat er daarom een gewone tabel, en daaronder wordt elke rij
 * een kaartje met de kolomkoppen als labels ernaast.
 */
export default function Gegevenstabel<T>({
  kolommen,
  rijen,
  sleutel,
  leeg = "Niets gevonden.",
}: {
  kolommen: Kolom<T>[];
  rijen: T[];
  sleutel: (rij: T) => string | number;
  leeg?: string;
}) {
  if (rijen.length === 0) {
    return <p className="p-4 text-sm text-gedempt">{leeg}</p>;
  }

  const titelKolom = kolommen.find((kolom) => kolom.titel);
  const opKaart = kolommen.filter(
    (kolom) => !kolom.titel && !kolom.verbergOpKaart,
  );

  return (
    <>
      <table className="hidden w-full text-sm sm:table">
        <thead className="border-y border-rand text-left text-gedempt">
          <tr>
            {kolommen.map((kolom) => (
              <th
                key={kolom.kop}
                className={`p-3 font-normal ${kolom.rechts ? "text-right" : ""}`}
              >
                {kolom.kop}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rijen.map((rij) => (
            <tr key={sleutel(rij)} className="border-b border-rand last:border-0">
              {kolommen.map((kolom) => (
                <td
                  key={kolom.kop}
                  className={`p-3 ${kolom.rechts ? "text-right" : ""}`}
                >
                  {kolom.cel(rij)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <ul className="flex flex-col sm:hidden">
        {rijen.map((rij) => (
          <li
            key={sleutel(rij)}
            className="flex flex-col gap-1 border-t border-rand p-4"
          >
            {titelKolom && (
              <div className="font-medium">{titelKolom.cel(rij)}</div>
            )}
            {opKaart.map((kolom) => (
              <div key={kolom.kop} className="flex items-baseline gap-3 text-sm">
                <span className="shrink-0 text-gedempt">{kolom.kop}</span>
                <span className="ml-auto min-w-0 text-right">
                  {kolom.cel(rij)}
                </span>
              </div>
            ))}
          </li>
        ))}
      </ul>
    </>
  );
}
