import "./no-network.mjs";
import { readFileSync } from "node:fs";

// Public golden fixtures copied from source bc4314b07dc53a9e6e15de78c17cafe49c1b5ea8.
// Only named read POSTs are simulated; neither socket access nor real credentials are available.
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.origin !== "https://hosted.example" || init?.method !== "POST" || url.search || url.hash) {
    throw new Error("External or unsupported fixture request refused");
  }
  const json = (body) => new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
  if (url.pathname === "/sync/v1/whoami" && init.body === "{}") return json({ principalId: "principal-7", tenantIds: ["fixture-workspace"] });
  if (url.pathname === "/sync/v1/bundles" && init.body === "{}") return json({ ok: true, data: { bundles: [{ bundleId: "team.knowledge", name: "Disposable fixture" }] } });
  const mapped = { "/sync/v1/capabilities": "capabilities-operations", "/sync/v1/heads": "heads-200",
    "/sync/v1/snapshot": "snapshot-complete", "/sync/v1/operations": "operations-200" }[url.pathname];
  if (!mapped || init.body !== '{"bundleId":"team.knowledge"}') throw new Error("Unconfigured fixture request refused");
  const { response } = JSON.parse(readFileSync(new URL(`./${mapped}.json`, import.meta.url), "utf8"));
  return new Response(response.body, { status: response.status, headers: response.headers });
};
