const { PrismaClient } = require("@prisma/client");
const { pbkdf2Sync, randomBytes } = require("crypto");
const fs = require("fs");

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Password123!";
const PASSWORD_ITERATIONS = 210000;

const productCategories = ["Software", "Services", "Hardware", "Training", "Support"];
const productStatuses = ["ACTIVE", "DRAFT", "ARCHIVED"];
const industries = ["Retail", "Manufacturing", "Healthcare", "Education", "Finance", "Logistics"];
const regions = ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East"];
const plans = ["STARTER", "GROWTH", "ENTERPRISE"];

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const passwordHash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256").toString("hex");

  return {
    passwordHash,
    salt,
    iterations: PASSWORD_ITERATIONS,
  };
}

async function seedUsers() {
  if (!fs.existsSync("scripts/users-data.json")) {
    console.log("Skipping users: scripts/users-data.json was not found.");
    return 0;
  }

  const users = JSON.parse(fs.readFileSync("scripts/users-data.json", "utf8"));

  for (const user of users) {
    const seededUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: user.name,
        role: user.role,
        location: user.location,
        gender: user.gender,
      },
      create: {
        name: user.name,
        email: user.email,
        role: user.role,
        location: user.location,
        gender: user.gender,
        createdAt: new Date(user.createdAt),
      },
    });

    await prisma.passwordCredential.upsert({
      where: { userId: seededUser.id },
      update: hashPassword(DEMO_PASSWORD),
      create: {
        userId: seededUser.id,
        ...hashPassword(DEMO_PASSWORD),
      },
    });
  }

  return users.length;
}

async function seedProducts() {
  const products = Array.from({ length: 120 }, (_, index) => {
    const sequence = index + 1;
    const category = productCategories[index % productCategories.length];
    return {
      name: `${category} Package ${sequence}`,
      sku: `SKU-${String(sequence).padStart(4, "0")}`,
      category,
      status: productStatuses[index % productStatuses.length],
      priceCents: 4900 + index * 275,
      stock: (index * 7) % 95,
    };
  });

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: product,
      create: product,
    });
  }

  return products.length;
}

async function seedOrganizations() {
  const organizations = Array.from({ length: 80 }, (_, index) => {
    const sequence = index + 1;
    const industry = industries[index % industries.length];
    const name = `${industry} Group ${sequence}`;
    return {
      name,
      slug: `${slugify(name)}-${sequence}`,
      industry,
      region: regions[index % regions.length],
      plan: plans[index % plans.length],
      seats: 3 + ((index * 5) % 80),
    };
  });

  for (const organization of organizations) {
    await prisma.organization.upsert({
      where: { slug: organization.slug },
      update: organization,
      create: organization,
    });
  }

  return organizations.length;
}

async function main() {
  const [users, products, organizations] = await Promise.all([
    seedUsers(),
    seedProducts(),
    seedOrganizations(),
  ]);

  console.log(`Seeded ${users} users, ${products} products, and ${organizations} organizations.`);
  console.log(`Demo user password: ${DEMO_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
