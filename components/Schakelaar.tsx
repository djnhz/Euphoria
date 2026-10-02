import type { ReactNode } from "react";

/**
 * Een aan/uit-schakelaar in huisstijl, voor instellingen die meteen gelden. Onder de
 * motorkap is het een gewoon selectievakje, dus toetsenbord en schermlezer werken
 * zoals ze moeten; het ronde knopje is er alleen omheen getekend.
 */
export default function Schakelaar({
  children,
  checked,
  defaultChecked,
  onChange,
  className = "",
}: {
  children: ReactNode;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange: (aan: boolean) => void;
  className?: string;
}) {
  return (
    <label
      className={`flex min-h-11 cursor-pointer items-center gap-2.5 text-xs text-gedempt lg:min-h-0 ${className}`}
    >
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        defaultChecked={defaultChecked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-5 w-9 shrink-0 rounded-full bg-[rgba(22,40,63,0.28)] transition-colors after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-paneel after:shadow-sm after:transition-transform peer-checked:bg-inkt peer-checked:after:translate-x-4 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-marine"
      />
      <span className="min-w-0">{children}</span>
    </label>
  );
}
