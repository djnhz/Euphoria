import { notFound } from "next/navigation";
import DocumentenScherm from "../DocumentenScherm";

export default async function MapPagina({
  params,
}: PageProps<"/documenten/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  return <DocumentenScherm mapId={id} />;
}
