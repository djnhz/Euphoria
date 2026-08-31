import { vereisGebruiker } from "@/lib/auth";
import { begroteJaren, beschikbareJaren, begroting } from "@/lib/data";
import BegrotingFormulier from "@/components/BegrotingFormulier";
import JaarKiezer from "@/components/JaarKiezer";

/** Jaren met uitgaven of een begroting, plus dit jaar en het volgende om vooruit te kijken. */
async function kiesbareJaren(): Promise<number[]> {
  const [uitUitgaven, uitBegroting] = await Promise.all([
    beschikbareJaren(),
    begroteJaren(),
  ]);
  const nu = new Date().getFullYear();
  const alles = new Set([...uitUitgaven, ...uitBegroting, nu, nu + 1]);
  return [...alles].sort((a, b) => b - a);
}

export default async function BegrotingPagina({
  searchParams,
}: PageProps<"/begroting">) {
  await vereisGebruiker();
  const params = await searchParams;

  const jaren = await kiesbareJaren();
  const gekozen = Number(params.jaar);
  const jaar = jaren.includes(gekozen) ? gekozen : new Date().getFullYear();
  const posten = await begroting(jaar);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Begroting</h1>
        <div className="ml-auto">
          <JaarKiezer jaren={jaren} huidig={jaar} />
        </div>
      </div>

      <BegrotingFormulier jaar={jaar} posten={posten} />
    </div>
  );
}
