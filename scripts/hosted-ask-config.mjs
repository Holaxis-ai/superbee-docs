/*
 * Ask Superbee runs in hosted (board design one-ask-public-mode): this Worker forwards the
 * assistant's routes, unchanged, to the hosted app Worker's PublicSiteAsk entrypoint through the
 * service binding named here. Hosted holds the model key, this site's budget and its conversations.
 * test/agent-access.test.mjs checks wrangler.jsonc against these names.
 */
export const HOSTED_ASK_BINDING = "SUPERBEE_ASK";
export const HOSTED_ASK_PREFIX = "/__superbee/assistant/";
export const HOSTED_ASK_SERVICE = Object.freeze({
  service: "superbee-product-app",
  entrypoint: "PublicSiteAsk",
  props: Object.freeze({ workspace: "holaxis-sites", site: "superbee-docs" }),
});
