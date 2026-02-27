import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

config({ path: path.resolve(__dirname, "../../.env") });
config({ path: path.resolve(__dirname, "../../apps/server/.env") });

const { prisma } = await import("./src");

async function main() {
  const email = "firefallchallenger@gmail.com";

  console.log("Seeding Vigil admin:", email);

  const authorizedUser = await prisma.authorizedUser.upsert({
    where: { email },
    update: { role: "ADMIN" },
    create: {
      email,
      role: "ADMIN",
    },
  });

  console.log("Authorized user:", authorizedUser.email, "role:", authorizedUser.role);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

