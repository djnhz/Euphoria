import { vereisGebruiker } from "@/lib/auth";
import { begroteJaren, beschikbareJaren, begroting } from "@/lib/data";
import BegrotingFormulier from "@/components/BegrotingFormulier";
import JaarKiezer from "@/components/JaarKiezer";
import { Schermbody, Schermkop, Segment } from "@/components/Scherm";
import { KOSTEN_TABS } from "@/components/kostenTabs";

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
    <>
      <Schermkop
        titel="Begroting"
        onderschrift="per jaar, inclusief btw"
        rechts={<JaarKiezer jaren={jaren} huidig={jaar} />}
        tabs={<Segment items={KOSTEN_TABS} actief="/begroting" />}
      />
      <Schermbody>
        <BegrotingFormulier jaar={jaar} posten={posten} />
      </Schermbody>
    </>
  );
}
