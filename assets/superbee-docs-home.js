// Site-owned presentation only. The publication bundle remains the content authority.
const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("superbee-docs-home.css", import.meta.url).href;
document.head.append(stylesheet);
