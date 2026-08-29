import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const command = process.argv[2];
if (!new Set(["sync", "build"]).has(command)) {
  throw new Error("usage: node scripts/mkdocs-runtime.mjs <sync|build>");
}

const root = path.resolve(".tmp/mkdocs");
const runtime = path.join(root, "input/runtime");
const environment = path.resolve(".tmp/mkdocs-venv");
const env = {
  ...process.env,
  PYTHONDONTWRITEBYTECODE: "1",
  UV_PROJECT_ENVIRONMENT: environment,
};

if (command === "sync") {
  await run("uv", ["sync", "--frozen", "--no-dev", "--project", runtime], { env, maxBuffer: 16 * 1024 * 1024 });
  console.log(JSON.stringify({ ok: true, command: "mkdocs sync", runtime, environment }));
} else {
  await run("uv", ["sync", "--offline", "--frozen", "--no-dev", "--project", runtime], { env, maxBuffer: 16 * 1024 * 1024 });
  await run("uv", ["run", "--offline", "--frozen", "--no-sync", "--project", runtime,
    "mkdocs", "build", "--clean", "--strict", "--config-file", path.join(root, "input/mkdocs.yml")], {
    cwd: root,
    env,
    maxBuffer: 16 * 1024 * 1024,
  });
  console.log(JSON.stringify({ ok: true, command: "mkdocs build", input: path.join(root, "input"), site: path.join(root, "site") }));
}
