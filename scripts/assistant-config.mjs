/* Ask Superbee: Sonnet 5.5 at low effort on a $150 monthly budget. The Worker and the eval read this block. */
export const ASSISTANT = Object.freeze({
  bundleId: "superbee-docs",
  instructions: "assistant/instructions.md",
  model: "claude-sonnet-5-5",
  // 25 questions per conversation; 50 a day per visitor, so the two never collide. The $1 per-visitor
  // daily spend, $15/day and $150/month caps stay as derived.
  budget: { monthlyUsd: 150, conversationTurns: 25, visitorDailyTurns: 50 },
  public: true,
  name: "Superbee",
});
