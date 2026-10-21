// A synthetic hosted export for tests: the portable-export archive (store-only zip with its digest
// manifest) the host's `/sync/v1/export` answers, and a fetch that serves it. No network.
import { createHash } from "node:crypto";
import { crc32 } from "@superbee/core/portable-export";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");

/** A stored ZIP of `entries`, every CRC correct. */
export function zip(entries) {
  const parts = [];
  const directory = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const checksum = crc32(entry.bytes);
    const local = Buffer.alloc(30 + name.length);
    local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x800, 6);
    local.writeUInt32LE(checksum, 14); local.writeUInt32LE(entry.bytes.length, 18); local.writeUInt32LE(entry.bytes.length, 22);
    local.writeUInt16LE(name.length, 26); name.copy(local, 30);
    const central = Buffer.alloc(46 + name.length);
    central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x800, 8);
    central.writeUInt32LE(checksum, 16); central.writeUInt32LE(entry.bytes.length, 20); central.writeUInt32LE(entry.bytes.length, 24);
    central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42); name.copy(central, 46);
    parts.push(local, entry.bytes); directory.push(central); offset += local.length + entry.bytes.length;
  }
  const end = Buffer.alloc(22);
  const size = directory.reduce((sum, record) => sum + record.length, 0);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(size, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, ...directory, end]);
}

const KIND = (file) => (file === "index.md" || file.endsWith("/index.md") || file === "log.md" ? "reserved" : file.endsWith(".md") ? "document" : "blob");

const manifestOf = (entries, counts, { bundleId, revision, exportedAt }, page) => ({
  format: "superbee-export/1",
  source: { tenantId: "tenant-1", bundleId, revision, okfEdition: "0.2" },
  exportedAt,
  counts,
  ...(page ? { page } : {}),
  entries: entries.map(({ name, bytes }) => ({ path: name, bytes: bytes.length, sha256: sha(bytes) })),
});

function prepare(files) {
  const entries = Object.entries(files).map(([name, text]) => ({ name, bytes: Buffer.from(text) }));
  const counts = { documents: 0, reserved: 0, blobs: 0 };
  for (const { name } of entries) counts[{ document: "documents", reserved: "reserved", blob: "blobs" }[KIND(name)]] += 1;
  return { entries, counts };
}

const SOURCE = { bundleId: "superbee-docs", revision: 7, exportedAt: "2026-10-17T12:00:00.000Z" };

/** The whole-bundle export archive of `files` ({path: text}); `tamper` changes one entry's bytes after its digest is taken. */
export function exportArchive(files, { tamper, ...source } = {}) {
  const { entries, counts } = prepare(files);
  const manifest = manifestOf(entries, counts, { ...SOURCE, ...source });
  const stored = entries.map((entry) => (entry.name === tamper ? { ...entry, bytes: Buffer.from(`${entry.bytes}!`) } : entry));
  return zip([...stored, { name: "superbee-export.json", bytes: Buffer.from(JSON.stringify(manifest)) }]);
}

/**
 * The pages of a paged export of `files`, `size` entries each, as core's paged route answers them:
 * every page states the whole bundle's counts and its own place (`from`, `count`, `total`), and
 * every page but the last names the cursor of the next (`p<index>`).
 */
export function exportPages(files, size, source = {}) {
  const { entries, counts } = prepare(files);
  const pages = [];
  for (let from = 0; from < entries.length; from += size) {
    const slice = entries.slice(from, from + size);
    const last = from + size >= entries.length;
    const page = { from, count: slice.length, total: entries.length, ...(last ? {} : { next: `p${pages.length + 1}` }) };
    const manifest = manifestOf(slice, counts, { ...SOURCE, ...source }, page);
    pages.push(zip([...slice, { name: "superbee-export.json", bytes: Buffer.from(JSON.stringify(manifest)) }]));
  }
  return pages;
}

/**
 * A fetch for a host from before paged export: the paged request is refused `invalid_input`, and
 * the whole archive is answered once. Given `pages` (exportPages), it answers page by page instead; `whoami` names the holaxis-sites workspace. `answer(request)` may replace any answer. Every request is recorded.
 */
export function exportHost(archive, { answer, pages } = {}) {
  const requests = [];
  const fetch = async (input, init = {}) => {
    const request = new Request(input, init);
    const body = JSON.parse(await request.text() || "{}");
    requests.push({ url: request.url, authorization: request.headers.get("authorization"), redirect: request.redirect, body });
    const replaced = answer?.(request, body);
    if (replaced) return replaced;
    const { origin, pathname: route } = new URL(request.url);
    // The pinned CLI resolves --host through RFC 9728 protected-resource metadata; the library does not.
    if (route.startsWith("/.well-known/oauth-protected-resource")) {
      return Response.json({
        resource: `${origin}/mcp`,
        authorization_servers: ["https://issuer.example.test/"],
        bearer_methods_supported: ["header"],
        superbee_cli_client_id: "fixture-cli-client",
      });
    }
    // The pinned CLI asks who the bearer is before it exports; the library does not.
    if (route === "/sync/v1/whoami") {
      return Response.json({ principalId: "workload-1", tenantIds: ["tenant-1"], workspaces: [{ tenantId: "tenant-1", slug: "holaxis-sites" }] });
    }
    if (route !== "/sync/v1/export") return Response.json({ error: "not_found" }, { status: 404 });
    if (body.paged && pages) {
      const index = body.cursor === undefined ? 0 : Number(String(body.cursor).slice(1));
      return new Response(pages[index], { status: 200, headers: { "content-type": "application/zip" } });
    }
    if (body.paged) return Response.json({ error: { code: "invalid_input", message: "no paging", retryable: false } }, { status: 400 });
    return new Response(archive, { status: 200, headers: { "content-type": "application/zip" } });
  };
  return { fetch, requests };
}
