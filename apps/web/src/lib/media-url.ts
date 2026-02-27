import { env } from "@template/env/web";

const ABSOLUTE_URL_PATTERN = /^https?:\/\//i;

export const resolveMediaUrl = (value: string | null | undefined): string | undefined => {
  if (!value) {
    return undefined;
  }

  if (value.startsWith("/")) {
    return value;
  }

  if (
    ABSOLUTE_URL_PATTERN.test(value) ||
    value.startsWith("data:") ||
    value.startsWith("blob:")
  ) {
    return value;
  }

  const base = env.VITE_SERVER_URL.replace(/\/$/, "");
  const path = value.startsWith("/") ? value : `/${value}`;
  return `${base}${path}`;
};
