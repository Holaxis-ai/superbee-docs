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
 * - No answer, follow-ups included, offers more ("Want the…", "Would you like…") or ends with a
 *   question, except a reply listed in CLARIFYING (a clarifying question replaces an answer), and
 *   none holds more than one code block.
 * - A reply that gives the install command keeps the page's `${stable_version:?…}` guard or names a
 *   literal version, never a bare `${stable_version}`.
 * - A reply listed in AGENT_FIRST answers the default person: it says what to ask their agent, with an
 *   example prompt (quoted or in a code block), and gives no shell command to type as the step.
 * - A reply listed in COMMANDS (a "give me the commands" follow-up) gives a code block holding each
 *   listed text; the runner's code_verbatim checks the commands are the page's.
 * - A case in CLARIFY_FIRST is ambiguous on purpose: its first reply is one short clarifying question
 *   (cited sources are not expected), and its follow-up then answers agent-first.
 * - A follow-up listed in SHORT_FOLLOW_UPS (a bare "Yes" after an answer) stays under its word limit
 *   and holds no code block: it must not turn into a walkthrough.
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

/** Replies that may end with a question, as `<case id>` or `<case id>#<follow-up number>`. */
export const CLARIFYING = Object.freeze(["bare-yes#1", "get-started"]);

/** Follow-ups that must stay short, as `<case id>#<follow-up number>`, with their word limit. */
export const SHORT_FOLLOW_UPS = Object.freeze({ "bare-yes#1": 60 });

/** Replies that must answer agent-first, as `<case id>` or `<case id>#<follow-up number>`. */
export const AGENT_FIRST = Object.freeze([
  "host-setup",
  "setup-conversation#1",
  "bare-yes",
  "join-shared-bundle",
  "model-domain",
  "get-started#1",
]);

/** "Give me the commands" replies and the texts their code must hold. */
export const COMMANDS = Object.freeze({
  "join-shared-bundle#1": ["--pull-only"],
});

/** Cases whose question is ambiguous on purpose: the first reply is a clarifying question. */
export const CLARIFY_FIRST = Object.freeze(["get-started"]);

/** Most words a clarifying question may take. */
export const CLARIFY_WORDS = 40;

