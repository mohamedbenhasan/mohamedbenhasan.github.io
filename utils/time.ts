export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0 s';

  const totalSeconds = Math.floor(seconds);
  const totalMinutes = Math.floor(totalSeconds / 60);

  if (totalMinutes < 60) {
    const s = totalSeconds % 60;
    return `${totalMinutes} min ${s} s`;
  } else if (totalMinutes < 1440) { // < 24 hours
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h} h ${m} min`;
  } else {
    const d = Math.floor(totalMinutes / 1440);
    const h = Math.floor((totalMinutes % 1440) / 60);
    return `${d} j ${h} h`;
  }
}
