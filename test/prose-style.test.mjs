import assert from "node:assert/strict";
import test from "node:test";

import { proseStyleFindings } from "../scripts/prose-style.mjs";

test("prose style ignores fenced Markdown examples and output", () => {
  const markdown = [
    "Direct authored prose.",
    "",
    "```text",
    "This is not a task tracker. It is a workspace — with load-bearing examples.",
    "```",
    "",
    "~~~output",
    "The output is not short, but complete.",
    "~~~",
  ].join("\n");

  assert.deepEqual(proseStyleFindings("guide.md", markdown), []);
});

test("prose style blocks objective signals in authored Markdown", () => {
  const markdown = [
    "An em dash — appears here.",
    "This load-bearing phrase appears here.",
    "This is not just a document.",
    "The product is not narrow, but broad.",
    "The bundle is not a database; it is a workspace.",
  ].join("\n");

  assert.deepEqual(
    proseStyleFindings("guide.md", markdown).map((finding) => finding.split(": ").at(-1)),
    [
      "em dash",
      "load-bearing",
      "not just/merely/simply",
      "not X, but Y contrast",
      "X is not Y; it is Z contrast",
    ],
  );
});

test("prose style catches a contrast split across wrapped Markdown lines", () => {
  const markdown = [
    "This is not a task tracker.",
    "It is a shared workspace.",
  ].join("\n");

  assert.deepEqual(proseStyleFindings("guide.md", markdown), [
    "guide.md:1: X is not Y; it is Z contrast",
  ]);
});

test("prose style scans Mermaid authoring source", () => {
  const mermaid = "subgraph distribution[\"Composition — current main\"]\nend\n";
  assert.deepEqual(proseStyleFindings("architecture.mmd", mermaid), [
    "architecture.mmd:1: em dash",
  ]);
});
