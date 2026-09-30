import path from "node:path";
import { verifySnapshotIntegrity } from "./vendor/package-verification/src/snapshot.mjs";

try { console.log(JSON.stringify(await verifySnapshotIntegrity(path.resolve("scripts/vendor/package-verification")))); }
catch { console.error(JSON.stringify({status:"blocked",reason:"Shared package verification snapshot integrity failed; restore the reviewed generated snapshot. Source provenance requires comparison with the exact canonical producer checkout."})); process.exitCode=1; }
