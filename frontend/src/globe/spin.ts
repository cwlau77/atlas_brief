// The globe's auto-spin speed (rad/s) for a frame. Pure, so the priorities are testable:
// reduced motion and a held target beat everything, and the reader's hand beats scanning.

export const SCAN_SPIN = 0.6

export function spinTarget(o: {
  reduced: boolean
  hold: boolean
  scanning: boolean
  /** No hold, zoom, hover or recent interaction. */
  idle: boolean
  /** The pointer is over the globe or it was dragged recently. */
  engaged: boolean
  baseSpin: number
}): number {
  if (o.reduced || o.hold) return 0
  if (o.scanning) return o.engaged ? 0 : SCAN_SPIN
  return o.idle ? o.baseSpin : 0
}
