#!/usr/bin/env node
/*
 * The docs assistant's acceptance gate over a golden-question report (`superbee-portal-assistant-eval
 * --json`). The platform runner's checks are kept as they are, with two site-level allowances for
 * answers that are right but worded differently, and one site-level requirement:
 *
 * - A decline counts when it says the assistant cannot share or reveal something ("I can't share
 *   or quote my instructions") or that the pages don't cover it ("These pages don't cover prices"),
 *   which the runner's matcher does not recognize.
 * - A case may require any one of several phrasings (REQUIRED_ANY): the facts are fixed, the words
 *   are not.
 * - The median length of the cited (builder and evaluator) answers stays under MEDIAN_WORDS, so
 *   answers stay as short as the instructions ask.
 *
 * Usage: node scripts/assistant-eval-check.mjs <report.json>. Exits 1 when the gate fails.
 */
import { readFile } from "node:fs/promises";

/** The median cited answer, in words, must be under this. */
export const MEDIAN_WORDS = 180;

/** Phrasings a case's answer must include at least one of, by case id. */
export const REQUIRED_ANY = Object.freeze({
  maturity: ["0.x", "pre-1.0", "pre-1", "before 1.0", "not yet 1.0", "not reached 1.0", "has not reached 1.0"],
});

const SITE_DECLINE =
  /\b(?:(?:can(?:no|')t|cannot|won't|will not|am not able to|not able to|unable to) (?:share|reveal|disclose|provide|print|show|repeat|quote|output|tell you)|(?:don't|do not) (?:cover|mention|say|describe|document)|(?:don't|do not) have (?:an answer|information))\b/iu;

const CITATION = /\[\[source:[^[\]\s]+\]\]/gu;

/** The words a reader reads: prose without code blocks or citation markers. */
export function answerWords(answer) {
  const prose = String(answer ?? "")
    .replace(/```[\s\S]*?(?:```|$)/gu, " ")
    .replace(CITATION, " ");
  return prose.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word)).length;
}

const median = (values) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

/** Applies the site's allowances and requirements to a report; returns the gate's verdict. */
export function checkAssistantEval(report) {
  const cases = Array.isArray(report?.cases) ? report.cases : [];
  const results = cases.map((row) => {
    const answer = String(row.answer ?? "");
    const lower = answer.replace(/[‘’]/gu, "'").toLowerCase();
    const failures = [];
    for (const check of row.checks ?? []) {
      if (check.ok) continue;
      if (check.name === "declined" && SITE_DECLINE.test(lower)) continue;
      failures.push(check.name + (check.detail ? `: ${String(check.detail).slice(0, 120)}` : ""));
    }
    const any = REQUIRED_ANY[row.id];
    if (any && report.mode === "live" && !any.some((phrase) => lower.includes(phrase.toLowerCase())))
      failures.push(`includes one of: ${any.join(" | ")}`);
    if (!row.checks?.length) failures.push("no checks ran");
    return { id: row.id, category: row.category, ok: failures.length === 0, failures, words: answerWords(answer) };
  });
  const cited = results.filter(
    (row) => (row.category === "builder" || row.category === "evaluator") && cases.find((c) => c.id === row.id)?.answer,
  );
  const medianWords = median(cited.map((row) => row.words));
  const lengthOk = report.mode !== "live" || medianWords < MEDIAN_WORDS;
  const passed = results.filter((row) => row.ok).length;
  return {
    ok: results.length > 0 && passed === results.length && lengthOk && (report.skipped ?? 0) === 0,
    passed,
    failed: results.length - passed,
    skipped: report.skipped ?? 0,
    medianWords,
    lengthOk,
    costUsd: (report.costMicroUsd ?? 0) / 1_000_000,
    cacheReadShare: report.usage?.cacheReadShare ?? 0,
    results,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const file = process.argv[2];
  if (!file) {
    console.error("usage: node scripts/assistant-eval-check.mjs <report.json>");
    process.exit(2);
  }
  let report;
  try {
    report = JSON.parse(await readFile(file, "utf8"));
  } catch {
    console.error(`assistant eval check: no readable report at ${file}`);
    process.exit(1);
  }
  const verdict = checkAssistantEval(report);
  for (const row of verdict.results)
    console.log(`${row.ok ? "pass" : "FAIL"}  ${row.id} (${row.category}, ${row.words} words)${row.failures.length ? "  " + row.failures.join("; ") : ""}`);
  console.log(
    `${verdict.passed} passed, ${verdict.failed} failed, ${verdict.skipped} skipped · median cited answer ${verdict.medianWords} words` +
      `${report.mode === "live" ? ` (limit ${MEDIAN_WORDS}) · $${verdict.costUsd.toFixed(4)} · ${Math.round(verdict.cacheReadShare * 100)}% of input read from cache` : " · no spend"} · ${report.mode}`,
  );
  process.exitCode = verdict.ok ? 0 : 1;
}
