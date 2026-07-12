const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function main() {
  console.log("Reading users from scripts/users-data.json...");
  const data = fs.readFileSync('scripts/users-data.json', 'utf8');
  const users = JSON.parse(data);

  console.log(`Found ${users.length} users. Populating database...`);

  let count = 0;
  for (const user of users) {
    try {
      await prisma.user.create({
        data: {
          name: user.name,
          email: user.email,
          role: user.role,
          location: user.location,
          gender: user.gender,
          createdAt: new Date(user.createdAt),
        }
      });
      count++;
      if (count % 50 === 0) {
        console.log(`Inserted ${count}/${users.length} users...`);
      }
    } catch (err) {
      console.error(`Failed to insert user ${user.email}:`, err.message);
    }
  }

  console.log(`Database successfully seeded! Total inserted: ${count}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
