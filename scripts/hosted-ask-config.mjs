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
export const HOSTED_ASK_CONFIG_ROUTE = `${HOSTED_ASK_PREFIX}v1/config`;
export const HOSTED_ASK_EFFECTIVE_OBSERVATION = Object.freeze({
  route: HOSTED_ASK_CONFIG_ROUTE,
  protocol: "effective-configuration-v1",
  declaration: Object.freeze({ binding: HOSTED_ASK_BINDING, ...HOSTED_ASK_SERVICE }),
  omittedServiceEnvironment: "production",
});

/** Only the server-owned declaration reaches RPC; public requests never supply expectations. */
export async function observeHostedAskBinding(hosted) {
  try {
    const value = await hosted.compareRoutingPropsV1(HOSTED_ASK_SERVICE.props);
    if (!value || typeof value !== "object" || Array.isArray(value)
      || Object.keys(value).length !== 2 || !Object.hasOwn(value, "contract") || !Object.hasOwn(value, "result")
      || value.contract !== "public-site-routing-v1") return "unknown";
    return value.result === "equal" || value.result === "different" ? value.result : "unknown";
  } catch { return "unknown"; }
}
