export const formatPostDate = (input: string | Date): string => {
  const createdAt = typeof input === "string" ? new Date(input) : input;
  if (!(createdAt instanceof Date) || Number.isNaN(createdAt.getTime())) {
    return "";
  }
  const now = new Date();

  const diffMs = now.getTime() - createdAt.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < hourMs) {
    const minutes = Math.max(1, Math.floor(diffMs / minuteMs));
    return `${minutes}m`;
  }

  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs);
    return `${hours}h`;
  }

  const days = Math.floor(diffMs / dayMs);
  if (days <= 3) {
    return `${days}d`;
  }

  const sameYear = now.getFullYear() === createdAt.getFullYear();
  const overOneYear = diffMs >= 365 * dayMs;

  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
  };

  if (!sameYear && overOneYear) {
    options.year = "numeric";
  }

  return createdAt.toLocaleDateString(undefined, options);
};

