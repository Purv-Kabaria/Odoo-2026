const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  const orgs = await prisma.organization.findMany();
  console.log("Orgs in DB:", orgs);
  console.log("Users in DB:", users);
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect());
