// hosted-workload-token: run one command with a fresh Superbee workload bearer for holaxis-sites.
//
//   node scripts/hosted-workload-token.mjs exec -- <command> [args...]
//
// The CI half of the workload credential (superbee-hosted docs/workload-apps.md), the same client
// Here & Main uses. In a GitHub Actions job with `id-token: write`:
//   1. ask GitHub for an OIDC token with the audience of the holaxis-sites placement origin;
//   2. POST it to the gateway's /sync/v1/workload-exchange for the registered app (DOCS_HOSTED_APP_ID);
//   3. mask the bearer (and the GitHub token) in the log;
//   4. run <command> with SUPERBEE_ACCESS_TOKEN (the 900 s `sbw_` bearer) and SUPERBEE_HOST (the gateway)
//      in its environment, and exit with its status.
// The bearer reaches only that command's process tree, never $GITHUB_ENV or a later step, and every
// long step gets its own exchange (design m6: there is no refresh; a run may exchange 20 times). The
// child does not get ACTIONS_ID_TOKEN_REQUEST_URL/_TOKEN, so nothing it runs can mint another token.
//
// Fixed here, never from an input (design §10 M3 condition 2): the audience, the gateway and the
// workspace. The app id comes from the repository variable DOCS_HOSTED_APP_ID; it only names a row, and
// the row's own claim checks (repository, branch, workflow refs, events, environment) decide.
// SUPERBEE_HOST is the gateway because an `sbw_` bearer carries no audience: the CLI follows
// holaxis-sites.getsuperbee.com/.well-known/superbee-workspace to the gateway and requires the pinned
// host to resolve to that same audience (https://mcp.getsuperbee.com/mcp).
//
// A transient failure (no answer, a 5xx, 429) is retried twice, 5 s then 20 s apart, each time with
// a fresh GitHub token (a token's jti is single use); a refusal (4xx with its code) is final.
//
// exit: the command's status; 2 usage or configuration; 3 the exchange was refused or failed.
import { spawn } from "node:child_process";
import { constants } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const AUDIENCE = "https://holaxis-sites.getsuperbee.com";
export const GATEWAY = "https://mcp.getsuperbee.com";
export const WORKSPACE = "holaxis-sites";
const APP_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BEARER = /^sbw_[A-Za-z0-9_-]{20,200}$/;
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

const MAX_BODY = 64 * 1024;
const LIFETIME = { min: 60_000, max: 3_600_000 };   // the host issues 900 s
const DELAYS = [5_000, 20_000];

const fail = (message, code = 3, transient = false) => { throw Object.assign(new Error(message), { exit: code, transient }); };

/** The fixed refusal code of an exchange answer body, or null. */
function codeOf(body) {
  if (!body || typeof body !== "object") return null;
  const c = typeof body.refused === "string" ? body.refused : typeof body.error === "string" ? body.error : body.error?.code;
  return typeof c === "string" && /^[a-z0-9_]{1,64}$/.test(c) ? c : null;
}

/** A GitHub Actions OIDC token for AUDIENCE, from the job's token request (`id-token: write`). */
export async function githubToken(env, request = fetch) {
  const url = env.ACTIONS_ID_TOKEN_REQUEST_URL;
  const bearer = env.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  if (!url || !bearer) fail("no GitHub OIDC token request in this job: it needs `permissions: id-token: write`", 2);
  const u = new URL(url);
  if (u.protocol !== "https:") fail("the GitHub token request URL is not https", 2);
  u.searchParams.set("audience", AUDIENCE);
  let response;
  try {
    response = await request(u, { headers: { Authorization: `Bearer ${bearer}`, Accept: "application/json" }, redirect: "error", signal: AbortSignal.timeout(15_000) });
  } catch (e) { fail(`could not reach GitHub's token service (${e.name})`, 3, true); }
  if (!response.ok) fail(`GitHub's token service answered ${response.status}`, 3, response.status >= 500 || response.status === 429);
  const value = (await response.json().catch(() => ({})))?.value;
  if (typeof value !== "string" || !JWT.test(value)) fail("GitHub's token service returned no token");
  return value;
}

/** The body as text, read no further than MAX_BODY bytes (null past it or on a read error). */
async function boundedText(response) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel().catch(() => {}); return null; }
      chunks.push(value);
    }
  } catch { return null; }
  return Buffer.concat(chunks).toString("utf8");
}

