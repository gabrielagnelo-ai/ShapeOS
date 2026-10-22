// PreToolUse: blocks edits to .env files (secrets). .env.example stays editable.
import path from "node:path";

let raw = "";
for await (const chunk of process.stdin) raw += chunk;

const input = JSON.parse(raw || "{}");
const filePath = input.tool_input?.file_path ?? input.tool_input?.notebook_path ?? "";
const name = path.basename(filePath);

if (/^\.env(\..+)?$/.test(name) && name !== ".env.example") {
  console.log(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: `${name} guarda senhas e chaves do projeto. Edite esse arquivo manualmente (ou atualize .env.example).`,
      },
    }),
  );
}
