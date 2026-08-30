const releaseVersionPattern = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;

export function stableReleaseVersionLabel(version) {
  if (typeof version !== "string" || !releaseVersionPattern.test(version)) {
    throw new Error(`releases/current has invalid version field: ${version ?? ""}`);
  }
  return `v${version}`;
}

export function assertStableReleaseVersionLabel(documentation, version) {
  const expected = stableReleaseVersionLabel(version);
  if (documentation?.versionLabel !== expected) {
    throw new Error(`Portal versionLabel must equal ${expected} from releases/current`);
  }
  return expected;
}

export function assertSnapshotReleaseVersionLabel(documentation, snapshot) {
  const current = snapshot.manifest.documents.find((document) => document.id === "releases/current");
  if (!current) throw new Error("publication snapshot must contain releases/current");
  return assertStableReleaseVersionLabel(documentation, current.frontmatter.version);
}
