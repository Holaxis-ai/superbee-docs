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

/** The whole-bundle export archive of `files` ({path: text}); `tamper` changes one entry's bytes after its digest is taken. */
export function exportArchive(files, { bundleId = "superbee-docs", revision = 7, exportedAt = "2026-10-17T12:00:00.000Z", tamper } = {}) {
  const entries = Object.entries(files).map(([name, text]) => ({ name, bytes: Buffer.from(text) }));
  const counts = { documents: 0, reserved: 0, blobs: 0 };
  for (const { name } of entries) counts[{ document: "documents", reserved: "reserved", blob: "blobs" }[KIND(name)]] += 1;
  const manifest = {
    format: "superbee-export/1",
    source: { tenantId: "tenant-1", bundleId, revision, okfEdition: "0.2" },
    exportedAt,
    counts,
    entries: entries.map(({ name, bytes }) => ({ path: name, bytes: bytes.length, sha256: sha(bytes) })),
  };
  const stored = entries.map((entry) => (entry.name === tamper ? { ...entry, bytes: Buffer.from(`${entry.bytes}!`) } : entry));
  return zip([...stored, { name: "superbee-export.json", bytes: Buffer.from(JSON.stringify(manifest)) }]);
}

/**
 * A fetch for a host from before paged export: the paged request is refused `invalid_input`, and
 * the whole archive is answered once; `whoami` names the holaxis-sites workspace. `answer(request)` may replace any answer. Every request is recorded.
 */
export function exportHost(archive, { answer } = {}) {
  const requests = [];
  const fetch = async (input, init = {}) => {
    const request = new Request(input, init);
    const body = JSON.parse(await request.text() || "{}");
    requests.push({ url: request.url, authorization: request.headers.get("authorization"), body });
    const replaced = answer?.(request, body);
    if (replaced) return replaced;
    const route = new URL(request.url).pathname;
    // The pinned CLI asks who the bearer is before it exports; the library does not.
    if (route === "/sync/v1/whoami") {
      return Response.json({ principalId: "workload-1", tenantIds: ["tenant-1"], workspaces: [{ tenantId: "tenant-1", slug: "holaxis-sites" }] });
    }
    if (route !== "/sync/v1/export") return Response.json({ error: "not_found" }, { status: 404 });
    if (body.paged) return Response.json({ error: { code: "invalid_input", message: "no paging", retryable: false } }, { status: 400 });
    return new Response(archive, { status: 200, headers: { "content-type": "application/zip" } });
  };
  return { fetch, requests };
}
