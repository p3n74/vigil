import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
config({ path: path.resolve(__dirname, "../../.env") });
config({ path: path.resolve(__dirname, "../../apps/server/.env") });

const { prisma } = await import("./src");

async function main() {
  console.log("Starting seed data...");

  // Create a seed user
  const seedUser = await prisma.user.upsert({
    where: { email: "admin@template.local" },
    update: {},
    create: {
      id: "seed_admin_123",
      name: "Template Admin",
      email: "admin@template.local",
      emailVerified: true,
    },
  });

  console.log("Created/Found seed user:", seedUser.email);

  // Authorize the seed user as ADMIN
  const authorizedUser = await prisma.authorizedUser.upsert({
    where: { email: seedUser.email },
    update: { role: "ADMIN" },
    create: {
      email: seedUser.email,
      role: "ADMIN",
    },
  });

  console.log("Authorized seed user as:", authorizedUser.role);

  console.log("Seed data complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
