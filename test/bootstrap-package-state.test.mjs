import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  BOOTSTRAPPED_PACKAGES,
  removeBootstrappedPackages,
} from "../scripts/bootstrap-package-state.mjs";

test("exact-pin bootstrap removes stale owned packages and preserves unrelated dependencies", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "superbee-docs-bootstrap-"));
  try {
    for (const name of BOOTSTRAPPED_PACKAGES) {
      const directory = path.join(root, "node_modules", ...name.split("/"));
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, "stale.txt"), "old bytes");
    }
    const unrelated = path.join(root, "node_modules", "unrelated", "keep.txt");
    await mkdir(path.dirname(unrelated), { recursive: true });
    await writeFile(unrelated, "keep");

    await removeBootstrappedPackages(root);

    for (const name of BOOTSTRAPPED_PACKAGES) {
      await assert.rejects(
        readFile(path.join(root, "node_modules", ...name.split("/"), "stale.txt")),
        (error) => error.code === "ENOENT",
      );
    }
    assert.equal(await readFile(unrelated, "utf8"), "keep");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
