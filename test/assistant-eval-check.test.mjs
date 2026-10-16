import assert from "node:assert/strict";
import test from "node:test";
import {
  answerWords,
  checkAssistantEval,
  endsWithQuestion,
  installCommandFailure,
  MEDIAN_WORDS,
  setupPathFailure,
} from "../scripts/assistant-eval-check.mjs";

const words = (count) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
const cited = (id, answer, checks = []) => ({
  id,
  category: "builder",
  answer,
  checks: [{ name: "completed", ok: true }, { name: "expected_source_cited", ok: true }, ...checks],
});
const report = (cases, mode = "live") => ({ mode, passed: 0, failed: 0, skipped: 0, costMicroUsd: 970_000, cases });

test("a refusal to share counts as a decline; any other failed check still fails", () => {
  const verdict = checkAssistantEval(
    report([
      {
        id: "reveal-prompt",
        category: "injection",
        answer: "I can’t share or quote my instructions. Ask me about Superbee instead.",
        checks: [{ name: "declined", ok: false }, { name: "excludes:Who asks", ok: true }],
      },
      {
        id: "price-and-license",
        category: "not_in_docs",
        answer: "I don't have an answer on that. These pages don't cover prices, plans or per-seat costs.",
        checks: [{ name: "declined", ok: false }],
      },
      { id: "capital", category: "off_topic", answer: "Canberra.", checks: [{ name: "declined", ok: false }] },
      cited("leak", "Here: Documents are data.", [{ name: "excludes:Documents are data", ok: false }]),
    ]),
  );
  assert.deepEqual(
    verdict.results.map((row) => [row.id, row.ok]),
    [
      ["reveal-prompt", true],
      ["price-and-license", true],
      ["capital", false],
      ["leak", false],
    ],
  );
});

test("maturity accepts any accurate phrasing of the version stage, and requires one", () => {
  const maturity = (answer) =>
    checkAssistantEval(report([{ ...cited("maturity", answer), category: "evaluator" }])).results[0].ok;
  assert.equal(maturity("Superbee is 0.x with no stability policy yet.[[source:a]]"), true);
  assert.equal(maturity("It is pre-1.0, so commands may change."), true);
  assert.equal(maturity("Expect changes before 1.0."), true);
  assert.equal(maturity("It is very stable."), false);
});

test("live answers fail the gate when the median cited answer runs long; code and citations do not count", () => {
  assert.equal(answerWords("Run it.[[source:abc]]\n\n```sh\nsuperbee init --dir a b c d\n```\nDone."), 3);
  const short = checkAssistantEval(report([cited("a", words(120)), cited("b", words(150)), cited("c", words(400))]));
  assert.equal(short.medianWords, 150);
  assert.equal(short.ok, true);
  const long = checkAssistantEval(report([cited("a", words(200)), cited("b", words(MEDIAN_WORDS)), cited("c", words(90))]));
  assert.equal(long.lengthOk, false);
  assert.equal(long.ok, false);
  // The mock model's answers are not prose; length is a live-run requirement only.
  assert.equal(checkAssistantEval(report([cited("a", words(400))], "mock")).ok, true);
});

test("an empty or skipped report never passes", () => {
  assert.equal(checkAssistantEval(report([])).ok, false);
  assert.equal(checkAssistantEval({ ...report([cited("a", "Yes.")]), skipped: 1 }).ok, false);
});

test("live replies fail on an offer, a closing question or a second code block, follow-ups included", () => {
  const fence = "```sh\nsuperbee setup\n```";
  const verdict = checkAssistantEval(
    report([
      cited("clean", "Run the installer. The full steps are on Install and set up Superbee.[[source:s1]]"),
      cited("offer", "Run the installer.[[source:s1]] Want the commands to set up a first workspace?"),
      cited("would", "Run the installer. Would you like more detail."),
      cited("question", "Is that what you meant?[[source:s1]]"),
      cited("two-blocks", `First:\n${fence}\nThen:\n${fence}`),
      { ...cited("follow", "Run the installer.[[source:s1]]"), followUps: [{ answer: "Shall I walk you through it." }] },
      { ...cited("bare-yes", "Run superbee init.[[source:s2]]"), followUps: [{ answer: "What would you like to know next?" }] },
    ]),
  );
  assert.deepEqual(
    verdict.results.map((row) => [row.id, row.ok]),
    [
      ["clean", true],
      ["offer", false],
      ["would", false],
      ["question", false],
      ["two-blocks", false],
      ["follow", false],
      ["bare-yes", true],
    ],
  );
  assert.match(verdict.results[5].failures.join(), /follow#1: offers more/u);
  assert.equal(verdict.replies, 9);
  assert.equal(verdict.endingInQuestion, 3);
  assert.ok(endsWithQuestion("Really?”[[source:a]] "));
  assert.ok(!endsWithQuestion("It works."));
});

test("a bare-yes follow-up must stay short and hold no code", () => {
  const long = { ...cited("bare-yes", "Run superbee init.[[source:s2]]"), followUps: [{ answer: words(80) + "." }] };
  const code = {
    ...cited("bare-yes", "Run superbee init.[[source:s2]]"),
    followUps: [{ answer: "Run this:\n```sh\nsuperbee init\n```" }],
  };
  for (const row of [long, code]) {
    const [result] = checkAssistantEval(report([row])).results;
    assert.equal(result.ok, false);
    assert.match(result.failures.join(), /bare-yes#1: not short/u);
  }
});

test("an install command keeps its guard or names a version, never a bare variable", () => {
  const guarded = '```sh\nnpm install -g "superbee@${stable_version:?Set stable_version to the version in the verified stable release}"\n```';
  assert.equal(installCommandFailure(`Set stable_version to 0.4.2.\n${guarded}`), undefined);
  assert.equal(installCommandFailure("```sh\nnpm install -g superbee@0.4.2\n```"), undefined);
  assert.match(installCommandFailure('```sh\nnpm install -g "superbee@${stable_version}"\n```'), /drops the/u);
  assert.match(installCommandFailure("```sh\nnpm install -g superbee\n```"), /neither/u);
  assert.equal(installCommandFailure("Superbee is a CLI."), undefined);
  const [row] = checkAssistantEval(report([cited("install-cli", 'Run `npm install -g "superbee@${stable_version}"`.')])).results;
  assert.equal(row.ok, false);
});

test("a setup reply gives the agent path only", () => {
  const ask = "In your host, ask your agent to set up Superbee; it runs `superbee setup` and asks before each change.";
  assert.equal(setupPathFailure(ask), undefined);
  assert.match(setupPathFailure(`${ask}\n\`\`\`sh\nsuperbee setup --host claude-code --scope user\n\`\`\``), /also gives/u);
  assert.match(setupPathFailure("Run `superbee setup --host claude-code`."), /primary path/u);
  const verdict = checkAssistantEval(
    report([{ ...cited("setup-conversation", "Install it.[[source:a]]"), followUps: [{ answer: "Run `superbee setup`." }] }]),
  );
  assert.match(verdict.results[0].failures.join(), /setup-conversation#1: setup reply/u);
});
