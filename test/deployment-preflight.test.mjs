import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { deploymentPreflight } from "../scripts/deployment-preflight.mjs";

const account = "a".repeat(32);
const secret = "never-emit-this-token";
const robots = "User-agent: *\nAllow: /\n";
const domain = { hostname: "docs.example.com", service: "docs", environment: "production" };
const deployment = { id: "deployment-id", versions: [{ version_id: "version-id", percentage: 100 }] };
async function fixture(t, overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "docs-preflight-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "dist"));
  await writeFile(path.join(root, "dist/robots.txt"), robots);
  await writeFile(path.join(root, "wrangler.jsonc"), JSON.stringify({ account_id: account,
    name: "docs", routes: [{ pattern: "docs.example.com", custom_domain: true }], ...overrides }));
  return root;
}
function api(value) { return new Response(JSON.stringify({ success: true, result: value })); }
function fetcher({ domains = [domain], deployments = { deployments: [deployment] }, body = robots,
  status = 200, failure, malformed = false } = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push(url);
    assert.equal(options.method, "GET");
    assert.equal(options.redirect, "error");
    if (url.startsWith("https://api.cloudflare.com/")) {
      assert.equal(options.headers.Authorization, `Bearer ${secret}`);
      if (failure) return new Response(secret, { status: failure });
      if (malformed) return new Response(secret);
      assert.ok(url.includes(`/accounts/${account}/workers/`));
      return api(url.endsWith("/domains") ? domains : deployments);
    }
    assert.equal(url, "https://docs.example.com/robots.txt");
    assert.equal(options.headers, undefined, "credentials never go to the public origin");
    return new Response(body, { status });
  };
  return { fetchImpl, calls };
}

test("preflight proves account-scoped ownership, deployments read access, and exact robots bytes", async (t) => {
  const root = await fixture(t);
  const mock = fetcher();
  assert.deepEqual(await deploymentPreflight({ root, token: secret, ...mock }), {
    schema: "https://getsuperbee.com/schemas/superbee-docs/deployment-preflight/v1", ok: true, reason: "VERIFIED",
  });
  assert.equal(mock.calls.length, 3);
});

test("preflight fails closed on provider ownership, authorization, incomplete responses, and robots drift", async (t) => {
  const root = await fixture(t);
  for (const [options, reason] of [
    [{ domains: [] }, "DOMAIN_NOT_OWNED"],
    [{ domains: [{ ...domain, hostname: "other.example.com" }] }, "DOMAIN_NOT_OWNED"],
    [{ domains: [{ ...domain, service: "other" }] }, "WORKER_MISMATCH"],
    [{ domains: [{ ...domain, environment: "preview" }] }, "WORKER_MISMATCH"],
    [{ failure: 403 }, "API_ACCESS_DENIED"],
    [{ failure: 404 }, "API_REQUEST_FAILED"],
    [{ malformed: true }, "API_INCOMPLETE"],
    [{ deployments: {} }, "API_INCOMPLETE"],
    [{ deployments: { deployments: [] } }, "API_INCOMPLETE"],
    [{ deployments: { deployments: [{ id: "partial" }] } }, "API_INCOMPLETE"],
    [{ body: `Cloudflare managed ${robots}` }, "ROBOTS_BYTES_MISMATCH"],
    [{ body: robots.replace("Allow", "Deny!") }, "ROBOTS_BYTES_MISMATCH"],
    [{ status: 403 }, "ROBOTS_STATUS_MISMATCH"],
  ]) {
    const result = await deploymentPreflight({ root, token: secret, ...fetcher(options) });
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.ok(!JSON.stringify(result).includes(secret));
    assert.ok(!JSON.stringify(result).includes(robots));
  }
});

test("wrong configured account cannot borrow another account's domain evidence", async (t) => {
  const root = await fixture(t, { account_id: "b".repeat(32) });
  let calls = 0;
  const result = await deploymentPreflight({ root, token: secret, fetchImpl: async (url) => {
    calls++;
    assert.ok(url.includes(`/accounts/${"b".repeat(32)}/`));
    return api([]);
  } });
  assert.equal(result.reason, "DOMAIN_NOT_OWNED");
  assert.equal(calls, 1);
});

test("missing credentials and unsafe configuration make no network requests; thrown errors are sanitized", async (t) => {
  const root = await fixture(t);
  const unexpected = async () => { throw new Error(secret); };
  assert.equal((await deploymentPreflight({ root, token: "", fetchImpl: unexpected })).reason, "TOKEN_MISSING");
  assert.equal((await deploymentPreflight({ root, token: secret, fetchImpl: unexpected })).reason, "API_UNREACHABLE");
  await writeFile(path.join(root, "wrangler.jsonc"), "{}");
  assert.equal((await deploymentPreflight({ root, token: secret, fetchImpl: unexpected })).reason, "INPUT_INVALID");
});
