import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  clientPrefix: "VITE_",
  client: {
    // VITE_SERVER_URL should be set at build time, but if not, use current origin at runtime
    // This allows the app to work even if the build arg wasn't passed
    VITE_SERVER_URL: z
      .string()
      .url()
      .optional()
      .default(() => {
        if (typeof window !== "undefined") {
          return window.location.origin;
        }
        return "http://localhost:3000";
      }),
    VITE_GOOGLE_MAPS_API_KEY: z.string().min(1).optional().default(""),
  },
  runtimeEnv: (import.meta as any).env,
  emptyStringAsUndefined: true,
});
