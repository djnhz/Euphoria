"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

/**
 * Of er op dit scherm iets is ingevuld dat nog niet is opgeslagen. De kop van een
 * pagina en het formulier eronder zijn aparte stukken, dus dit is de brug ertussen:
 * het formulier meldt, de kop leest. Zo staat er "Annuleren" alleen als er echt iets
 * weg te gooien valt, en anders "Terug".
 */
const Context = createContext<{ vuil: boolean; zet: (vuil: boolean) => void }>({
  vuil: false,
  zet: () => {},
});

export function WijzigingenProvider({ children }: { children: ReactNode }) {
  const [vuil, zet] = useState(false);
  return <Context value={{ vuil, zet }}>{children}</Context>;
}

export function useVuil(): boolean {
  return useContext(Context).vuil;
}

/** Voor het formulier: meld of er niet-opgeslagen wijzigingen zijn. */
export function useMeldWijzigingen(vuil: boolean) {
  const { zet } = useContext(Context);
  useEffect(() => {
    zet(vuil);
    return () => zet(false);
  }, [vuil, zet]);
}
