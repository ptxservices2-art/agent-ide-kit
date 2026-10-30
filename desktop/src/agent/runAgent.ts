import {
  agentTurn,
  listDir,
  readFile,
  searchFiles,
  strReplace,
  writeFile,
  workspaceContext,
  type AgentMessage,
  type FileChange,
  type ToolCall,
} from "../api";

export type AgentStep =
  | { kind: "assistant"; text: string }
  | { kind: "tool"; name: string; args: string; result: string; ok: boolean }
  | { kind: "error"; text: string };

export type AgentRunResult = {
  steps: AgentStep[];
  finalText: string;
  changes: FileChange[];
  model: string;
};

const BINARY_RE =
  /\.(dat|apk|so|dll|exe|bin|pyc|o|a|png|jpe?g|webp|gif|ico|zip|rar|7z)$/i;

function basename(path: string) {
  return path.replace(/\\/g, "/").split("/").pop() ?? path;
}

function clip(s: string, max: number) {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n…(cortado ${s.length - max} chars)`;
}

function parseToolArgs(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw || "{}") as Record<string, unknown>;
  } catch {
    let fixed = raw.trim();
    if (!fixed.endsWith("}")) fixed += '"}';
    try {
      return JSON.parse(fixed) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

async function buildContext(workspace: string | null, openPath: string | null) {
  if (!workspace) return "Nenhuma pasta aberta.";
  let block = "";
  try {
    const ctx = await workspaceContext(workspace);
    block += `Workspace: ${ctx.name}\nPath: ${ctx.path}\n\nTree:\n${clip(ctx.tree, 6000)}\n`;
    if (ctx.overview.trim()) block += `\nKey:\n${clip(ctx.overview, 4000)}`;
  } catch (e) {
    block += `Workspace: ${workspace}\n(erro contexto: ${e})\n`;
  }
  if (openPath) {
    block += `\nArquivo focado: ${openPath}`;
  }
  return clip(block, 12_000);
}

async function snapshotChange(
  workspace: string,
  absolutePath: string,
  previousContent: string | null,
): Promise<FileChange> {
  let newContent = "";
  try {
    newContent = await readFile(workspace, absolutePath);
  } catch {
    newContent = "";
  }
  return {
    path: basename(absolutePath),
    absolutePath,
    previousContent,
    newContent,
  };
}

async function execTool(
  workspace: string,
  call: ToolCall,
): Promise<{ result: string; change?: FileChange }> {
  const args = parseToolArgs(call.function.arguments);
  if (!args) {
    return {
      result:
        "ERRO: argumentos da tool inválidos/truncados. Continue com str_replace em pedaços.",
    };
  }

  const name = call.function.name;
  try {
    if (name === "list_dir") {
      const path = typeof args.path === "string" ? args.path : "";
      const rows = await listDir(workspace, path || undefined);
      const max = 120;
      const slice = rows.slice(0, max);
      const lines = slice.map((r) => `${r.isDir ? "dir" : "file"}\t${r.name}`);
      if (rows.length > max) lines.push(`… +${rows.length - max} itens omitidos`);
      return { result: lines.join("\n") || "(vazio)" };
    }
    if (name === "read_file") {
      const path = String(args.path ?? "");
      if (BINARY_RE.test(path)) {
        return { result: `ERRO: binário bloqueado (${path}).` };
      }
      const content = await readFile(workspace, path);
      return { result: clip(content, 40_000) };
    }
    if (name === "write_file") {
      const path = String(args.path ?? "");
      const content = String(args.content ?? "");
      if (BINARY_RE.test(path)) {
        return { result: `ERRO: não grave binários via agent (${path})` };
      }
      let previousContent: string | null = null;
      try {
        const prev = await readFile(workspace, path);
        previousContent = prev.length > 500_000 ? null : prev;
      } catch {
        previousContent = null;
      }
      const absolutePath = await writeFile(workspace, path, content);
      return {
        result: `OK wrote ${basename(absolutePath)} (${content.length} chars)`,
        change: {
          path: basename(absolutePath),
          absolutePath,
          previousContent,
          newContent: content,
        },
      };
    }
    if (name === "str_replace") {
      const path = String(args.path ?? "");
      const oldString = String(args.old_string ?? args.oldString ?? "");
      const newString = String(args.new_string ?? args.newString ?? "");
      if (!oldString) return { result: "ERRO: old_string vazio" };
      let previousContent: string | null = null;
      try {
        previousContent = await readFile(workspace, path);
      } catch {
        previousContent = null;
      }
      const absolutePath = await strReplace(workspace, path, oldString, newString);
      const change = await snapshotChange(workspace, absolutePath, previousContent);
      return {
        result: `OK str_replace ${basename(absolutePath)}`,
        change,
      };
    }
    if (name === "search_files") {
      const query = String(args.query ?? "");
      const path = typeof args.path === "string" ? args.path : undefined;
      const hits = await searchFiles(workspace, query, path);
      const lines = hits
        .filter((h) => !BINARY_RE.test(h.path))
        .slice(0, 40)
        .map((h) => `${h.path}:${h.line}: ${h.text}`);
      return { result: lines.join("\n") || "(nenhum resultado)" };
    }
    return { result: `tool desconhecida: ${name}` };
  } catch (e) {
    return { result: `ERRO: ${e}` };
  }
}

export async function runAgent(opts: {
  workspace: string | null;
  openPath: string | null;
  history: AgentMessage[];
  userText: string;
  onStep?: (step: AgentStep) => void;
  maxTurns?: number;
}): Promise<AgentRunResult> {
  const { workspace, openPath, userText, onStep } = opts;
  const maxTurns = opts.maxTurns ?? 16;
  const steps: AgentStep[] = [];
  const changes: FileChange[] = [];
  let model = "";

  if (!workspace) {
    const step: AgentStep = { kind: "error", text: "Abra uma pasta antes de usar o Agent." };
    onStep?.(step);
    return { steps: [step], finalText: step.text, changes, model };
  }

  const ideContext = await buildContext(workspace, openPath);
  const slimHistory = opts.history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-12)
    .map((m) => ({
      ...m,
      content: clip(m.content || "", 8000),
      toolCalls: null,
    }));

  const messages: AgentMessage[] = [
    ...slimHistory,
    { role: "user", content: clip(userText, 8000) },
  ];

  let finalText = "";

  for (let turn = 0; turn < maxTurns; turn++) {
    let res;
    try {
      res = await agentTurn(messages, ideContext);
    } catch (e) {
      const msg = String(e);
      const tooBig =
        msg.includes("Request too large") ||
        msg.includes("413") ||
        msg.includes("rate_limit") ||
        msg.includes("TPM") ||
        msg.includes("tokens");
      const toolBroke =
        msg.includes("tool_use_failed") ||
        msg.includes("JSON inválido") ||
        msg.includes("tool call") ||
        msg.includes("pedaços");
      const step: AgentStep = {
        kind: "error",
        text: tooBig
          ? "Ainda estourou o limite de tokens da Groq nesta conta/tier. Reduza o escopo ou confira o billing."
          : toolBroke
            ? "JSON da tool quebrou. Peça para continuar com str_replace."
            : msg,
      };
      onStep?.(step);
      steps.push(step);
      return { steps, finalText: step.text, changes, model };
    }
    model = res.model;

    if (res.content) {
      const step: AgentStep = { kind: "assistant", text: res.content };
      steps.push(step);
      onStep?.(step);
      finalText = res.content;
    }

    if (!res.toolCalls.length) {
      break;
    }

    messages.push({
      role: "assistant",
      content: res.content ? clip(res.content, 8000) : null,
      toolCalls: res.toolCalls,
    });

    for (const call of res.toolCalls) {
      const { result, change } = await execTool(workspace, call);
      const clipped = clip(result, 20_000);
      const ok = !result.startsWith("ERRO:");
      const step: AgentStep = {
        kind: "tool",
        name: call.function.name,
        args: clip(call.function.arguments, 1200),
        result: clip(result, 4000),
        ok,
      };
      steps.push(step);
      onStep?.(step);
      if (change) changes.push(change);

      messages.push({
        role: "tool",
        toolCallId: call.id,
        name: call.function.name,
        content: clipped,
      });
    }

    if (res.recovered) {
      messages.push({
        role: "user",
        content:
          "Se o arquivo ficou incompleto, continue com str_replace até finalizar.",
      });
    }
  }

  if (!finalText) {
    finalText = changes.length
      ? `Pronto. Alterei ${changes.length} arquivo(s).`
      : "Concluído.";
  }

  return { steps, finalText, changes, model };
}
