import { invoke } from "@tauri-apps/api/core";

export type DirEntry = {
  name: string;
  path: string;
  isDir: boolean;
};

export type WorkspaceContext = {
  path: string;
  name: string;
  tree: string;
  overview: string;
};

export type ToolCall = {
  id: string;
  type?: string;
  function: { name: string; arguments: string };
};

export type AgentMessage = {
  role: "user" | "assistant" | "system" | "tool";
  content?: string | null;
  toolCallId?: string | null;
  toolCalls?: ToolCall[] | null;
  name?: string | null;
};

export type FileChange = {
  path: string;
  absolutePath: string;
  previousContent: string | null;
  newContent: string;
};

export async function listDir(workspace: string, path?: string) {
  return invoke<DirEntry[]>("list_dir", { workspace, path: path ?? null });
}

export async function readFile(workspace: string, path: string) {
  return invoke<string>("read_file", { workspace, path });
}

export async function writeFile(workspace: string, path: string, content: string) {
  return invoke<string>("write_file", { workspace, path, content });
}

export async function strReplace(
  workspace: string,
  path: string,
  oldString: string,
  newString: string,
) {
  return invoke<string>("str_replace", {
    workspace,
    path,
    oldString,
    newString,
  });
}

export async function searchFiles(workspace: string, query: string, path?: string) {
  return invoke<{ path: string; line: number; text: string }[]>("search_files", {
    workspace,
    query,
    path: path ?? null,
  });
}

export async function workspaceContext(workspace: string) {
  return invoke<WorkspaceContext>("workspace_context", { workspace });
}

export async function gitStatus(workspace: string) {
  return invoke<{ path: string; status: string }[]>("git_status", { workspace });
}

export async function agentTurn(messages: AgentMessage[], ideContext?: string) {
  return invoke<{
    content: string | null;
    toolCalls: ToolCall[];
    model: string;
    recovered: boolean;
  }>("agent_turn", {
    req: {
      messages,
      ideContext: ideContext ?? null,
    },
  });
}

export async function aiStatus() {
  return invoke<{ ready: boolean; model: string }>("ai_status");
}

export async function loadChatStore(workspace: string) {
  return invoke<string>("load_chat_store", { workspace });
}

export async function saveChatStore(workspace: string, json: string) {
  return invoke<void>("save_chat_store", { workspace, json });
}
