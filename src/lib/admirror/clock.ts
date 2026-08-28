/**
 * Reading the clock, in one place.
 *
 * A reminder date is "due" or it is not, and that is the only time question
 * IOAA.AI asks. Keeping the read here means no screen reaches for the clock
 * while it is drawing itself.
 */

export function isDue(at: Date | null | undefined): boolean {
  if (!at) return false;
  return at.getTime() <= Date.now();
}

export function isOverdue(at: Date | null | undefined, enabled: boolean): boolean {
  if (!enabled) return false;
  return isDue(at);
}
