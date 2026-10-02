/**
 * Wie het bewerkblad aanvinkt bij een bestaande taak. Los van React en de database
 * zodat het zonder die twee te testen is -- hier hangt aan vast wat er bij opslaan
 * met een oudere toewijzing gebeurt.
 *
 * Eerst bestond toekennen uit losse keuzes: een eigenaar ("ik pak hem zelf op"), een
 * huishouden ("voor wie") en aanmelders. Nu is het één lijst personen. Het blad
 * vinkt daarom aan wat er uit die tijd nog aan hing, zodat je voor je opslaat ziet
 * wat van de oude toewijzing wordt, in plaats van dat hij stilletjes verdwijnt.
 */

export type ToegekendeTaak = {
  helpers: readonly { userId: number }[];
  userId: number | null;
  coupleId: number | null;
};

export type Toekenbaar = { id: number; coupleId: number };

export function toegekenden(
  taak: ToegekendeTaak,
  mensen: readonly Toekenbaar[],
): number[] {
  const ids = new Set(taak.helpers.map((h) => h.userId));
  if (taak.userId !== null) ids.add(taak.userId);
  // Een huishouden telt alleen mee als er verder niemand stond: dan was het de enige
  // aanwijzing wie het moest doen, en het zijn dan beide leden die erbij horen.
  if (ids.size === 0 && taak.coupleId !== null) {
    for (const mens of mensen) {
      if (mens.coupleId === taak.coupleId) ids.add(mens.id);
    }
  }
  return [...ids];
}
