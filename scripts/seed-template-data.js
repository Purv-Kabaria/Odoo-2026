const { PrismaClient } = require("@prisma/client");
const { pbkdf2Sync, randomBytes } = require("crypto");

const prisma = new PrismaClient();
const DEMO_PASSWORD = "Password123!";
const PASSWORD_ITERATIONS = 210000;

// Mirrors lib/password.ts's hashPassword exactly (pbkdf2$<iterations>$<saltHex>$<hashHex>)
// so seeded users can log in through the real /api/auth/login route.
function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const hash = pbkdf2Sync(password, salt, PASSWORD_ITERATIONS, 32, "sha256").toString("hex");
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${hash}`;
}

const DAY = 86400000;
const daysAgo = (n) => new Date(Date.now() - n * DAY);
const daysFromNow = (n) => new Date(Date.now() + n * DAY);
function atHour(date, hour, minute = 0) {
  const d = new Date(date);
  d.setHours(hour, minute, 0, 0);
  return d;
}

async function main() {
  // ---------------------------------------------------------------------
  // Organization
  // ---------------------------------------------------------------------
  const org = await prisma.organization.upsert({
    where: { slug: "assetflow-demo" },
    update: {},
    create: { name: "AssetFlow Demo Co", slug: "assetflow-demo" },
  });

  // ---------------------------------------------------------------------
  // Users — every role, plus PENDING_APPROVAL invited users
  // ---------------------------------------------------------------------
  const passwordHash = hashPassword(DEMO_PASSWORD);
  const activeUserDefs = [
    { email: "admin@assetflow.demo", name: "Ava Admin", role: "ADMIN" },
    { email: "manager@assetflow.demo", name: "Max Manager", role: "ASSET_MANAGER" },
    { email: "manager2@assetflow.demo", name: "Mia Manager", role: "ASSET_MANAGER" },
    { email: "depthead@assetflow.demo", name: "Dana Depthead", role: "DEPARTMENT_HEAD" },
    { email: "depthead2@assetflow.demo", name: "Derek Depthead", role: "DEPARTMENT_HEAD" },
    { email: "employee@assetflow.demo", name: "Eli Employee", role: "EMPLOYEE" },
    { email: "employee2@assetflow.demo", name: "Emma Employee", role: "EMPLOYEE" },
    { email: "employee3@assetflow.demo", name: "Ethan Employee", role: "EMPLOYEE" },
    { email: "employee4@assetflow.demo", name: "Ezra Employee", role: "EMPLOYEE" },
    { email: "employee5@assetflow.demo", name: "Elena Employee", role: "EMPLOYEE" },
    { email: "employee6@assetflow.demo", name: "Farah Field", role: "EMPLOYEE" },
    { email: "employee7@assetflow.demo", name: "Gabriel Grant", role: "EMPLOYEE" },
  ];

  const activeUsers = {};
  for (const def of activeUserDefs) {
    const user = await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: { orgId: org.id, email: def.email, name: def.name, role: def.role, passwordHash, status: "ACTIVE" },
    });
    activeUsers[def.email] = user;
  }
  const [admin, manager, manager2, depthead, depthead2, employee, employee2, employee3, employee4, employee5, employee6, employee7] =
    activeUserDefs.map((d) => activeUsers[d.email]);

  // Admin-invited, not-yet-accepted users — no password, PENDING_APPROVAL.
  const pendingDefs = [
    { email: "pending1@assetflow.demo", name: "Priya Pending" },
    { email: "pending2@assetflow.demo", name: "Paolo Pending" },
  ];
  for (const def of pendingDefs) {
    await prisma.user.upsert({
      where: { email: def.email },
      update: {},
      create: {
        orgId: org.id,
        email: def.email,
        name: def.name,
        role: "EMPLOYEE",
        status: "PENDING_APPROVAL",
        invitedById: admin.id,
        invitedAt: daysAgo(2),
      },
    });
  }

  // ---------------------------------------------------------------------
  // Departments — hierarchy + heads
  // ---------------------------------------------------------------------
  const engineering = await prisma.department.upsert({
    where: { orgId_name: { orgId: org.id, name: "Engineering" } },
    update: {},
    create: { orgId: org.id, name: "Engineering", headId: depthead.id },
  });
  const facilities = await prisma.department.upsert({
    where: { orgId_name: { orgId: org.id, name: "Facilities" } },
    update: {},
    create: { orgId: org.id, name: "Facilities", headId: depthead2.id },
  });
  const fieldOps = await prisma.department.upsert({
    where: { orgId_name: { orgId: org.id, name: "Field Ops" } },
    update: {},
    create: { orgId: org.id, name: "Field Ops" },
  });
  const fieldOpsEast = await prisma.department.upsert({
    where: { orgId_name: { orgId: org.id, name: "Field Ops — East" } },
    update: {},
    create: { orgId: org.id, name: "Field Ops — East", parentDepartmentId: fieldOps.id },
  });

  await prisma.user.update({ where: { id: depthead.id }, data: { departmentId: engineering.id } });
  await prisma.user.update({ where: { id: depthead2.id }, data: { departmentId: facilities.id } });
  await prisma.user.update({ where: { id: employee.id }, data: { departmentId: engineering.id } });
  await prisma.user.update({ where: { id: employee2.id }, data: { departmentId: engineering.id } });
  await prisma.user.update({ where: { id: employee3.id }, data: { departmentId: facilities.id } });
  await prisma.user.update({ where: { id: employee4.id }, data: { departmentId: fieldOpsEast.id } });
  await prisma.user.update({ where: { id: employee6.id }, data: { departmentId: fieldOpsEast.id } });
  await prisma.user.update({ where: { id: employee7.id }, data: { departmentId: facilities.id } });
  // employee5 deliberately left unassigned — realistic edge case for department-scoped views.

  // ---------------------------------------------------------------------
  // Asset categories
  // ---------------------------------------------------------------------
  const [electronics, furniture, vehicles, itEquipment, officeSupplies] = await Promise.all([
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
    prisma.assetCategory.upsert({
      where: { orgId_name: { orgId: org.id, name: "IT Equipment" } },
      update: {},
      create: { orgId: org.id, name: "IT Equipment" },
    }),
    prisma.assetCategory.upsert({
      where: { orgId_name: { orgId: org.id, name: "Office Supplies" } },
      update: {},
      create: { orgId: org.id, name: "Office Supplies" },
    }),
  ]);

  // ---------------------------------------------------------------------
  // Assets — 50 total, 42 individually-allocatable + 8 bookable
  // ---------------------------------------------------------------------
  async function nextTag() {
    const updated = await prisma.organization.update({
      where: { id: org.id },
      data: { assetSeq: { increment: 1 } },
      select: { assetSeq: true },
    });
    return `AF-${String(updated.assetSeq).padStart(4, "0")}`;
  }

  const assetDefs = [
    { name: "Dell XPS 15 Laptop", categoryId: electronics.id, condition: "GOOD", location: "HQ Floor 2", acquisitionDate: daysAgo(548), acquisitionCost: 1800 }, // 0
    { name: "MacBook Pro 14", categoryId: electronics.id, condition: "GOOD", location: "HQ Floor 2", acquisitionDate: daysAgo(240), acquisitionCost: 2400 }, // 1
    { name: "ThinkPad X1 Carbon", categoryId: electronics.id, condition: "GOOD", location: "Bengaluru Office", acquisitionDate: daysAgo(730), acquisitionCost: 1600 }, // 2
    { name: 'Dell Monitor 27"', categoryId: electronics.id, condition: "NEW", location: "Warehouse", acquisitionDate: daysAgo(60), acquisitionCost: 350 }, // 3
    { name: "HP LaserJet Printer", categoryId: electronics.id, condition: "FAIR", location: "HQ Floor 1", acquisitionDate: daysAgo(1095), acquisitionCost: 600 }, // 4
    { name: "Epson Projector", categoryId: electronics.id, condition: "GOOD", location: "HQ Floor 2", acquisitionDate: daysAgo(1460), acquisitionCost: 900 }, // 5
    { name: "iPhone 14", categoryId: electronics.id, condition: "GOOD", location: "HQ Floor 3", acquisitionDate: daysAgo(365), acquisitionCost: 999 }, // 6
    { name: "iPad Air", categoryId: electronics.id, condition: "GOOD", location: "HQ Floor 3", acquisitionDate: daysAgo(365), acquisitionCost: 650 }, // 7
    { name: "Logitech Webcam", categoryId: electronics.id, condition: "NEW", location: "Warehouse", acquisitionDate: daysAgo(30), acquisitionCost: 80 }, // 8
    { name: "Herman Miller Office Chair", categoryId: furniture.id, condition: "GOOD", location: "Bengaluru Office", acquisitionDate: daysAgo(1095), acquisitionCost: 1200 }, // 9
    { name: "Standing Desk", categoryId: furniture.id, condition: "GOOD", location: "HQ Floor 2", acquisitionDate: daysAgo(730), acquisitionCost: 700 }, // 10
    { name: "Bookshelf", categoryId: furniture.id, condition: "FAIR", location: "Warehouse", acquisitionDate: daysAgo(1825), acquisitionCost: 250 }, // 11
    { name: "Filing Cabinet", categoryId: furniture.id, condition: "POOR", location: "Warehouse", acquisitionDate: daysAgo(2555), acquisitionCost: 150 }, // 12
    { name: "Ergonomic Chair", categoryId: furniture.id, condition: "NEW", location: "HQ Floor 1", acquisitionDate: daysAgo(90), acquisitionCost: 450 }, // 13
    { name: "Conference Table", categoryId: furniture.id, condition: "GOOD", location: "HQ Floor 1", acquisitionDate: daysAgo(1460), acquisitionCost: 2000 }, // 14
    // Untouched by any allocation/booking/maintenance record below, and given
    // a backdated createdAt (not just acquisitionDate) — the idle-assets
    // report computes "last activity" as GREATEST(alloc, booking,
    // maintenance, asset.createdAt), so an asset with zero history but a
    // freshly-seeded createdAt would read as "just created", not idle.
    { name: "Ford Transit Delivery Van", categoryId: vehicles.id, condition: "FAIR", location: "HQ Garage", acquisitionDate: daysAgo(2400), createdAt: daysAgo(400), acquisitionCost: 28000 }, // 15
    { name: "Toyota Camry Company Car", categoryId: vehicles.id, condition: "GOOD", location: "HQ Garage", acquisitionDate: daysAgo(730), acquisitionCost: 32000 }, // 16
    { name: "Warehouse Forklift", categoryId: vehicles.id, condition: "POOR", location: "Warehouse", acquisitionDate: daysAgo(2190), acquisitionCost: 18000 }, // 17
    { name: "Cisco Network Switch", categoryId: itEquipment.id, condition: "GOOD", location: "Server Room", acquisitionDate: daysAgo(730), acquisitionCost: 1200 }, // 18
    { name: "Dell Server Rack", categoryId: itEquipment.id, condition: "GOOD", location: "Server Room", acquisitionDate: daysAgo(1095), createdAt: daysAgo(200), acquisitionCost: 8500 }, // 19 — idle: untouched, backdated
    { name: "UPS Battery Backup", categoryId: itEquipment.id, condition: "GOOD", location: "Server Room", acquisitionDate: daysAgo(365), createdAt: daysAgo(180), acquisitionCost: 600 }, // 20 — idle: untouched, backdated
    { name: "Wireless Router", categoryId: itEquipment.id, condition: "FAIR", location: "HQ Floor 2", acquisitionDate: daysAgo(2000), createdAt: daysAgo(300), acquisitionCost: 200 }, // 21 — idle + nearing retirement
    { name: "Desk Lamp", categoryId: officeSupplies.id, condition: "NEW", location: "Warehouse", acquisitionDate: daysAgo(60), acquisitionCost: 40 }, // 22
    { name: "Whiteboard", categoryId: officeSupplies.id, condition: "GOOD", location: "HQ Floor 1", acquisitionDate: daysAgo(365), acquisitionCost: 180 }, // 23
    { name: "Paper Shredder", categoryId: officeSupplies.id, condition: "FAIR", location: "HQ Floor 3", acquisitionDate: daysAgo(1460), acquisitionCost: 120 }, // 24
    { name: "Conference Room B2", categoryId: furniture.id, condition: "GOOD", location: "HQ Floor 1", isBookable: true, acquisitionDate: daysAgo(1000), acquisitionCost: 0 }, // 25
    { name: "Meeting Pod A1", categoryId: furniture.id, condition: "GOOD", location: "HQ Floor 1", isBookable: true, acquisitionDate: daysAgo(600), acquisitionCost: 0 }, // 26
    { name: "Executive Boardroom", categoryId: furniture.id, condition: "GOOD", location: "HQ Floor 3", isBookable: true, acquisitionDate: daysAgo(900), acquisitionCost: 0 }, // 27
    { name: "Mobile Projector Cart", categoryId: electronics.id, condition: "GOOD", location: "HQ Floor 2", isBookable: true, acquisitionDate: daysAgo(400), acquisitionCost: 1100 }, // 28
    { name: "Shared Company Van", categoryId: vehicles.id, condition: "GOOD", location: "HQ Garage", isBookable: true, acquisitionDate: daysAgo(500), acquisitionCost: 26000 }, // 29
    // Dedicated to a direct Field Ops department allocation below, so the
    // utilization-by-department report has all 4 departments represented
    // (Field Ops has no direct members — Field Ops — East is its only
    // populated child — so without this it would show a flat 0).
    { name: "Two-Way Radio Set", categoryId: itEquipment.id, condition: "GOOD", location: "Field Site 1", acquisitionDate: daysAgo(200), acquisitionCost: 300 }, // 30
    // ---- Expansion batch: appended, never inserted mid-list, so every index
    // referenced above (allocations/bookings/maintenance/audit) stays stable.
    { name: "Surface Laptop Studio", categoryId: electronics.id, condition: "GOOD", location: "HQ Floor 2", acquisitionDate: daysAgo(150), acquisitionCost: 2100 }, // 31
    { name: "Samsung 4K Monitor", categoryId: electronics.id, condition: "NEW", location: "HQ Floor 1", acquisitionDate: daysAgo(45), acquisitionCost: 500 }, // 32
    { name: "Wireless Keyboard & Mouse Combo", categoryId: electronics.id, condition: "NEW", location: "Warehouse", acquisitionDate: daysAgo(20), acquisitionCost: 90 }, // 33
    { name: "Canon DSLR Camera", categoryId: electronics.id, condition: "GOOD", location: "HQ Floor 3", acquisitionDate: daysAgo(300), acquisitionCost: 1400 }, // 34
    { name: "Bose Conference Speaker", categoryId: electronics.id, condition: "GOOD", location: "HQ Floor 1", acquisitionDate: daysAgo(200), acquisitionCost: 350 }, // 35
    { name: "Reception Desk", categoryId: furniture.id, condition: "FAIR", location: "HQ Floor 1", acquisitionDate: daysAgo(2100), acquisitionCost: 900 }, // 36
    { name: "Lounge Sofa", categoryId: furniture.id, condition: "FAIR", location: "HQ Floor 2", acquisitionDate: daysAgo(900), acquisitionCost: 800 }, // 37
    { name: "Break Room Table Set", categoryId: furniture.id, condition: "GOOD", location: "HQ Floor 2", acquisitionDate: daysAgo(500), acquisitionCost: 600 }, // 38
    { name: "Honda Civic Pool Car", categoryId: vehicles.id, condition: "GOOD", location: "HQ Garage", acquisitionDate: daysAgo(600), acquisitionCost: 24000 }, // 39
    { name: "Electric Scooter", categoryId: vehicles.id, condition: "NEW", location: "Warehouse", acquisitionDate: daysAgo(40), acquisitionCost: 1200 }, // 40
    { name: "Firewall Appliance", categoryId: itEquipment.id, condition: "GOOD", location: "Server Room", acquisitionDate: daysAgo(400), acquisitionCost: 2200 }, // 41
    { name: "Backup NAS Drive", categoryId: itEquipment.id, condition: "GOOD", location: "Server Room", acquisitionDate: daysAgo(250), acquisitionCost: 1500 }, // 42
    { name: "Portable Hard Drive Set", categoryId: itEquipment.id, condition: "NEW", location: "Warehouse", acquisitionDate: daysAgo(30), acquisitionCost: 220 }, // 43
    { name: "Label Printer", categoryId: officeSupplies.id, condition: "GOOD", location: "HQ Floor 3", acquisitionDate: daysAgo(180), acquisitionCost: 150 }, // 44
    { name: "First Aid Kit Cabinet", categoryId: officeSupplies.id, condition: "NEW", location: "HQ Floor 1", acquisitionDate: daysAgo(60), acquisitionCost: 100 }, // 45
    { name: "Coffee Machine", categoryId: officeSupplies.id, condition: "FAIR", location: "HQ Floor 2", acquisitionDate: daysAgo(700), acquisitionCost: 450 }, // 46
    { name: "Huddle Room C3", categoryId: furniture.id, condition: "GOOD", location: "HQ Floor 2", isBookable: true, acquisitionDate: daysAgo(500), acquisitionCost: 0 }, // 47
    { name: "Podcast Studio", categoryId: electronics.id, condition: "GOOD", location: "HQ Floor 3", isBookable: true, acquisitionDate: daysAgo(250), acquisitionCost: 3200 }, // 48
    { name: "Delivery Scooter Fleet Unit 2", categoryId: vehicles.id, condition: "GOOD", location: "HQ Garage", isBookable: true, acquisitionDate: daysAgo(300), acquisitionCost: 1500 }, // 49
  ];

  const assets = [];
  for (const def of assetDefs) {
    const assetTag = await nextTag();
    const asset = await prisma.asset.upsert({
      where: { orgId_assetTag: { orgId: org.id, assetTag } },
      update: {},
      create: { orgId: org.id, assetTag, isBookable: false, ...def },
    });
    assets.push(asset);
  }

  // Final lifecycle status pass (allocated/under-maintenance/lost/retired),
  // applied after insert so the assetDefs table above stays readable.
  const statusOverrides = {
    1: "ALLOCATED", 2: "ALLOCATED", 6: "ALLOCATED", 9: "ALLOCATED", 13: "ALLOCATED", 16: "ALLOCATED", 30: "ALLOCATED",
    39: "ALLOCATED", 42: "ALLOCATED",
    4: "UNDER_MAINTENANCE", 17: "UNDER_MAINTENANCE", 18: "UNDER_MAINTENANCE", 46: "UNDER_MAINTENANCE",
    24: "LOST",
    12: "RETIRED", 11: "RETIRED", 36: "RETIRED",
  };
  for (const [idx, status] of Object.entries(statusOverrides)) {
    await prisma.asset.update({ where: { id: assets[Number(idx)].id }, data: { status } });
  }

  // ---------------------------------------------------------------------
  // Asset Kits — one ready-to-allocate demo kit. Assets 0/3/8 are left
  // AVAILABLE and untouched elsewhere in this script so the demo's "allocate
  // a multi-asset kit to a department" step can actually succeed live.
  // ---------------------------------------------------------------------
  const newHireKit = await prisma.assetKit.upsert({
    where: { orgId_name: { orgId: org.id, name: "New Hire Kit" } },
    update: {},
    create: {
      orgId: org.id,
      name: "New Hire Kit",
      description: "Laptop, monitor, and webcam bundle for onboarding a new employee.",
      createdById: manager.id,
    },
  });
  const newHireKitAssetIdxs = [0, 3, 8];
  for (const idx of newHireKitAssetIdxs) {
    await prisma.assetKitItem.upsert({
      where: { kitId_assetId: { kitId: newHireKit.id, assetId: assets[idx].id } },
      update: {},
      create: { kitId: newHireKit.id, assetId: assets[idx].id },
    });
  }

  const fieldTechKit = await prisma.assetKit.upsert({
    where: { orgId_name: { orgId: org.id, name: "Field Technician Kit" } },
    update: {},
    create: {
      orgId: org.id,
      name: "Field Technician Kit",
      description: "Camera, scooter, and portable drive set for on-site field service visits.",
      createdById: manager2.id,
    },
  });
  const fieldTechKitAssetIdxs = [34, 40, 43];
  for (const idx of fieldTechKitAssetIdxs) {
    await prisma.assetKitItem.upsert({
      where: { kitId_assetId: { kitId: fieldTechKit.id, assetId: assets[idx].id } },
      update: {},
      create: { kitId: fieldTechKit.id, assetId: assets[idx].id },
    });
  }

  // ---------------------------------------------------------------------
  // Allocations — active (matching ALLOCATED assets) + returned history
  // ---------------------------------------------------------------------
  const activeAllocationDefs = [
    { assetIdx: 1, toEmployeeId: employee.id, allocatedById: manager.id, expectedReturnDate: daysFromNow(30) },
    { assetIdx: 2, toEmployeeId: employee2.id, allocatedById: manager.id, expectedReturnDate: daysFromNow(60) },
    { assetIdx: 6, toEmployeeId: employee3.id, allocatedById: manager2.id, expectedReturnDate: daysFromNow(14) },
    { assetIdx: 9, toDepartmentId: engineering.id, allocatedById: manager.id },
    { assetIdx: 13, toEmployeeId: employee4.id, allocatedById: manager2.id, expectedReturnDate: daysAgo(-5) }, // overdue-ish edge case: past due date already
    { assetIdx: 16, toDepartmentId: facilities.id, allocatedById: manager2.id },
    { assetIdx: 30, toDepartmentId: fieldOps.id, allocatedById: manager2.id },
    { assetIdx: 39, toDepartmentId: facilities.id, allocatedById: manager2.id },
    { assetIdx: 42, toEmployeeId: employee6.id, allocatedById: manager.id, expectedReturnDate: daysFromNow(45) },
  ];
  for (const def of activeAllocationDefs) {
    await prisma.allocation.create({
      data: {
        assetId: assets[def.assetIdx].id,
        toEmployeeId: def.toEmployeeId ?? null,
        toDepartmentId: def.toDepartmentId ?? null,
        allocatedById: def.allocatedById,
        allocatedAt: daysAgo(20),
        expectedReturnDate: def.expectedReturnDate ?? null,
      },
    });
  }

  const returnedAllocationDefs = [
    { assetIdx: 0, toEmployeeId: employee5.id, allocatedById: manager.id, returnCondition: "GOOD", notes: "Returned on team transfer" },
    { assetIdx: 5, toEmployeeId: employee2.id, allocatedById: manager.id, returnCondition: "GOOD", notes: "No longer needed" },
    { assetIdx: 10, toDepartmentId: engineering.id, allocatedById: manager2.id, returnCondition: "FAIR", notes: "Desk reassigned" },
    { assetIdx: 14, toEmployeeId: employee3.id, allocatedById: manager.id, returnCondition: "GOOD", notes: "Meeting room furniture consolidated" },
    { assetIdx: 32, toEmployeeId: employee7.id, allocatedById: manager2.id, returnCondition: "GOOD", notes: "Upgraded to a larger display" },
    { assetIdx: 37, toDepartmentId: engineering.id, allocatedById: manager.id, returnCondition: "FAIR", notes: "Lounge area rearranged" },
  ];
  for (const def of returnedAllocationDefs) {
    await prisma.allocation.create({
      data: {
        assetId: assets[def.assetIdx].id,
        toEmployeeId: def.toEmployeeId ?? null,
        toDepartmentId: def.toDepartmentId ?? null,
        allocatedById: def.allocatedById,
        allocatedAt: daysAgo(90),
        returnedAt: daysAgo(45),
        returnCondition: def.returnCondition,
        checkInNotes: def.notes,
        status: "RETURNED",
      },
    });
  }

  // ---------------------------------------------------------------------
  // Transfer requests
  // ---------------------------------------------------------------------
  await prisma.transferRequest.create({
    data: {
      assetId: assets[1].id,
      fromEmployeeId: employee.id,
      toEmployeeId: employee2.id,
      requestedById: employee.id,
      reason: "Moving to a different team, handing off laptop",
      status: "REQUESTED",
    },
  });
  await prisma.transferRequest.create({
    data: {
      assetId: assets[2].id,
      fromEmployeeId: employee3.id,
      toEmployeeId: employee2.id,
      requestedById: employee3.id,
      approvedById: manager.id,
      reason: "Reassigned after role change",
      status: "COMPLETED",
      decidedAt: daysAgo(30),
    },
  });
  await prisma.transferRequest.create({
    data: {
      assetId: assets[13].id,
      fromEmployeeId: employee4.id,
      toEmployeeId: employee5.id,
      requestedById: employee4.id,
      approvedById: manager2.id,
      reason: "Requested a spare chair for home office",
      status: "REJECTED",
      decidedAt: daysAgo(15),
    },
  });

  // ---------------------------------------------------------------------
  // Bookings — 5 bookable assets, non-overlapping per asset, mixed status
  // ---------------------------------------------------------------------
  const bookingDefs = [
    { assetIdx: 25, bookedById: employee.id, title: "Sprint planning", start: atHour(daysAgo(2), 9), end: atHour(daysAgo(2), 10), status: "COMPLETED" },
    { assetIdx: 25, bookedById: depthead.id, onBehalfOfDeptId: engineering.id, title: "Design review", start: atHour(daysAgo(1), 14), end: atHour(daysAgo(1), 15), status: "COMPLETED" },
    { assetIdx: 25, bookedById: manager.id, title: "Vendor call", start: atHour(daysFromNow(1), 10), end: atHour(daysFromNow(1), 11), status: "UPCOMING" },
    { assetIdx: 26, bookedById: employee2.id, title: "1:1 sync", start: atHour(daysAgo(3), 11), end: atHour(daysAgo(3), 12), status: "COMPLETED" },
    { assetIdx: 26, bookedById: employee3.id, title: "Interview", start: atHour(daysFromNow(2), 9), end: atHour(daysFromNow(2), 9, 30), status: "UPCOMING" },
    { assetIdx: 26, bookedById: employee4.id, title: "Retro", start: atHour(daysFromNow(2), 15), end: atHour(daysFromNow(2), 16), status: "UPCOMING" },
    { assetIdx: 27, bookedById: admin.id, title: "Board meeting", start: atHour(daysAgo(1), 9), end: atHour(daysAgo(1), 11), status: "COMPLETED" },
    { assetIdx: 27, bookedById: manager2.id, title: "Budget review", start: atHour(daysFromNow(3), 13), end: atHour(daysFromNow(3), 14), status: "UPCOMING" },
    { assetIdx: 28, bookedById: employee5.id, title: "Training session", start: atHour(daysAgo(2), 13), end: atHour(daysAgo(2), 14), status: "COMPLETED" },
    { assetIdx: 28, bookedById: employee.id, title: "Client demo", start: atHour(daysFromNow(1), 16), end: atHour(daysFromNow(1), 17), status: "UPCOMING" },
    { assetIdx: 29, bookedById: depthead2.id, title: "Site visit", start: atHour(daysAgo(4), 8), end: atHour(daysAgo(4), 12), status: "COMPLETED" },
    { assetIdx: 29, bookedById: manager.id, title: "Offsite transport", start: atHour(daysFromNow(5), 8), end: atHour(daysFromNow(5), 17), status: "UPCOMING" },
    { assetIdx: 29, bookedById: employee2.id, title: "Cancelled pickup", start: atHour(daysFromNow(2), 10), end: atHour(daysFromNow(2), 11), status: "CANCELLED" },
    // Extra historical bookings spread across more weekdays/hours so the
    // booking heatmap (day-of-week x hour) has more than a handful of dots.
    { assetIdx: 25, bookedById: employee2.id, title: "Standup", start: atHour(daysAgo(9), 9), end: atHour(daysAgo(9), 9, 30), status: "COMPLETED" },
    { assetIdx: 25, bookedById: employee3.id, title: "Client call", start: atHour(daysAgo(16), 13), end: atHour(daysAgo(16), 14), status: "COMPLETED" },
    { assetIdx: 26, bookedById: employee.id, title: "Onboarding", start: atHour(daysAgo(11), 10), end: atHour(daysAgo(11), 11), status: "COMPLETED" },
    { assetIdx: 26, bookedById: manager2.id, title: "Vendor demo", start: atHour(daysAgo(18), 15), end: atHour(daysAgo(18), 16), status: "COMPLETED" },
    { assetIdx: 27, bookedById: depthead.id, title: "All-hands", start: atHour(daysAgo(6), 11), end: atHour(daysAgo(6), 12), status: "COMPLETED" },
    { assetIdx: 27, bookedById: employee4.id, title: "Planning offsite", start: atHour(daysAgo(13), 9), end: atHour(daysAgo(13), 10), status: "COMPLETED" },
    { assetIdx: 28, bookedById: employee3.id, title: "Product walkthrough", start: atHour(daysAgo(8), 14), end: atHour(daysAgo(8), 15), status: "COMPLETED" },
    { assetIdx: 29, bookedById: employee5.id, title: "Warehouse run", start: atHour(daysAgo(20), 9), end: atHour(daysAgo(20), 11), status: "COMPLETED" },
    // New bookable resources (47/48/49) from the expansion batch.
    { assetIdx: 47, bookedById: employee6.id, title: "Field team huddle", start: atHour(daysAgo(5), 10), end: atHour(daysAgo(5), 10, 30), status: "COMPLETED" },
    { assetIdx: 47, bookedById: employee7.id, title: "Facilities check-in", start: atHour(daysFromNow(1), 13), end: atHour(daysFromNow(1), 13, 30), status: "UPCOMING" },
    { assetIdx: 47, bookedById: manager.id, title: "Vendor huddle", start: atHour(daysAgo(14), 15), end: atHour(daysAgo(14), 15, 30), status: "COMPLETED" },
    { assetIdx: 48, bookedById: admin.id, title: "Product podcast recording", start: atHour(daysAgo(7), 11), end: atHour(daysAgo(7), 12, 30), status: "COMPLETED" },
    { assetIdx: 48, bookedById: manager2.id, title: "Investor update recording", start: atHour(daysFromNow(3), 9), end: atHour(daysFromNow(3), 10), status: "UPCOMING" },
    { assetIdx: 48, bookedById: employee2.id, title: "Internal AMA recording", start: atHour(daysAgo(22), 14), end: atHour(daysAgo(22), 15), status: "COMPLETED" },
    { assetIdx: 49, bookedById: employee6.id, title: "Field delivery run", start: atHour(daysAgo(10), 8), end: atHour(daysAgo(10), 10), status: "COMPLETED" },
    { assetIdx: 49, bookedById: employee4.id, title: "Site equipment drop-off", start: atHour(daysFromNow(4), 8), end: atHour(daysFromNow(4), 9), status: "UPCOMING" },
    { assetIdx: 49, bookedById: depthead2.id, title: "Client site visit", start: atHour(daysAgo(15), 9), end: atHour(daysAgo(15), 11), status: "COMPLETED" },
  ];
  for (const def of bookingDefs) {
    await prisma.booking.create({
      data: {
        assetId: assets[def.assetIdx].id,
        bookedById: def.bookedById,
        onBehalfOfDeptId: def.onBehalfOfDeptId ?? null,
        title: def.title,
        startTime: def.start,
        endTime: def.end,
        status: def.status,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Maintenance requests — every kanban column + one rejected, createdAt
  // explicitly spread across the trailing 6 months so the maintenance
  // frequency report (default 6-month window) has a bucket per month
  // instead of everything clustering on "now".
  // ---------------------------------------------------------------------
  await prisma.maintenanceRequest.create({
    data: { assetId: assets[3].id, raisedById: employee2.id, description: "Monitor flickering intermittently", priority: "LOW", createdAt: daysAgo(3) },
  });
  await prisma.maintenanceRequest.create({
    data: {
      assetId: assets[4].id, raisedById: employee3.id, description: "Paper jam on every print job", priority: "MEDIUM",
      status: "APPROVED", approvedById: manager.id, createdAt: daysAgo(25), approvedAt: daysAgo(23),
    },
  });
  await prisma.maintenanceRequest.create({
    data: {
      assetId: assets[17].id, raisedById: depthead2.id, description: "Hydraulic leak under the mast", priority: "HIGH",
      status: "TECHNICIAN_ASSIGNED", approvedById: manager2.id, createdAt: daysAgo(50), approvedAt: daysAgo(48), technicianId: employee5.id,
    },
  });
  await prisma.maintenanceRequest.create({
    data: {
      assetId: assets[18].id, raisedById: admin.id, description: "Switch keeps rebooting under load", priority: "URGENT",
      status: "IN_PROGRESS", approvedById: manager.id, createdAt: daysAgo(75), approvedAt: daysAgo(73), technicianId: employee4.id,
    },
  });
  await prisma.maintenanceRequest.create({
    data: {
      assetId: assets[7].id, raisedById: employee4.id, description: "Screen cracked after a drop", priority: "MEDIUM",
      status: "RESOLVED", approvedById: manager.id, createdAt: daysAgo(100), approvedAt: daysAgo(97), technicianId: employee5.id,
      resolvedAt: daysAgo(92), resolutionNotes: "Screen replaced under warranty",
    },
  });
  await prisma.maintenanceRequest.create({
    data: {
      assetId: assets[14].id, raisedById: employee3.id, description: "Wobbly leg on the conference table", priority: "LOW",
      status: "RESOLVED", approvedById: manager2.id, createdAt: daysAgo(130), approvedAt: daysAgo(127), technicianId: employee4.id,
      resolvedAt: daysAgo(122), resolutionNotes: "Tightened and re-shimmed",
    },
  });
  await prisma.maintenanceRequest.create({
    data: {
      assetId: assets[8].id, raisedById: employee5.id, description: "Requesting a newer webcam model", priority: "LOW", createdAt: daysAgo(160),
      status: "REJECTED", approvedById: manager.id, approvedAt: daysAgo(157),
    },
  });
  await prisma.maintenanceRequest.create({
    data: { assetId: assets[41].id, raisedById: employee6.id, description: "Firmware update failing to apply", priority: "MEDIUM", createdAt: daysAgo(5) },
  });
  await prisma.maintenanceRequest.create({
    data: {
      assetId: assets[44].id, raisedById: employee7.id, description: "Labels printing faded/misaligned", priority: "LOW",
      status: "APPROVED", approvedById: manager2.id, createdAt: daysAgo(40), approvedAt: daysAgo(38),
    },
  });
  await prisma.maintenanceRequest.create({
    data: {
      assetId: assets[46].id, raisedById: employee2.id, description: "Machine won't heat water, breaker trips", priority: "MEDIUM",
      status: "IN_PROGRESS", approvedById: manager.id, createdAt: daysAgo(60), approvedAt: daysAgo(58), technicianId: employee6.id,
    },
  });
  await prisma.maintenanceRequest.create({
    data: {
      assetId: assets[33].id, raisedById: employee4.id, description: "Mouse scroll wheel unresponsive", priority: "LOW",
      status: "RESOLVED", approvedById: manager2.id, createdAt: daysAgo(110), approvedAt: daysAgo(108), technicianId: employee5.id,
      resolvedAt: daysAgo(105), resolutionNotes: "Swapped for a spare from inventory",
    },
  });

  // ---------------------------------------------------------------------
  // Audit cycles — one CLOSED (with discrepancy report), one IN_PROGRESS
  // ---------------------------------------------------------------------
  const closedCycle = await prisma.auditCycle.create({
    data: {
      orgId: org.id,
      name: "Q2 Engineering Audit",
      scopeDeptId: engineering.id,
      startDate: daysAgo(20),
      endDate: daysAgo(10),
      status: "CLOSED",
      createdById: admin.id,
      closedById: admin.id,
      closedAt: daysAgo(9),
    },
  });
  await prisma.auditAssignment.createMany({
    data: [
      { cycleId: closedCycle.id, auditorId: manager.id },
      { cycleId: closedCycle.id, auditorId: depthead.id },
    ],
  });
  const closedScopeItems = [
    { assetIdx: 0, verification: "VERIFIED", auditedById: manager.id },
    { assetIdx: 1, verification: "VERIFIED", auditedById: depthead.id },
    { assetIdx: 22, verification: "MISSING", auditedById: manager.id, notes: "Not found at listed desk" },
    { assetIdx: 14, verification: "VERIFIED", auditedById: depthead.id },
    { assetIdx: 23, verification: "DAMAGED", auditedById: manager.id, notes: "Surface cracked" },
  ];
  for (const item of closedScopeItems) {
    await prisma.auditItem.create({
      data: {
        cycleId: closedCycle.id,
        assetId: assets[item.assetIdx].id,
        verification: item.verification,
        auditedById: item.auditedById,
        notes: item.notes ?? null,
        auditedAt: daysAgo(9),
      },
    });
  }
  // Mirror what the real close-endpoint transaction does: Missing -> Lost,
  // Damaged -> auto-raised Pending maintenance request, asset status untouched.
  await prisma.asset.update({ where: { id: assets[22].id }, data: { status: "LOST" } });
  await prisma.maintenanceRequest.create({
    data: {
      assetId: assets[23].id,
      raisedById: admin.id,
      description: 'Flagged damaged during audit cycle "Q2 Engineering Audit": Surface cracked',
      priority: "MEDIUM",
    },
  });
  await prisma.discrepancyReport.create({
    data: {
      cycleId: closedCycle.id,
      summary: {
        totalItems: closedScopeItems.length,
        verified: 3,
        missing: 1,
        damaged: 1,
        stillPending: 0,
        flaggedAssets: [
          { assetId: assets[22].id, assetTag: assets[22].assetTag, assetName: assets[22].name, verification: "MISSING" },
          { assetId: assets[23].id, assetTag: assets[23].assetTag, assetName: assets[23].name, verification: "DAMAGED" },
        ],
      },
      generatedAt: daysAgo(9),
    },
  });

  const inProgressCycle = await prisma.auditCycle.create({
    data: {
      orgId: org.id,
      name: "HQ Floor 1 Spot Check",
      scopeLocation: "HQ Floor 1",
      startDate: daysAgo(3),
      endDate: daysFromNow(4),
      status: "IN_PROGRESS",
      createdById: manager.id,
    },
  });
  await prisma.auditAssignment.create({ data: { cycleId: inProgressCycle.id, auditorId: manager2.id } });
  const inProgressScope = [
    { assetIdx: 4, verification: "VERIFIED", auditedById: manager2.id },
    { assetIdx: 13, verification: "VERIFIED", auditedById: manager2.id },
    { assetIdx: 25, verification: "VERIFIED", auditedById: manager2.id },
    { assetIdx: 14, verification: "PENDING" },
    { assetIdx: 23, verification: "PENDING" },
    { assetIdx: 26, verification: "PENDING" },
  ];
  for (const item of inProgressScope) {
    await prisma.auditItem.create({
      data: {
        cycleId: inProgressCycle.id,
        assetId: assets[item.assetIdx].id,
        verification: item.verification,
        auditedById: item.auditedById ?? null,
        auditedAt: item.auditedById ? daysAgo(1) : null,
      },
    });
  }

  // ---------------------------------------------------------------------
  // Activity log — a handful of entries so the feed isn't empty on first load
  // ---------------------------------------------------------------------
  const activityDefs = [
    { action: "asset.registered", entityType: "asset", entityId: assets[0].id, actorId: manager.id, metadata: { assetTag: assets[0].assetTag } },
    { action: "asset.allocated", entityType: "allocation", entityId: assets[1].id, actorId: manager.id, metadata: { assetTag: assets[1].assetTag } },
    { action: "transfer.requested", entityType: "transfer", entityId: assets[1].id, actorId: employee.id, metadata: { assetTag: assets[1].assetTag } },
    { action: "booking.confirmed", entityType: "booking", entityId: assets[25].id, actorId: employee.id, metadata: { assetTag: assets[25].assetTag } },
    { action: "maintenance.raised", entityType: "maintenance", entityId: assets[3].id, actorId: employee2.id, metadata: { assetTag: assets[3].assetTag } },
    { action: "maintenance.resolved", entityType: "maintenance", entityId: assets[7].id, actorId: manager.id, metadata: { assetTag: assets[7].assetTag } },
    { action: "audit.cycle_closed", entityType: "audit_cycle", entityId: closedCycle.id, actorId: admin.id, metadata: { name: closedCycle.name } },
    { action: "audit.cycle_created", entityType: "audit_cycle", entityId: inProgressCycle.id, actorId: manager.id, metadata: { name: inProgressCycle.name } },
    { action: "asset.registered", entityType: "asset", entityId: assets[31].id, actorId: manager2.id, metadata: { assetTag: assets[31].assetTag } },
    { action: "kit.created", entityType: "asset_kit", entityId: fieldTechKit.id, actorId: manager2.id, metadata: { name: fieldTechKit.name } },
    { action: "booking.confirmed", entityType: "booking", entityId: assets[48].id, actorId: admin.id, metadata: { assetTag: assets[48].assetTag } },
    { action: "maintenance.raised", entityType: "maintenance", entityId: assets[41].id, actorId: employee6.id, metadata: { assetTag: assets[41].assetTag } },
  ];
  for (const def of activityDefs) {
    await prisma.activityLog.create({
      data: { orgId: org.id, action: def.action, entityType: def.entityType, entityId: def.entityId, actorId: def.actorId, metadata: def.metadata },
    });
  }

  // ---------------------------------------------------------------------
  console.log(`Seeded org "${org.name}":`);
  console.log(`  ${activeUserDefs.length} active users, ${pendingDefs.length} pending-approval users`);
  console.log(`  4 departments (with 1 parent/child hierarchy), 5 asset categories`);
  console.log(`  ${assets.length} assets (42 individually-allocatable + 8 bookable)`);
  console.log(`  2 asset kits ("New Hire Kit" ${newHireKitAssetIdxs.length} assets, "Field Technician Kit" ${fieldTechKitAssetIdxs.length} assets)`);
  console.log(`  ${activeAllocationDefs.length} active + ${returnedAllocationDefs.length} returned allocations, 3 transfer requests`);
  console.log(`  ${bookingDefs.length} bookings, 12 maintenance requests, 2 audit cycles (1 closed + 1 in progress)`);
  console.log(`  ${activityDefs.length} activity log entries`);
  console.log(`Demo logins (password: ${DEMO_PASSWORD}):`);
  for (const def of activeUserDefs) console.log(`  ${def.email} — ${def.role}`);
  console.log(`Pending-approval users (no password yet): ${pendingDefs.map((d) => d.email).join(", ")}`);
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