/** Fenced code: ``` or ~~~ fences of any length; an unclosed fence runs to the end of the reply. */
const fences = (answer) =>
  [...String(answer ?? "").matchAll(/^[ \t]*(`{3,}|~{3,})[^\n]*\n([\s\S]*?)(?:^[ \t]*\1[ \t]*$|(?![\s\S]))/gmu)].map(
    (match) => match[2],
  );

/**
 * Every line that installs Superbee with `npm install -g` keeps the page's guard or names a version: a
 * bare `${stable_version}` (or `$stable_version`) installs whatever npm `latest` is. Prose that only
 * mentions `npm install -g` is not an install line; `\` continuations are joined first.
 */
export function installCommandFailure(answer) {
  const lines = String(answer ?? "")
    .replace(/\\\r?\n[ \t]*/gu, " ")
    .split("\n")
    .filter((line) => INSTALL_LINE.test(line));
  for (const line of lines) {
    if (/\$\{stable_version\}|\$stable_version\b/u.test(line))
      return "install command drops the ${stable_version:?…} guard";
    if (!/\$\{stable_version:\?/u.test(line) && !/superbee@\d+\.\d+\.\d+/u.test(line))
      return "install command names neither the guarded variable nor a version";
  }
  return undefined;
}

const INSTALL_LINE = /npm (?:install|i) (?:-g|--global)\s+["']?superbee\b/u;

const SHELL = /^\s*(?:\$\s*)?(?:sudo\s+)?(?:superbee|npm|npx|pnpm|yarn|brew|git|node|cd|mkdir|export|curl)\b/u;

/**
 * An agent-first reply says what to ask the agent, with an example prompt (a quote, a blockquote or a
 * code block), and no fenced shell command and no `superbee setup --host` as the step. A prompt that
 * itself names a command ("Run `superbee setup`, explain…") is fine.
 */
export function agentFirstFailure(answer) {
  const text = String(answer ?? "");
  if (
    !/\b(?:ask|tell) (?:your|the|an) (?:AI )?agents?\b|\b(?:paste|give) (?:this|it|the prompt) (?:in)?to (?:your|the) (?:agent|host)\b/iu.test(
      text,
    )
  )
    return "not agent-first: it does not say what to ask the agent";
  // A prompt is a blockquote or a paired quotation: "…" and “…” may hold apostrophes; '…' may not.
  // Prompts never go in a code block, so a fence does not count as one.
  if (!/^\s*>|(?:^|[\s:])(?:"[^"\n]{12,}"|“[^”\n]{12,}”|['‘][^'’\n]{12,}['’])(?=[\s.,;:!?)[]|$)/mu.test(text))
    return "not agent-first: no example prompt in a quote or code block";
  // Installing the CLI is the person's own step, so the install line is not a shell step here.
  const shell = fences(text).some((block) =>
    block.split("\n").some((line) => SHELL.test(line) && !INSTALL_LINE.test(line)),
  );
  if (shell || /superbee setup --host/u.test(text)) return "not agent-first: gives a shell command to type as the step";
  return undefined;
}

/** Offers of more ("Want the…?", "Would you like…", "If you'd like…, just ask"), not plain conditions. */
const OFFER =
  /(?:^|[.!?:]\s+|\n)(?:want|wanted) (?:the|me|to see|more)\b|\b(?:(?<!what |which [\w ]{0,20})would you like|do you want (?:me|the|more|to see)|shall i|should i (?:show|walk|give)|let me know if|happy to (?:walk|show)|if you(?:'d| would) like[^.?!\n]*(?:,\s*i can|just ask)|just ask|i can (?:also )?(?:walk|show|give) you)\b/iu;

/** The reply's last sentence ends with a question mark (citations, quotes, brackets and emphasis aside). */
export function endsWithQuestion(answer) {
  return /\?["'’”)\]*_]*$/u.test(
    String(answer ?? "")
      .replace(CITATION, "")
      .trimEnd(),
  );
}

const codeBlocks = (answer) => fences(answer).length;

/** The behaviour checks every reply gets: no offer, no closing question, at most one code block. */
function replyFailures(key, answer) {
  if (!answer.trim()) return [`${key}: empty reply`];
  const failures = [];
  const clarifying = CLARIFYING.includes(key);
  const offer = clarifying ? null : answer.replace(/[‘’]/gu, "'").match(OFFER);
  if (offer) failures.push(`${key}: offers more ("${offer[0].trim()}")`);
  if (endsWithQuestion(answer) && !clarifying) failures.push(`${key}: ends with a question`);
  if (codeBlocks(answer) > 1) failures.push(`${key}: more than one code block`);
  const install = installCommandFailure(answer);
  if (install) failures.push(`${key}: ${install}`);
  const agentFirst = AGENT_FIRST.includes(key) ? agentFirstFailure(answer) : undefined;
  if (agentFirst) failures.push(`${key}: ${agentFirst}`);
  for (const text of COMMANDS[key] ?? [])
    if (!fences(answer).some((block) => block.includes(text))) failures.push(`${key}: no command block with ${text}`);
  if (CLARIFY_FIRST.includes(key)) {
    if (!endsWithQuestion(answer)) failures.push(`${key}: does not ask a clarifying question first`);
    if (answerWords(answer) > CLARIFY_WORDS || codeBlocks(answer) > 0)
      failures.push(`${key}: the clarifying question is not short`);
  }
  const limit = SHORT_FOLLOW_UPS[key];
  if (limit !== undefined && (answerWords(answer) >= limit || codeBlocks(answer) > 0))
    failures.push(`${key}: not short (${answerWords(answer)} words, under ${limit} and no code)`);
  return failures;
}

const SITE_DECLINE =
  /\b(?:(?:can(?:no|')t|cannot|won't|will not|am not able to|not able to|unable to) (?:share|reveal|disclose|provide|print|show|repeat|quote|output|tell you)|(?:don't|do not) (?:cover|mention|say|describe|document)|(?:don't|do not) have (?:an answer|information))\b/iu;

const CITATION = /\[\[source:[^[\]\s]+\]\]/gu;
const CITATION_MARK = /\[\[source:[^[\]\s]+\]\]/u;

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
      // A clarifying question first cites nothing; its follow-up must carry a citation marker instead
      // (below; the report holds no document ids for follow-ups, so the marker is what is checked).
      if (CLARIFY_FIRST.includes(row.id) && check.name === "expected_source_cited" && !CITATION_MARK.test(answer))
        continue;
      failures.push(check.name + (check.detail ? `: ${String(check.detail).slice(0, 120)}` : ""));
    }
    const any = REQUIRED_ANY[row.id];
    if (any && report.mode === "live" && !any.some((phrase) => lower.includes(phrase.toLowerCase())))
      failures.push(`includes one of: ${any.join(" | ")}`);
    if (!row.checks?.length) failures.push("no checks ran");
    const replies = [
      [row.id, answer],
      ...(row.followUps ?? []).map((followUp, index) => [`${row.id}#${index + 1}`, String(followUp.answer ?? "")]),
    ];
    if (report.mode === "live") for (const [key, text] of replies) failures.push(...replyFailures(key, text));
    if (
      report.mode === "live" &&
      CLARIFY_FIRST.includes(row.id) &&
      !CITATION_MARK.test(String(row.followUps?.[0]?.answer ?? ""))
    )
      failures.push(`${row.id}#1: the answer after the clarifying question cites no page`);
    const questions = replies.filter(([, text]) => endsWithQuestion(text)).length;
    return {
      id: row.id,
      category: row.category,
      ok: failures.length === 0,
      failures,
      words: answerWords(answer),
      replies: replies.length,
      questions,
    };
  });
  const cited = results.filter(
    (row) =>
      (row.category === "builder" || row.category === "evaluator") &&
      !CLARIFY_FIRST.includes(row.id) &&
      cases.find((c) => c.id === row.id)?.answer,
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
    replies: results.reduce((sum, row) => sum + row.replies, 0),
    endingInQuestion: results.reduce((sum, row) => sum + row.questions, 0),
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
    console.log(
      `${row.ok ? "pass" : "FAIL"}  ${row.id} (${row.category}, ${row.words} words)${row.failures.length ? "  " + row.failures.join("; ") : ""}`,
    );
  console.log(
    `${verdict.passed} passed, ${verdict.failed} failed, ${verdict.skipped} skipped · median cited answer ${verdict.medianWords} words` +
      `${report.mode === "live" ? ` (limit ${MEDIAN_WORDS}) · ${verdict.endingInQuestion} of ${verdict.replies} replies end with a question · $${verdict.costUsd.toFixed(4)} · ${Math.round(verdict.cacheReadShare * 100)}% of input read from cache` : " · no spend"} · ${report.mode}`,
  );
  process.exitCode = verdict.ok ? 0 : 1;
}