/** Exchange a GitHub token for the app's bearer. Returns {token, expiresAt, bundles}. */
export async function exchange({ app, oidc, request = fetch, now = Date.now() }) {
  let response;
  try {
    response = await request(`${GATEWAY}/sync/v1/workload-exchange`, {
      method: "POST",
      headers: { Authorization: `Bearer ${oidc}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ app }),
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
  } catch (e) { fail(`could not reach ${GATEWAY} (${e.name})`, 3, true); }
  const text = await boundedText(response);
  let body = null;
  try { body = text === null ? null : JSON.parse(text); } catch { body = null; }
  if (!response.ok) fail(`the workload exchange refused: ${response.status} ${codeOf(body) ?? "(no code)"}`, 3, response.status >= 500 || response.status === 429);
  const token = body?.token;
  if (body?.version !== 1 || typeof token !== "string" || !BEARER.test(token)) fail("the workload exchange answered without a bearer");
  if (body.workspace?.origin !== AUDIENCE || body.workspace?.slug !== WORKSPACE) fail(`the bearer is for ${JSON.stringify(body.workspace?.origin ?? null)}, not ${AUDIENCE}`);
  const expiresAt = typeof body.expiresAt === "number" ? (body.expiresAt < 1e12 ? body.expiresAt * 1000 : body.expiresAt) : Date.parse(body.expiresAt ?? "");
  if (!Number.isFinite(expiresAt)) fail("the workload exchange answered no readable expiry");
  if (expiresAt - now < LIFETIME.min || expiresAt - now > LIFETIME.max) fail(`the workload exchange answered a bearer living ${Math.round((expiresAt - now) / 1000)} s, outside ${LIFETIME.min / 1000}..${LIFETIME.max / 1000} s`);
  return { token, expiresAt, bundles: body.bundles ?? null };
}

/** The `exec` mode, with its effects injected: returns the exit status. */
export async function run(argv, { env = process.env, request = fetch, out = (s) => process.stdout.write(s), log = (s) => process.stderr.write(s), spawnChild = spawnInherit, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  const [mode, sep, ...command] = argv;
  if (mode !== "exec" || sep !== "--" || !command.length) fail("usage: hosted-workload-token.mjs exec -- <command> [args...]", 2);
  const app = (env.DOCS_HOSTED_APP_ID ?? "").trim().toLowerCase();
  if (!APP_ID.test(app)) fail("DOCS_HOSTED_APP_ID (repository variable: the holaxis-sites workload app id) is not set to an app id", 2);
  let token, expiresAt;
  for (let attempt = 0; ; attempt++) {
    try {
      const oidc = await githubToken(env, request);
      out(`::add-mask::${oidc}\n`);
      ({ token, expiresAt } = await exchange({ app, oidc, request }));
      break;
    } catch (e) {
      if (!e.transient || attempt >= DELAYS.length) throw e;
      log(`hosted-workload-token: ${e.message}; retrying in ${DELAYS[attempt] / 1000} s\n`);
      await sleep(DELAYS[attempt]);
    }
  }
  out(`::add-mask::${token}\n`);
  log(`hosted-workload-token: bearer for ${WORKSPACE} until ${new Date(expiresAt).toISOString()}; running ${path.basename(command[0])}\n`);
  const childEnv = { ...env, SUPERBEE_ACCESS_TOKEN: token, SUPERBEE_HOST: GATEWAY };
  delete childEnv.ACTIONS_ID_TOKEN_REQUEST_URL;
  delete childEnv.ACTIONS_ID_TOKEN_REQUEST_TOKEN;
  return spawnChild(command, childEnv);
}

function spawnInherit([cmd, ...args], env) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { env, stdio: "inherit" });
    child.on("error", (e) => { process.stderr.write(`hosted-workload-token: could not run ${cmd}: ${e.code ?? e.message}\n`); resolve(127); });
    child.on("exit", (code, signal) => resolve(code ?? (signal ? 128 + (constants.signals[signal] ?? 0) : 1)));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    process.stdout.write(`::error::hosted-workload-token: ${e.message}\n`);
    process.exitCode = e.exit ?? 3;
  });
}
