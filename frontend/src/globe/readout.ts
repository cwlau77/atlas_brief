/** Writes the live globe coordinates into the corner readout without a React render. */
export function applyReadout(el: HTMLElement | null, text: string | null): void {
  if (!el) return
  el.textContent = text ?? ''
  el.dataset.visible = String(text !== null)
}
