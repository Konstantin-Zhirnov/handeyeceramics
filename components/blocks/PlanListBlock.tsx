import { plansIn } from "@/components/shop/data";
import { PlanList } from "@/components/shop/parts";

/** `planList` block: the plans of one group, or — with no group — all of them under their group headings. */
export async function PlanListBlock({ heading, group }: { heading?: string | null; group?: string | null }) {
  const plans = await plansIn(group);
  return (
    <section data-plan-list>
      {heading && <h2 className="display mb-4 text-2xl text-ink">{heading}</h2>}
      <PlanList plans={plans} grouped={!group?.trim()} />
    </section>
  );
}
