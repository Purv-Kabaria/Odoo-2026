const { PrismaClient } = require("@prisma/client");
const { pbkdf2Sync, randomBytes } = require("crypto");

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Password123!";
const PASSWORD_ITERATIONS = 210000;

function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256").toString("hex");
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

async function main() {
  const org = await prisma.organization.upsert({
    where: { slug: "assetflow-demo" },
    update: {},
    create: { name: "AssetFlow Demo Co", slug: "assetflow-demo" },
  });

  const passwordHash = hashPassword(DEMO_PASSWORD);
  const [admin, manager, deptHead, employee] = await Promise.all([
    prisma.user.upsert({
      where: { email: "admin@assetflow.demo" },
      update: {},
      create: { orgId: org.id, email: "admin@assetflow.demo", name: "Ava Admin", role: "ADMIN", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "manager@assetflow.demo" },
      update: {},
      create: { orgId: org.id, email: "manager@assetflow.demo", name: "Max Manager", role: "ASSET_MANAGER", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "depthead@assetflow.demo" },
      update: {},
      create: { orgId: org.id, email: "depthead@assetflow.demo", name: "Dana Depthead", role: "DEPARTMENT_HEAD", passwordHash },
    }),
    prisma.user.upsert({
      where: { email: "employee@assetflow.demo" },
      update: {},
      create: { orgId: org.id, email: "employee@assetflow.demo", name: "Eli Employee", role: "EMPLOYEE", passwordHash },
    }),
  ]);

  const engineering = await prisma.department.upsert({
    where: { orgId_name: { orgId: org.id, name: "Engineering" } },
    update: {},
    create: { orgId: org.id, name: "Engineering", headId: deptHead.id },
  });
  const facilities = await prisma.department.upsert({
    where: { orgId_name: { orgId: org.id, name: "Facilities" } },
    update: {},
    create: { orgId: org.id, name: "Facilities" },
  });

  await prisma.user.update({ where: { id: deptHead.id }, data: { departmentId: engineering.id } });
  await prisma.user.update({ where: { id: employee.id }, data: { departmentId: engineering.id } });

  const [electronics, furniture, vehicles] = await Promise.all([
    prisma.assetCategory.upsert({
      where: { orgId_name: { orgId: org.id, name: "Electronics" } },
      update: {},
      create: {
        orgId: org.id,
        name: "Electronics",
        fieldSchema: [{ key: "warrantyMonths", label: "Warranty (months)", type: "number", required: false }],
      },
    }),
    prisma.assetCategory.upsert({
      where: { orgId_name: { orgId: org.id, name: "Furniture" } },
      update: {},
      create: { orgId: org.id, name: "Furniture" },
    }),
    prisma.assetCategory.upsert({
      where: { orgId_name: { orgId: org.id, name: "Vehicles" } },
      update: {},
      create: { orgId: org.id, name: "Vehicles" },
    }),
  ]);

  async function nextTag() {
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: { assetSeq: { increment: 1 } },
      select: { assetSeq: true },
    });
    return `AF-${String(updated.assetSeq).padStart(4, "0")}`;
  }

  const assetDefs = [
    { name: "Dell Laptop", categoryId: electronics.id, condition: "GOOD", location: "Bengaluru", isBookable: false },
    { name: "Projector", categoryId: electronics.id, condition: "GOOD", location: "HQ Floor 2", isBookable: false },
    { name: "Office Chair", categoryId: furniture.id, condition: "NEW", location: "Warehouse", isBookable: false },
    { name: "Delivery Van", categoryId: vehicles.id, condition: "FAIR", location: "HQ Garage", isBookable: false },
    { name: "Conference Room B2", categoryId: furniture.id, condition: "GOOD", location: "HQ Floor 1", isBookable: true },
    { name: "Meeting Pod A1", categoryId: furniture.id, condition: "GOOD", location: "HQ Floor 1", isBookable: true },
  ];

  const assets = [];
  for (const def of assetDefs) {
    const assetTag = await nextTag();
    const asset = await prisma.asset.upsert({
      where: { orgId_assetTag: { orgId: org.id, assetTag } },
      update: {},
      create: { orgId: org.id, assetTag, ...def },
    });
    assets.push(asset);
  }

  // One active allocation, one already-returned allocation.
  await prisma.allocation.create({
    data: { assetId: assets[0].id, toEmployeeId: employee.id, allocatedById: manager.id, expectedReturnDate: new Date(Date.now() + 14 * 86400000) },
  });
  await prisma.asset.update({ where: { id: assets[0].id }, data: { status: "ALLOCATED" } });

  await prisma.allocation.create({
    data: {
      assetId: assets[2].id,
      toDepartmentId: facilities.id,
      allocatedById: manager.id,
      returnedAt: new Date(),
      returnCondition: "GOOD",
      status: "RETURNED",
    },
  });

  // Two bookings on the same bookable room: one past, one upcoming.
  const roomB2 = assets[4];
  await prisma.booking.create({
    data: { assetId: roomB2.id, bookedById: employee.id, title: "Sprint planning", startTime: new Date(Date.now() - 86400000), endTime: new Date(Date.now() - 86400000 + 3600000), status: "COMPLETED" },
  });
  await prisma.booking.create({
    data: { assetId: roomB2.id, bookedById: deptHead.id, onBehalfOfDeptId: engineering.id, title: "Design review", startTime: new Date(Date.now() + 3600000), endTime: new Date(Date.now() + 7200000) },
  });

  // Maintenance requests spread across kanban columns.
  await prisma.maintenanceRequest.create({
    data: { assetId: assets[1].id, raisedById: employee.id, description: "Projector bulb not turning on", priority: "MEDIUM" },
  });
  const approved = await prisma.maintenanceRequest.create({
    data: { assetId: assets[3].id, raisedById: deptHead.id, description: "AC unit noisy compressor", priority: "HIGH", status: "APPROVED", approvedById: manager.id, approvedAt: new Date() },
  });
  await prisma.asset.update({ where: { id: assets[3].id }, data: { status: "UNDER_MAINTENANCE" } });
  await prisma.maintenanceRequest.update({ where: { id: approved.id }, data: {} });

  console.log(`Seeded org "${org.name}" with ${assets.length} assets, 4 users, 2 departments, 3 categories.`);
  console.log(`Demo logins (password: ${DEMO_PASSWORD}): admin@assetflow.demo / manager@assetflow.demo / depthead@assetflow.demo / employee@assetflow.demo`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
