// PostToolUse: runs the TypeScript checker after a .ts/.tsx edit and feeds errors back to Claude.
import { spawnSync } from "node:child_process";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

const input = JSON.parse(raw || "{}");
const filePath = input.tool_input?.file_path ?? input.tool_response?.filePath ?? "";
if (!/\.tsx?$/.test(filePath)) process.exit(0);

const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const result = spawnSync("npx", ["tsc", "--noEmit", "--pretty", "false"], {
  cwd: projectDir,
  encoding: "utf8",
  shell: process.platform === "win32",
});

if (result.status !== 0) {
  const output = `${result.stdout}${result.stderr}`.trim().split("\n");
  const shown = output.slice(0, 30).join("\n");
  const more = output.length > 30 ? `\n... e mais ${output.length - 30} linhas` : "";
  console.error(`TypeScript encontrou erros depois da edição:\n${shown}${more}`);
  process.exit(2);
}
