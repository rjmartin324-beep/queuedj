/**
 * Fisher-Yates shuffle — returns a new shuffled copy of the array.
 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Returns a shuffled array of indices [0 … length-1].
 */
export function shuffledIndices(length: number): number[] {
  return shuffle(Array.from({ length }, (_, i) => i));
}
