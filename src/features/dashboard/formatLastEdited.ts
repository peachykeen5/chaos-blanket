const MINUTE = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;

export function formatLastEdited(millis: number): string {
  if (!millis) return "Not started yet";

  const diff = Date.now() - millis;
  if (diff < MINUTE) return "Edited just now";
  if (diff < HOUR) {
    const minutes = Math.round(diff / MINUTE);
    return `Edited ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (diff < DAY) {
    const hours = Math.round(diff / HOUR);
    return `Edited ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (diff < 2 * DAY) return "Edited yesterday";
  if (diff < 7 * DAY) {
    const days = Math.round(diff / DAY);
    return `Edited ${days} days ago`;
  }
  return `Edited ${new Date(millis).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;
}
