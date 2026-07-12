const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

// Pure, isolated pbkdf2 implementation matching lib/password.ts to generate hashes directly
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("hex");
  return `pbkdf2:210000:${salt}:${hash}`;
}

const prisma = new PrismaClient();
const BASE_URL = "http://localhost:3000";

async function main() {
  console.log("🚀 Starting Auth + RBAC Smoke Test...");

  const testId = crypto.randomBytes(4).toString("hex");
  const orgSlug = `test-org-${testId}`;
  const userEmail = `user-${testId}@example.com`;
  const adminEmail = `admin-${testId}@example.com`;
  const password = "Password123!";

  console.log(`📝 Generated test credentials:`);
  console.log(`   Org Slug: ${orgSlug}`);
  console.log(`   User Email: ${userEmail}`);
  console.log(`   Admin Email: ${adminEmail}`);

  // 1. Create Organization via direct DB query (since orgs are created out-of-band)
  console.log("\n1. Seeding Organization directly in DB...");
  const org = await prisma.organization.create({
    data: {
      name: `Test Org ${testId}`,
      slug: orgSlug,
    },
  });
  console.log(`✅ Created Org: ${org.id}`);

  // 2. Signup -> expect success, no session
  console.log("\n2. Calling Signup API /api/auth/signup...");
  const signupRes = await fetch(`${BASE_URL}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test User",
      email: userEmail,
      password,
      confirmPassword: password,
      orgSlug,
    }),
  });

  const signupBody = await signupRes.json();
  console.log(`Status: ${signupRes.status}`);
  console.log(`Response:`, JSON.stringify(signupBody));

  if (signupRes.status !== 201) {
    throw new Error("Signup failed");
  }
  if (signupBody.data.user.status !== "PENDING_APPROVAL") {
    throw new Error("Expected user status to be PENDING_APPROVAL");
  }
  console.log("✅ Signup successful (Pending Approval)");

  // 3. Login -> expect 401 (pending approval)
  console.log("\n3. Testing Login for user prior to approval...");
  const preApproveLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: userEmail,
      password,
    }),
  });

  const preApproveLoginBody = await preApproveLoginRes.json();
  console.log(`Status: ${preApproveLoginRes.status}`);
  console.log(`Response:`, JSON.stringify(preApproveLoginBody));

  if (preApproveLoginRes.status !== 401) {
    throw new Error("Expected 401 status for unapproved user");
  }
  if (!preApproveLoginBody.error.message.includes("pending administrator approval")) {
    throw new Error("Expected pending approval error message");
  }
  console.log("✅ Unapproved user login blocked as expected");

  // 4. Seed admin user directly in DB
  console.log("\n4. Seeding Admin user directly in DB...");
  const adminPasswordHash = hashPassword(password);
  const adminUser = await prisma.user.create({
    data: {
      orgId: org.id,
      name: "Test Admin",
      email: adminEmail,
      passwordHash: adminPasswordHash,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  console.log(`✅ Created Admin: ${adminUser.id}`);

  // 5. Admin login -> expect success
  console.log("\n5. Calling Login API for Admin...");
  const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: adminEmail,
      password,
    }),
  });

  const adminLoginBody = await adminLoginRes.json();
  console.log(`Status: ${adminLoginRes.status}`);
  console.log(`Response:`, JSON.stringify(adminLoginBody));

  if (adminLoginRes.status !== 200) {
    throw new Error("Admin login failed");
  }

  // Extract session cookie from header
  const setCookieHeader = adminLoginRes.headers.get("set-cookie");
  if (!setCookieHeader) {
    throw new Error("No set-cookie header returned on login");
  }
  const adminCookie = setCookieHeader.split(";")[0];
  console.log(`✅ Admin logged in. Cookie: ${adminCookie}`);

  // 6. Admin approves user -> expect success
  console.log(`\n6. Admin approving user ${signupBody.data.user.id}...`);
  const approveRes = await fetch(`${BASE_URL}/api/users/${signupBody.data.user.id}/approve`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Cookie: adminCookie,
    },
  });

  const approveBody = await approveRes.json();
  console.log(`Status: ${approveRes.status}`);
  console.log(`Response:`, JSON.stringify(approveBody));

  if (approveRes.status !== 200) {
    throw new Error("Approve API call failed");
  }
  if (approveBody.data.user.status !== "ACTIVE") {
    throw new Error("User status should be ACTIVE after approval");
  }
  if (approveBody.data.user.approvedById !== adminUser.id) {
    throw new Error("User approvedById should be set to admin user's id");
  }
  console.log("✅ User approved successfully");

  // 7. User login -> expect success
  console.log("\n7. Calling Login API for approved User...");
  const userLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: userEmail,
      password,
    }),
  });

  const userLoginBody = await userLoginRes.json();
  console.log(`Status: ${userLoginRes.status}`);
  console.log(`Response:`, JSON.stringify(userLoginBody));

  if (userLoginRes.status !== 200) {
    throw new Error("Approved user login failed");
  }

  const userSetCookieHeader = userLoginRes.headers.get("set-cookie");
  if (!userSetCookieHeader) {
    throw new Error("No set-cookie header returned on user login");
  }
  const userCookie = userSetCookieHeader.split(";")[0];
  console.log(`✅ User logged in. Cookie: ${userCookie}`);

  // 8. Call /api/auth/me with User cookie
  console.log("\n8. Getting current user profile (/api/auth/me)...");
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: { Cookie: userCookie },
  });

  const meBody = await meRes.json();
  console.log(`Status: ${meRes.status}`);
  console.log(`Response:`, JSON.stringify(meBody));

  if (meRes.status !== 200) {
    throw new Error("GET /api/auth/me failed");
  }
  if (meBody.data.user.email !== userEmail || meBody.data.user.status !== "ACTIVE") {
    throw new Error("Returned user profile data mismatch");
  }
  console.log("✅ Profile verification successful");

  // 9. Logout -> verify session invalidated
  console.log("\n9. Logging out user...");
  const logoutRes = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: userCookie },
  });

  const logoutBody = await logoutRes.json();
  console.log(`Status: ${logoutRes.status}`);
  console.log(`Response:`, JSON.stringify(logoutBody));

  if (logoutRes.status !== 200) {
    throw new Error("Logout API call failed");
  }
  console.log("✅ User logged out");

  // Verify cookie is now invalid
  console.log("\n10. Verifying session is invalidated...");
  const mePostLogoutRes = await fetch(`${BASE_URL}/api/auth/me`, {
    method: "GET",
    headers: { Cookie: userCookie },
  });

  const mePostLogoutBody = await mePostLogoutRes.json();
  console.log(`Status: ${mePostLogoutRes.status}`);
  console.log(`Response:`, JSON.stringify(mePostLogoutBody));

  if (mePostLogoutRes.status !== 401) {
    throw new Error("Expected 401 status for invalidated session cookie");
  }
  console.log("✅ Session token invalidated successfully");

  console.log("\n🎉 All Auth + RBAC Smoke Tests passed successfully!");
}

main()
  .catch((err) => {
    console.error("\n❌ Smoke Test failed with error:", err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
