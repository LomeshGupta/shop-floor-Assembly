import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const mode = (process.env.BC_MODE || "demo").trim().toLowerCase();
if (mode === "demo") {
  console.error("BC_MODE is demo. Set BC_MODE=sandbox or BC_MODE=production before running this check.");
  process.exit(1);
}
if (mode !== "sandbox" && mode !== "production") {
  console.error(`Invalid BC_MODE: ${mode}`);
  process.exit(1);
}

function required(name) {
  const value = (process.env[name] || "").trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function result(label, message) {
  console.log(`[PASS] ${label}: ${message}`);
}

function fail(label, message) {
  console.error(`[FAIL] ${label}: ${message}`);
}

async function main() {
  const tenantId = required("BC_TENANT_ID");
  const clientId = required("BC_CLIENT_ID");
  const clientSecret = required("BC_CLIENT_SECRET");
  const scope = (process.env.BC_SCOPE || "https://api.businesscentral.dynamics.com/.default").trim();
  const environmentName = (process.env.BC_ENVIRONMENT_NAME || (mode === "production" ? "Production" : "Sandbox")).trim();
  const companyId = required("BC_COMPANY_ID").replace(/^\{|\}$/g, "").toLowerCase();
  const authServiceName = (process.env.BC_AUTH_SERVICE_NAME || "ShopFloorAuthenticationAPI").trim();
  const actionsServiceName = (process.env.BC_ACTIONS_SERVICE_NAME || "ShopFloorAssemblyActionsAPI").trim();
  const authorityUrl = (process.env.BC_AUTHORITY_URL || `https://login.microsoftonline.com/${tenantId}`).replace(/\/+$/, "");
  const environmentRoot = `https://api.businesscentral.dynamics.com/v2.0/${encodeURIComponent(tenantId)}/${encodeURIComponent(environmentName)}`;
  const apiRoot = (process.env.BC_SHOPFLOOR_API_BASE_URL || `${environmentRoot}/api/velvotix/shopFloor/v1.0`).replace(/\/+$/, "");
  const odataRoot = (process.env.BC_ODATA_BASE_URL || `${environmentRoot}/ODataV4`).replace(/\/+$/, "");

  console.log(`Checking Business Central (${mode}, environment=${environmentName})`);

  const tokenResponse = await fetch(`${authorityUrl}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: clientId,
      client_secret: clientSecret,
      scope,
    }),
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || typeof tokenPayload.access_token !== "string") {
    const detail = tokenPayload.error_description || tokenPayload.error || `HTTP ${tokenResponse.status}`;
    fail("OAuth token", String(detail).slice(0, 400));
    process.exitCode = 1;
    return;
  }
  const token = tokenPayload.access_token;
  result("OAuth token", "client-credentials token acquired (token value not displayed)");

  const headers = { Authorization: `Bearer ${token}`, Accept: "application/json;odata.metadata=minimal" };
  const companiesResponse = await fetch(`${environmentRoot}/api/v2.0/companies`, { headers });
  const companiesText = await companiesResponse.text();
  if (!companiesResponse.ok) {
    fail("Company API", `HTTP ${companiesResponse.status}: ${companiesText.slice(0, 300)}`);
    process.exitCode = 1;
    return;
  }
  const companies = JSON.parse(companiesText);
  const company = (companies.value || []).find((item) => String(item.id).toLowerCase() === companyId);
  if (!company) {
    fail("Company ID", `The configured company GUID was not returned by ${environmentName}/api/v2.0/companies`);
    process.exitCode = 1;
    return;
  }
  result("Company ID", `${company.name} (${company.id})`);

  const customApiUrl = `${apiRoot}/companies(${companyId})/shopFloorAssignments?$top=1`;
  const customApiResponse = await fetch(customApiUrl, { headers });
  const customApiText = await customApiResponse.text();
  if (!customApiResponse.ok) {
    fail("Shop Floor custom API", `HTTP ${customApiResponse.status}: ${customApiText.slice(0, 500)}`);
    process.exitCode = 1;
  } else {
    result("Shop Floor custom API", "shopFloorAssignments returned HTTP 200");
  }

  const metadataResponse = await fetch(`${odataRoot}/$metadata`, { headers });
  const metadataText = await metadataResponse.text();
  if (!metadataResponse.ok) {
    fail("OData metadata", `HTTP ${metadataResponse.status}: ${metadataText.slice(0, 500)}`);
    process.exitCode = 1;
  } else {
    result("OData metadata", "OData V4 endpoint is reachable");
    const authListed = metadataText.includes(authServiceName) && metadataText.includes("Login");
    const actionsListed = metadataText.includes(actionsServiceName) && metadataText.includes("StartWork");
    if (authListed && actionsListed) {
      result("Published codeunit actions", `${authServiceName}_Login and ${actionsServiceName}_StartWork appear in metadata`);
    } else {
      console.warn(`[CHECK] Published codeunit actions: metadata did not clearly contain both expected names. In BC Web Services, verify Codeunit 78568 -> ${authServiceName} and Codeunit 78569 -> ${actionsServiceName}, both Published.`);
    }
  }

  console.log("\nIf OAuth and Company pass but the Shop Floor API fails, check extension installation, company GUID, and the SHOPFLOOR OPER permission set.");
  console.log("If OData metadata passes but login/actions fail, check the two Codeunit rows on the Business Central Web Services page and their exact Service Name values.");
}

main().catch((error) => {
  fail("Configuration/check", error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
