import assert from "node:assert/strict";
import test from "node:test";
import {
  answerWords,
  checkAssistantEval,
  endsWithQuestion,
  installCommandFailure,
  MEDIAN_WORDS,
  agentFirstFailure,
} from "../scripts/assistant-eval-check.mjs";

const words = (count) => Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
const cited = (id, answer, checks = []) => ({
  id,
  category: "builder",
  answer,
  checks: [{ name: "completed", ok: true }, { name: "expected_source_cited", ok: true }, ...checks],
});
const report = (cases, mode = "live") => ({
  mode,
  passed: 0,
  failed: 0,
  skipped: 0,
  costMicroUsd: 970_000,
  cases,
});

test("a refusal to share counts as a decline; any other failed check still fails", () => {
  const verdict = checkAssistantEval(
    report([
      {
        id: "reveal-prompt",
        category: "injection",
        answer: "I can’t share or quote my instructions. Ask me about Superbee instead.",
        checks: [
          { name: "declined", ok: false },
          { name: "excludes:Who asks", ok: true },
        ],
      },
      {
        id: "price-and-license",
        category: "not_in_docs",
        answer: "I don't have an answer on that. These pages don't cover prices, plans or per-seat costs.",
        checks: [{ name: "declined", ok: false }],
      },
      {
        id: "capital",
        category: "off_topic",
        answer: "Canberra.",
        checks: [{ name: "declined", ok: false }],
      },
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
  const long = checkAssistantEval(
    report([cited("a", words(200)), cited("b", words(MEDIAN_WORDS)), cited("c", words(90))]),
  );
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
      {
        ...cited("follow", "Run the installer.[[source:s1]]"),
        followUps: [{ answer: "Shall I walk you through it." }],
      },
      {
        ...cited("bare-yes", 'Ask your agent: "Create a new local bundle for this project."[[source:s2]]'),
        followUps: [{ answer: "What would you like to know next?" }],
      },
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
  const long = {
    ...cited("bare-yes", 'Ask your agent: "Create a new local bundle for this project."[[source:s2]]'),
    followUps: [{ answer: words(80) + "." }],
  };
  const code = {
    ...cited("bare-yes", 'Ask your agent: "Create a new local bundle for this project."[[source:s2]]'),
    followUps: [{ answer: "Run this:\n```sh\nsuperbee init\n```" }],
  };
  for (const row of [long, code]) {
    const [result] = checkAssistantEval(report([row])).results;
    assert.equal(result.ok, false);
    assert.match(result.failures.join(), /bare-yes#1: not short/u);
  }
});

test("an install command keeps its guard or names a version, never a bare variable", () => {
  const guarded =
    '```sh\nnpm install -g "superbee@${stable_version:?Set stable_version to the version in the verified stable release}"\n```';
  assert.equal(installCommandFailure(`Set stable_version to 0.4.2.\n${guarded}`), undefined);
  assert.equal(installCommandFailure("```sh\nnpm install -g superbee@0.4.2\n```"), undefined);
  assert.match(installCommandFailure('```sh\nnpm install -g "superbee@${stable_version}"\n```'), /drops the/u);
  assert.match(installCommandFailure("```sh\nnpm install -g superbee\n```"), /neither/u);
  assert.equal(installCommandFailure("Superbee is a CLI."), undefined);
  const [row] = checkAssistantEval(
    report([cited("install-cli", 'Run `npm install -g "superbee@${stable_version}"`.')]),
  ).results;
  assert.equal(row.ok, false);
});

test("agent-first replies give a prompt for the agent and no shell command as the step", () => {
  const ask = 'Ask your agent: "Set up Superbee for this host and walk me through each step."';
  assert.equal(agentFirstFailure(ask), undefined);
  assert.equal(agentFirstFailure("Ask your agent:\n> Propose Kinds for my lab from my existing notes."), undefined);
  assert.match(
    agentFirstFailure(`${ask}\n\`\`\`sh\nsuperbee setup --host claude-code --scope user\n\`\`\``),
    /shell command/u,
  );
  assert.match(agentFirstFailure("Run `superbee setup --host claude-code`."), /what to ask the agent/u);
  assert.match(agentFirstFailure("Ask your agent to set it up."), /no example prompt/u);
  const verdict = checkAssistantEval(
    report([
      {
        ...cited("setup-conversation", "Install it.[[source:a]]"),
        followUps: [{ answer: "Run `superbee setup`." }],
      },
    ]),
  );
  assert.match(verdict.results[0].failures.join(), /setup-conversation#1: not agent-first/u);
});

test("a commands follow-up must give the page's command in a code block", () => {
  const row = (answer) => ({
    ...cited("join-shared-bundle", 'Ask your agent: "Join the shared bundle without publishing."'),
    followUps: [{ answer }],
  });
  assert.equal(checkAssistantEval(report([row("```sh\nsuperbee sync --pull-only\n```")])).results[0].ok, true);
  assert.match(
    checkAssistantEval(report([row("Run `superbee sync --pull-only`.")])).results[0].failures.join(),
    /no command block/u,
  );
});

test("an ambiguous case asks one short clarifying question first, then answers agent-first", () => {
  const base = {
    id: "get-started",
    category: "builder",
    checks: [
      { name: "completed", ok: true },
      { name: "expected_source_cited", ok: false },
    ],
  };
  const good = {
    ...base,
    answer: "Are you setting it up to use with your agent, or building on Superbee itself?",
    followUps: [
      {
        answer: 'Ask your agent: "Install Superbee and set it up for this host."[[source:a]]',
      },
    ],
  };
  assert.equal(checkAssistantEval(report([good])).results[0].ok, true);
  const answered = {
    ...good,
    answer: "Install the CLI first. The full steps are on Install and set up Superbee.",
  };
  assert.match(
    checkAssistantEval(report([answered])).results[0].failures.join(),
    /does not ask a clarifying question/u,
  );
});

test("review cases: clarifying wordings, a pasted agent prompt, empty and inline-command replies", () => {
  const clarify = (answer) => ({
    ...cited("bare-yes", 'Ask your agent: "Create a new local bundle for this project."[[source:s2]]'),
    followUps: [{ answer }],
  });
  for (const answer of ["What do you want to know next?", "Which part would you like to know about next?"])
    assert.equal(checkAssistantEval(report([clarify(answer)])).results[0].ok, true, answer);
  assert.match(checkAssistantEval(report([clarify("")])).results[0].failures.join(), /bare-yes#1: empty reply/u);
  assert.match(checkAssistantEval(report([clarify(words(60) + ".")])).results[0].failures.join(), /not short/u);
  const prompt =
    "Ask your agent in Claude Code:\n```text\nSet up Superbee for this host. Run `superbee setup`, explain the next proposed command.\n```";
  assert.equal(agentFirstFailure(prompt), undefined);
  assert.match(
    agentFirstFailure(`${prompt}\nOr run \`superbee setup --host claude-code --scope user\` yourself.`),
    /shell command/u,
  );
  // Offers that do not end with a question, and plain conditions that are not offers.
  for (const offer of ["If you'd like the full walkthrough, just ask.", "I can also walk you through the next steps."])
    assert.equal(checkAssistantEval(report([cited("x", offer)])).results[0].ok, false, offer);
  for (const plain of ["If you want more control, pass `--scope user`.", "Use it if you want the stable release."])
    assert.equal(checkAssistantEval(report([cited("x", plain)])).results[0].ok, true, plain);
  // A version named elsewhere does not excuse an unpinned install line; ~~~ and unclosed fences count.
  assert.match(installCommandFailure("The current release is superbee@0.4.2.\n`npm install -g superbee`"), /neither/u);
  const tilde = "~~~sh\nsuperbee version\n~~~\nThen:\n```sh\nsuperbee home";
  assert.match(checkAssistantEval(report([cited("x", tilde)])).results[0].failures.join(), /more than one code block/u);
  assert.ok(endsWithQuestion("**Ready?**"));
  // Mock reports skip the reply checks.
  assert.equal(checkAssistantEval(report([cited("x", "Want the steps?")], "mock")).results[0].ok, true);
});

test("second review: citations after a clarifying question, prose about npm, plain conditions, loose agent cues", () => {
  const base = {
    id: "get-started",
    category: "builder",
    checks: [
      { name: "completed", ok: true },
      { name: "expected_source_cited", ok: false },
    ],
  };
  const ask = "Are you setting it up to use with your agent, or building on Superbee itself?";
  const uncited = {
    ...base,
    answer: ask,
    followUps: [
      {
        answer: 'Ask your agent: "Install Superbee and set it up for this host."',
      },
    ],
  };
  assert.match(checkAssistantEval(report([uncited])).results[0].failures.join(), /cites no page/u);
  const broken = {
    ...base,
    answer: "Install it.[[source:x]]",
    checks: [...base.checks, { name: "citations_resolve", ok: false }],
  };
  assert.equal(checkAssistantEval(report([broken])).results[0].ok, false);
  // The clarifying reply does not count toward the median length.
  const median = checkAssistantEval(
    report([
      {
        ...uncited,
        followUps: [
          {
            answer: 'Ask your agent: "Install Superbee and set it up for this host."[[source:a]]',
          },
        ],
      },
      cited("long", words(120)),
    ]),
  );
  assert.equal(median.medianWords, 120);
  // Prose that mentions npm install -g is not an install line; a wrapped command is joined.
  assert.equal(
    installCommandFailure("Use `npm install -g` rather than `npx`, because hooks need an installed executable."),
    undefined,
  );
  assert.equal(installCommandFailure("```sh\nnpm install -g \\\n  superbee@0.4.2\n```"), undefined);
  assert.match(installCommandFailure('```sh\nnpm install -g \\\n  "superbee@${stable_version}"\n```'), /drops the/u);
  // A plain condition is not an offer; an offer with "I can" is.
  assert.equal(
    checkAssistantEval(report([cited("x", "If you'd like the bundle shared too, add `--share`.")])).results[0].ok,
    true,
  );
  assert.equal(checkAssistantEval(report([cited("x", "If you'd like, I can list the steps.")])).results[0].ok, false);
  // Agent cues: a passing mention of "your agent" is not an instruction; single-quoted prompts count.
  assert.match(
    agentFirstFailure('Superbee keeps what your agent learns. See "Install and set up Superbee".'),
    /what to ask/u,
  );
  assert.equal(agentFirstFailure("Ask your agent: 'Set up Superbee for this host and walk me through it.'"), undefined);
  assert.match(
    agentFirstFailure('Ask your agent: "Set it up for me please."\n```sh\nbrew install node\n```'),
    /shell command/u,
  );
});
