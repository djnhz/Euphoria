import { redirect } from "next/navigation";
import { huidigeGebruiker } from "@/lib/auth";
import Nav from "@/components/Nav";

/**
 * Elke pagina hier hangt aan de sessiecookie, dus er valt niets vooraf te renderen.
 * Zonder dit probeert de build het toch, en dan wordt een ontbrekende omgevingsvariabele
 * een mislukte build in plaats van een duidelijke melding op het scherm.
 */
export const dynamic = "force-dynamic";

/**
 * Deze layout beschermt elke pagina in de groep. Server actions vallen er niet onder
 * en roepen daarom zelf `vereisGebruiker()` aan.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const gebruiker = await huidigeGebruiker();
  if (!gebruiker) redirect("/login");

  return (
    <>
      <Nav
        naam={gebruiker.naam}
        huishouden={gebruiker.coupleNaam}
        beheerder={gebruiker.beheerder}
      />
      {/* De onderbalk zweeft over de pagina, dus onderaan ruimte houden -- anders
          valt de laatste regel of knop eronder. */}
      <main className="mx-auto w-full max-w-5xl flex-1 pb-[calc(96px+env(safe-area-inset-bottom))]">
        {children}
      </main>
    </>
  );
}
