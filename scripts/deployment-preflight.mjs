import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const schema = "https://getsuperbee.com/schemas/superbee-docs/deployment-preflight/v1";
class PreflightFailure extends Error {}
function fail(code) { throw new PreflightFailure(code); }

async function boundedBytes(response, limit, code) {
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body ?? []) {
    size += chunk.byteLength;
    if (size > limit) fail(code);
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

/** Read-only evidence: account-scoped domain ownership, deployments access, and exact robots bytes.
 * API contracts: https://developers.cloudflare.com/api/resources/workers/subresources/domains/methods/list/
 * https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/deployments/methods/list/
 * This does not prove deployment write permission or replace post-deployment verification.
 */
export async function deploymentPreflight({ root = ".", token = process.env.CLOUDFLARE_API_TOKEN,
  fetchImpl = fetch } = {}) {
  const receipt = { schema, ok: false, reason: "PREFLIGHT_FAILED" };
  try {
    let config, expected;
    try {
      config = JSON.parse(await readFile(path.resolve(root, "wrangler.jsonc"), "utf8"));
      expected = await readFile(path.resolve(root, "dist/robots.txt"));
    } catch { fail("INPUT_INVALID"); }
    const routes = config.routes;
    if (!/^[a-f0-9]{32}$/.test(config.account_id ?? "")
      || !/^[a-zA-Z0-9_-]+$/.test(config.name ?? "")
      || !Array.isArray(routes) || routes.length !== 1 || routes[0].custom_domain !== true
      || !/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(routes[0].pattern ?? "")
      || expected.length === 0 || expected.length > 65536) fail("INPUT_INVALID");
    if (typeof token !== "string" || !token.trim()) fail("TOKEN_MISSING");
    const api = async (suffix) => {
      let response;
      try {
        response = await fetchImpl(`https://api.cloudflare.com/client/v4/accounts/${config.account_id}/workers/${suffix}`,
          { method: "GET", headers: { Authorization: `Bearer ${token}` }, redirect: "error", signal: AbortSignal.timeout(15000) });
      } catch { fail("API_UNREACHABLE"); }
      if (response.status === 401 || response.status === 403) fail("API_ACCESS_DENIED");
      if (!response.ok) fail("API_REQUEST_FAILED");
      let value;
      try { value = JSON.parse((await boundedBytes(response, 1048576, "API_INCOMPLETE")).toString("utf8")); }
      catch { fail("API_INCOMPLETE"); }
      if (value?.success !== true || value.result == null || (value.errors?.length ?? 0) !== 0) fail("API_INCOMPLETE");
      return value;
    };
    const domains = await api("domains");
    if (!Array.isArray(domains.result) || (domains.result_info?.total_pages ?? 1) > 1
      || (domains.result_info?.total_count ?? domains.result.length) !== domains.result.length) fail("API_INCOMPLETE");
    const matches = domains.result.filter((row) => row?.hostname === routes[0].pattern);
    if (matches.length !== 1) fail("DOMAIN_NOT_OWNED");
    if (matches[0].service !== config.name
      || (matches[0].environment !== undefined && matches[0].environment !== "production")) fail("WORKER_MISMATCH");
    const deployments = await api(`scripts/${encodeURIComponent(config.name)}/deployments`);
    if (!Array.isArray(deployments.result.deployments) || !deployments.result.deployments.length
      || deployments.result.deployments.some((row) => typeof row?.id !== "string" || !row.id
        || !Array.isArray(row.versions) || !row.versions.length
        || row.versions.some((version) => typeof version?.version_id !== "string" || !version.version_id
          || !Number.isFinite(version.percentage)))) fail("API_INCOMPLETE");
    let robots;
    try {
      robots = await fetchImpl(`https://${routes[0].pattern}/robots.txt`,
        { method: "GET", redirect: "error", signal: AbortSignal.timeout(15000) });
      if (robots.status !== 200) fail("ROBOTS_STATUS_MISMATCH");
      if (!(await boundedBytes(robots, expected.length, "ROBOTS_BYTES_MISMATCH")).equals(expected)) fail("ROBOTS_BYTES_MISMATCH");
    } catch (error) {
      if (error instanceof PreflightFailure) throw error;
      fail("ROBOTS_UNREACHABLE");
    }
    receipt.ok = true;
    receipt.reason = "VERIFIED";
  } catch (error) {
    receipt.reason = error instanceof PreflightFailure ? error.message : "PREFLIGHT_FAILED";
  }
  return receipt;
}

async function main(argv) {
  const options = {};
  let destination;
  for (let index = 0; index < argv.length; index += 2) {
    if (argv[index + 1] && argv[index] === "--root") options.root = argv[index + 1];
    else if (argv[index + 1] && argv[index] === "--receipt") destination = argv[index + 1];
    else throw new Error("invalid arguments");
  }
  const receipt = await deploymentPreflight(options);
  const text = `${JSON.stringify(receipt)}\n`;
  if (destination) await writeFile(destination, text, { mode: 0o600 });
  process.stdout.write(text);
  process.exitCode = receipt.ok ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { await main(process.argv.slice(2)); }
  catch { process.stdout.write(`${JSON.stringify({ schema, ok: false, reason: "CLI_INPUT_OR_RECEIPT_FAILED" })}\n`); process.exitCode = 1; }
}
