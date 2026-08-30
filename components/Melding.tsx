import type { MeldingState } from "@/app/(app)/instellingen/actions";

export default function Melding({ state }: { state: MeldingState }) {
  if (!state) return null;
  if (state.fout) return <p className="w-full text-sm text-slecht">{state.fout}</p>;
  if (state.gelukt) return <p className="w-full text-sm text-goed">{state.gelukt}</p>;
  return null;
}
