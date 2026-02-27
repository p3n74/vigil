import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";

const getServerPortFromEnv = () => {
  const serverEnvPath = path.resolve(__dirname, "../server/.env");
  if (!existsSync(serverEnvPath)) {
    return 3005;
  }

  const content = readFileSync(serverEnvPath, "utf-8");
  const portLine = content
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.startsWith("PORT="));

  if (!portLine) {
    return 3005;
  }

  const parsed = Number(portLine.replace("PORT=", "").trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3005;
};

const serverPort = getServerPortFromEnv();
const webPort = Number(process.env.WEB_PORT ?? 5173);

export default defineConfig({
  plugins: [tailwindcss(), tanstackRouter({}), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: Number.isFinite(webPort) && webPort > 0 ? webPort : 5173,
    proxy: {
      "/trpc": `http://localhost:${serverPort}`,
      "/api/auth": `http://localhost:${serverPort}`,
      "/upload": `http://localhost:${serverPort}`,
      "/uploads": `http://localhost:${serverPort}`,
      "/ws": `http://localhost:${serverPort}`,
    },
  },
});
