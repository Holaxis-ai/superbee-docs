import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function run(args) {
  const { stdout } = await execFileAsync("superbee", [...args, "--json"], {
    maxBuffer: 4 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

test("the documented Context Note journey leaves a discoverable and conforming handoff", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "superbee-docs-context-journey-"));
  const bundle = path.join(root, ".superbee");
  const body = path.join(root, "handoff.md");
  try {
    await run(["init", "--create-only", "--dir", bundle]);
    await run([
      "doc", "write", "decisions/publish-docs",
      "--type", "Decision",
      "--title", "Publish documentation",
      "--body", "Publish only reviewed bundle knowledge.",
      "--dir", bundle,
    ]);
    await writeFile(body, "# Summary\n\nThe publication path is ready for review.\n", "utf8");

    const created = await run([
      "new", "Context Note", "docs-publishing-handoff",
      "--title", "Documentation publishing handoff",
      "--body-file", body,
      "--dir", bundle,
    ]);
    assert.equal(created.id, "context-notes/docs-publishing-handoff");

    const read = await run(["doc", "read", created.id, "--dir", bundle]);
    await writeFile(body, "# Summary\n\nThe publication path is ready for final review.\n", "utf8");
    const updated = await run([
      "doc", "update", created.id,
      "--body-file", body,
      "--expected-version", read.head_version,
      "--dir", bundle,
    ]);
    assert.equal(updated.changed, true);

    await run([
      "link", "add", created.id, "decisions/publish-docs",
      "--text", "continues from",
      "--dir", bundle,
    ]);
    const [listed, linked, home, status] = await Promise.all([
      run(["list", "--type", "Context Note", "--dir", bundle]),
      run(["link", "show", created.id, "--dir", bundle]),
      run(["home", "--no-update-check", "--dir", bundle]),
      run(["status", "--limit", "0", "--dir", bundle]),
    ]);

    assert.equal(listed.count, 1);
    assert.equal(listed.docs[0].id, created.id);
    assert.equal(linked.outbound_count, 1);
    assert.equal(linked.outbound[0].to, "decisions/publish-docs");
    assert.ok(home.bundle.recent.rows.some((row) => row.id === created.id));
    assert.equal(status.malformed, 0);
    assert.equal(status.kind_warnings, 0);
    assert.equal(status.unresolved_links, 0);
    assert.equal(status.orphans, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("the documented external recipe journey creates and verifies a governed domain instance", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "superbee-docs-kind-journey-"));
  const bundle = path.join(root, ".superbee");
  const recipe = path.join(root, "experiment-recipe");
  const convention = path.join(recipe, "conventions");
  const body = path.join(root, "experiment.md");
  try {
    await run(["init", "--create-only", "--recipe", "none", "--dir", bundle]);
    await mkdir(convention, { recursive: true });
    await writeFile(
      path.join(recipe, "recipe.md"),
      [
        "---",
        "type: Recipe",
        "id: experiment-model",
        "title: Experiment model",
        'version: "1"',
        "summary: Defines the Experiment domain concept.",
        "content_policy: definitions-only",
        "---",
        "# Experiment model",
        "",
        "Installs the reviewed Experiment convention.",
        "",
      ].join("\n"),
      "utf8",
    );
    await writeFile(
      path.join(convention, "experiment.md"),
      [
        "---",
        "type: Convention",
        "title: Experiment",
        "governs: Experiment",
        "description: A bounded test of a stated question and method.",
        "path: experiments/",
        "fields:",
        "  required: [title, progress_status]",
        "  optional: [owner]",
        "  values:",
        "    progress_status: [planned, running, complete]",
        "  descriptions:",
        "    progress_status: Current execution state.",
        "    owner: Person responsible for the next action.",
        "  terminal:",
        "    progress_status: [complete]",
        "links:",
        "  uses: Dataset",
        "link_descriptions:",
        "  uses: Dataset used by the experiment.",
        "sections: [Question, Method, Result]",
        "freshness_horizon: 30d",
        "---",
        "# Experiment",
        "",
        "Use this Kind for a bounded test with a stable question, method, and result structure.",
        "",
      ].join("\n"),
      "utf8",
    );

    const applied = await run(["recipe", "add", recipe, "--dir", bundle]);
    assert.equal(applied.changed, true);
    const kinds = await run(["kinds", "--dir", bundle]);
    assert.equal(kinds.count, 1);
    assert.equal(kinds.kinds[0].governs, "Experiment");

    await run([
      "doc", "write", "datasets/customer-sample",
      "--type", "Dataset",
      "--title", "Customer sample",
      "--dir", bundle,
    ]);
    await writeFile(
      body,
      "# Question\n\nDoes shorter onboarding copy improve completion?\n\n" +
        "# Method\n\nCompare two variants.\n\n# Result\n\nPending.\n",
      "utf8",
    );
    const created = await run([
      "new", "Experiment", "onboarding-copy",
      "--title", "Shorter onboarding copy",
      "--progress_status", "running",
      "--owner", "Product research",
      "--body-file", body,
      "--link", "uses=datasets/customer-sample",
      "--dir", bundle,
    ]);
    assert.equal(created.id, "experiments/onboarding-copy");

    const addedField = await run([
      "kind", "field", "Experiment", "add", "confidence",
      "--values", "low,medium,high",
      "--dir", bundle,
    ]);
    assert.equal(addedField.changed, true);
    const evolvedKinds = await run(["kinds", "--dir", bundle]);
    assert.ok(evolvedKinds.kinds[0].optional.includes("confidence"));

    const [listed, linked, status] = await Promise.all([
      run(["list", "--type", "Experiment", "--limit", "0", "--dir", bundle]),
      run(["link", "show", created.id, "--text", "uses", "--dir", bundle]),
      run(["status", "--limit", "0", "--dir", bundle]),
    ]);
    assert.equal(listed.count, 1);
    assert.equal(listed.docs[0].progress_status, "running");
    assert.equal(linked.outbound_count, 1);
    assert.equal(linked.outbound[0].to, "datasets/customer-sample");
    assert.equal(status.malformed, 0);
    assert.equal(status.kind_warnings, 0);
    assert.equal(status.unresolved_links, 0);
    assert.equal(status.link_type_violations, 0);
    assert.equal(status.orphans, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
