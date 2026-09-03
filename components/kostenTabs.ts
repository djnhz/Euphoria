/**
 * De drie tabbladen van Kosten. Ze zijn geen apart menu-item meer: uitgaven,
 * begroting en verrekening gaan alle drie over hetzelfde geld en horen dus achter
 * één plek in de onderbalk.
 */
export const KOSTEN_TABS = [
  { href: "/uitgaven", label: "Uitgaven" },
  { href: "/begroting", label: "Begroting" },
  { href: "/verrekening", label: "Verrekening" },
] as const;
