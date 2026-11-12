/** DOM id of the Advanced cut-plan section (StockPanel). */
export const CUT_PLAN_ID = 'cut-plan';

/** Bring the cut plan into view and move focus to it. */
export function scrollToCutPlan(): void {
  const el = document.getElementById(CUT_PLAN_ID);
  if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.focus({ preventScroll: true });
}
