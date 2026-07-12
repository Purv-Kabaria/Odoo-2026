const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem(arr) {
  return arr[randomInt(0, arr.length - 1)];
}

function weightedPick(weights) {
  const total = weights.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = Math.random() * total;
  for (const [value, weight] of weights) {
    roll -= weight;
    if (roll <= 0) return value;
  }
  return weights[weights.length - 1][0];
}

function daysAgo(days) {
  return new Date(Date.now() - days * DAY_MS);
}

function randomDateBetween(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

// --- Departments ----------------------------------------------------------
// A small, deliberately nestable set (Field Ops has two children) so
// Screen 3's hierarchy and Audit's department scoping both have real data.
const departmentDefs = [
  { name: "Engineering", parent: null },
  { name: "Field Ops", parent: null },
  { name: "Field Ops - East", parent: "Field Ops" },
  { name: "Field Ops - West", parent: "Field Ops" },
  { name: "Facilities", parent: null },
  { name: "IT Support", parent: null },
  { name: "Finance", parent: null },
  { name: "HR", parent: null },
  { name: "Sales", parent: null },
  { name: "Legal", parent: null },
];

async function seedDepartments() {
  const byName = new Map();

  for (const def of departmentDefs) {
    const parentId = def.parent ? byName.get(def.parent)?.id : null;
    const department = await prisma.department.upsert({
      where: { name: def.name },
      update: { parentId: parentId ?? null },
      create: { name: def.name, parentId: parentId ?? null },
    });
    byName.set(def.name, department);
  }

  return Array.from(byName.values());
}

// --- Assets -----------------------------------------------------------------
const ASSET_COUNT = 500;

const categoryAssetNames = {
  Electronics: ["Dell Laptop", "MacBook Pro", "Monitor", "Projector", "Desktop PC", "Tablet", "Printer", "Scanner"],
  Furniture: ["Office Chair", "Standing Desk", "Bookshelf", "Filing Cabinet", "Conference Table"],
  Vehicles: ["Delivery Van", "Sedan", "Forklift", "Pickup Truck"],
  "IT Equipment": ["Network Switch", "Server Rack Unit", "Wireless Router", "UPS Battery Backup"],
  "Office Equipment": ["Whiteboard", "Shredder", "Coffee Machine", "Photocopier"],
};
const categories = Object.keys(categoryAssetNames);

const statusWeights = [
  ["AVAILABLE", 40],
  ["ALLOCATED", 35],
  ["RESERVED", 5],
  ["UNDER_MAINTENANCE", 8],
  ["LOST", 3],
  ["RETIRED", 6],
  ["DISPOSED", 3],
];
const conditionWeights = [
  ["NEW", 15],
  ["GOOD", 45],
  ["FAIR", 25],
  ["POOR", 10],
  ["DAMAGED", 5],
];

const buildings = ["Main HQ", "Annex Building", "Warehouse 1", "Field Office"];
const floors = ["Ground Floor", "1st Floor", "2nd Floor", "3rd Floor"];

/** ~30% of assets get a coarse building-level location (no desk) so a
 * LOCATION-scoped audit cycle has more than one asset to match against —
 * the rest get a desk-level location matching the Screen 8 mockup. */
function randomLocation() {
  const building = randomItem(buildings);
  if (Math.random() < 0.3) return building;
  const desk = `Desk ${String.fromCharCode(65 + randomInt(0, 9))}${randomInt(1, 40)}`;
  return `${building} - ${randomItem(floors)} - ${desk}`;
}

function costRangeCentsFor(category) {
  if (category === "Vehicles") return [800000, 4500000];
  if (category === "IT Equipment") return [50000, 600000];
  return [5000, 250000];
}

async function seedAssets(departments) {
  const assets = [];

  for (let index = 1; index <= ASSET_COUNT; index += 1) {
    const assetTag = `AF-${String(index).padStart(4, "0")}`;
    const category = randomItem(categories);
    const [minCost, maxCost] = costRangeCentsFor(category);
    const isBookable = (category === "Vehicles" || category === "IT Equipment") && Math.random() < 0.35;

    const asset = await prisma.asset.upsert({
      where: { assetTag },
      update: {},
      create: {
        assetTag,
        name: randomItem(categoryAssetNames[category]),
        category,
        serialNumber: Math.random() < 0.9 ? `SN-${assetTag}-${randomInt(1000, 9999)}` : null,
        status: weightedPick(statusWeights),
        condition: weightedPick(conditionWeights),
        location: randomLocation(),
        departmentId: randomItem(departments).id,
        acquisitionDate: daysAgo(randomInt(30, 3 * 365)),
        acquisitionCostCents: randomInt(minCost, maxCost),
        isBookable,
      },
    });
    assets.push(asset);
  }

  return assets;
}

// --- Audit cycles -------------------------------------------------------
const CYCLE_COUNT = 20;

const itemStatusWeightsClosed = [
  ["VERIFIED", 82],
  ["MISSING", 10],
  ["DAMAGED", 8],
];
const itemStatusWeightsActiveProgress = [
  ["PENDING", 45],
  ["VERIFIED", 40],
  ["MISSING", 8],
  ["DAMAGED", 7],
];

async function seedAuditCycles(departments, assets, auditorPool) {
  const existing = await prisma.auditCycle.count();
  if (existing > 0) {
    console.log("Audit cycles already seeded, skipping.");
    return { cycles: 0, items: 0, discrepancies: 0 };
  }

  const distinctLocations = Array.from(new Set(assets.map((asset) => asset.location).filter(Boolean)));

  // Build cycle definitions first (with randomized historical dates), then
  // process them in chronological order so LOST status flips accumulate
  // the same way they would in real usage.
  const defs = Array.from({ length: CYCLE_COUNT }, (_, index) => {
    const isActive = index >= CYCLE_COUNT - 4; // last 4 stay ACTIVE
    const startDate = isActive
      ? daysAgo(randomInt(1, 10))
      : randomDateBetween(daysAgo(365), daysAgo(20));
    const endDate = new Date(startDate.getTime() + randomInt(7, 21) * DAY_MS);
    const scopeType = Math.random() < 0.85 ? "DEPARTMENT" : "LOCATION";
    const department = scopeType === "DEPARTMENT" ? randomItem(departments) : null;
    const location = scopeType === "LOCATION" ? randomItem(distinctLocations) : null;
    const auditors = Array.from(
      new Set(Array.from({ length: randomInt(1, 3) }, () => randomItem(auditorPool).id)),
    );

    return {
      name:
        scopeType === "DEPARTMENT"
          ? `Audit: ${department.name} — ${startDate.toISOString().slice(0, 7)}`
          : `Audit: ${location} — ${startDate.toISOString().slice(0, 7)}`,
      scopeType,
      departmentId: department?.id ?? null,
      location,
      startDate,
      endDate,
      isActive,
      auditorIds: auditors,
    };
  }).sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  let totalItems = 0;
  let totalDiscrepancies = 0;

  for (const def of defs) {
    const scopedAssets = await prisma.asset.findMany({
      where: {
        ...(def.scopeType === "DEPARTMENT"
          ? { departmentId: def.departmentId }
          : { location: def.location }),
        status: { notIn: ["RETIRED", "DISPOSED"] },
      },
      select: { id: true, assetTag: true, name: true, location: true },
    });

    const cycle = await prisma.auditCycle.create({
      data: {
        name: def.name,
        scopeType: def.scopeType,
        departmentId: def.departmentId,
        location: def.location,
        startDate: def.startDate,
        endDate: def.endDate,
        status: def.isActive ? "ACTIVE" : "CLOSED",
        closedAt: def.isActive ? null : new Date(def.endDate.getTime() + DAY_MS),
        createdAt: def.startDate,
        createdById: randomItem(def.auditorIds),
        closedById: def.isActive ? null : randomItem(def.auditorIds),
      },
    });

    await prisma.auditCycleAuditor.createMany({
      data: def.auditorIds.map((auditorId) => ({ cycleId: cycle.id, auditorId })),
      skipDuplicates: true,
    });

    const flagged = [];

    for (const asset of scopedAssets) {
      const status = def.isActive
        ? weightedPick(itemStatusWeightsActiveProgress)
        : weightedPick(itemStatusWeightsClosed);
      const isResolved = status !== "PENDING";

      const item = await prisma.auditItem.create({
        data: {
          cycleId: cycle.id,
          assetId: asset.id,
          expectedLocation: asset.location,
          status,
          note: status === "MISSING" ? "Not found at expected location" : status === "DAMAGED" ? "Visible damage noted during walkthrough" : null,
          verifiedById: isResolved ? randomItem(def.auditorIds) : null,
          verifiedAt: isResolved ? randomDateBetween(def.startDate, def.endDate) : null,
        },
      });
      totalItems += 1;

      if (status === "MISSING" || status === "DAMAGED") {
        flagged.push({ item, asset, status });
      }
    }

    if (!def.isActive && flagged.length > 0) {
      await prisma.auditDiscrepancy.createMany({
        data: flagged.map(({ item, asset, status }) => ({
          cycleId: cycle.id,
          assetId: asset.id,
          assetTag: asset.assetTag,
          assetName: asset.name,
          expectedLocation: item.expectedLocation,
          type: status,
          note: item.note,
          resolvedAssetStatus: status === "MISSING" ? "LOST" : null,
        })),
      });
      totalDiscrepancies += flagged.length;

      const missingAssetIds = flagged.filter((f) => f.status === "MISSING").map((f) => f.asset.id);
      if (missingAssetIds.length > 0) {
        await prisma.asset.updateMany({
          where: { id: { in: missingAssetIds } },
          data: { status: "LOST" },
        });
      }
    }
  }

  return { cycles: defs.length, items: totalItems, discrepancies: totalDiscrepancies };
}

async function main() {
  const departments = await seedDepartments();
  const assets = await seedAssets(departments);

  const auditorPool = await prisma.user.findMany({ select: { id: true }, take: 60 });
  if (auditorPool.length === 0) {
    console.log("No users found — run `pnpm users:populate` first. Skipping audit cycles.");
    console.log(`Seeded ${departments.length} departments and ${assets.length} assets.`);
    return;
  }

  const auditResult = await seedAuditCycles(departments, assets, auditorPool);

  console.log(
    `Seeded ${departments.length} departments, ${assets.length} assets, ${auditResult.cycles} audit cycles, ` +
      `${auditResult.items} audit items, ${auditResult.discrepancies} discrepancies.`,
  );
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
