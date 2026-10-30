import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  aiStatus,
  loadChatStore,
  saveChatStore,
  type AgentMessage,
  type FileChange,
} from "../api";
import { runAgent } from "../agent/runAgent";
import {
  emptyStore,
  newSession,
  titleFromText,
  type ChatItem,
  type ChatSession,
  type ChatStore,
} from "../chatTypes";
import { Markdown } from "./Markdown";

type Props = {
  workspace: string | null;
  openPath: string | null;
  pendingChanges: FileChange[];
  onFilesChanged: (files: FileChange[]) => void;
  onKeepAll: () => void;
  onUndoAll: () => void;
  onReview: () => void;
};

let seq = 0;
const nid = () => `m-${++seq}`;

export function AgentPanel({
  workspace,
  openPath,
  pendingChanges,
  onFilesChanged,
  onKeepAll,
  onUndoAll,
  onReview,
}: Props) {
  const [store, setStore] = useState<ChatStore>(emptyStore());
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [model, setModel] = useState("Auto");
  const [ready, setReady] = useState(false);
  const [filesOpen, setFilesOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const saveTimer = useRef<number | null>(null);

  const active = store.chats.find((c) => c.id === store.activeId) ?? null;
  const items = active?.items ?? [];
  const history = active?.history ?? [];

  function updateActive(patch: Partial<ChatSession>) {
    setStore((prev) => {
      if (!prev.activeId) return prev;
      return {
        ...prev,
        chats: prev.chats.map((c) =>
          c.id === prev.activeId ? { ...c, ...patch, updatedAt: Date.now() } : c,
        ),
      };
    });
  }

  function setItems(updater: ChatItem[] | ((prev: ChatItem[]) => ChatItem[])) {
    setStore((prev) => {
      if (!prev.activeId) return prev;
      return {
        ...prev,
        chats: prev.chats.map((c) => {
          if (c.id !== prev.activeId) return c;
          const nextItems = typeof updater === "function" ? updater(c.items) : updater;
          return { ...c, items: nextItems, updatedAt: Date.now() };
        }),
      };
    });
  }

  function setHistory(updater: AgentMessage[] | ((prev: AgentMessage[]) => AgentMessage[])) {
    setStore((prev) => {
      if (!prev.activeId) return prev;
      return {
        ...prev,
        chats: prev.chats.map((c) => {
          if (c.id !== prev.activeId) return c;
          const next = typeof updater === "function" ? updater(c.history) : updater;
          return { ...c, history: next, updatedAt: Date.now() };
        }),
      };
    });
  }

  useEffect(() => {
    aiStatus()
      .then((s) => {
        setReady(s.ready);
        setModel(s.model.split("/").pop() || s.model);
      })
      .catch(() => setReady(false));
  }, []);

  // carrega chats do workspace
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    if (!workspace) {
      setStore(emptyStore());
      setLoaded(true);
      return;
    }
    loadChatStore(workspace)
      .then((raw) => {
        if (cancelled) return;
        try {
          const parsed = JSON.parse(raw) as ChatStore;
          if (!parsed.chats?.length) {
            const first = newSession();
            setStore({ activeId: first.id, chats: [first] });
          } else {
            setStore({
              activeId: parsed.activeId || parsed.chats[0].id,
              chats: parsed.chats,
            });
          }
        } catch {
          const first = newSession();
          setStore({ activeId: first.id, chats: [first] });
        }
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        const first = newSession();
        setStore({ activeId: first.id, chats: [first] });
        setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [workspace]);

  // persiste com debounce
  useEffect(() => {
    if (!workspace || !loaded) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      void saveChatStore(workspace, JSON.stringify(store)).catch(() => undefined);
    }, 400);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [store, workspace, loaded]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [items, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || !active) return;

    setBusy(true);
    setInput("");
    if (taRef.current) taRef.current.style.height = "auto";

    const userItem: ChatItem = { id: nid(), kind: "user", text: trimmed };
    setItems((prev) => [...prev, userItem]);
    if (active.title === "Novo chat") {
      updateActive({ title: titleFromText(trimmed) });
    }

    try {
      const result = await runAgent({
        workspace,
        openPath,
        history,
        userText: trimmed,
        onStep: (step) => {
          if (step.kind === "assistant") {
            setItems((prev) => [...prev, { id: nid(), kind: "assistant", text: step.text }]);
          } else if (step.kind === "tool") {
            setItems((prev) => [...prev, { id: nid(), kind: "tool", step }]);
          } else if (step.kind === "error") {
            setItems((prev) => [...prev, { id: nid(), kind: "error", text: step.text }]);
          }
        },
      });

      setModel(result.model.split("/").pop() || result.model);
      setHistory((prev) => [
        ...prev,
        { role: "user", content: trimmed },
        { role: "assistant", content: result.finalText },
      ]);

      const toolsDone = result.steps.filter((s) => s.kind === "tool").length;
      if (toolsDone > 0) {
        setItems((prev) => [
          ...prev,
          { id: nid(), kind: "todos", done: toolsDone, total: toolsDone },
        ]);
      }

      if (result.changes.length) {
        onFilesChanged(result.changes);
      }
    } catch (e) {
      setItems((prev) => [...prev, { id: nid(), kind: "error", text: String(e) }]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(input);
  }

  function copyText(text: string) {
    void navigator.clipboard.writeText(text);
  }

  function newChat() {
    if (busy) return;
    const chat = newSession();
    setStore((prev) => ({
      activeId: chat.id,
      chats: [chat, ...prev.chats],
    }));
    setInput("");
    setFilesOpen(false);
    setHistoryOpen(false);
    window.setTimeout(() => taRef.current?.focus(), 50);
  }

  function selectChat(id: string) {
    if (busy || id === store.activeId) return;
    setStore((prev) => ({ ...prev, activeId: id }));
    setHistoryOpen(false);
    setInput("");
  }

  function deleteChat(id: string) {
    if (busy) return;
    setStore((prev) => {
      const chats = prev.chats.filter((c) => c.id !== id);
      if (!chats.length) {
        const first = newSession();
        return { activeId: first.id, chats: [first] };
      }
      const activeId = prev.activeId === id ? chats[0].id : prev.activeId;
      return { activeId, chats };
    });
  }

  const fileCount = pendingChanges.length;

  return (
    <aside className="agent-panel cursor-chat">
      <div className="chat-top">
        <button
          type="button"
          className="chat-history-btn"
          title="Histórico de chats"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          ☰
        </button>
        <button
          type="button"
          className="chat-top-title-btn"
          title="Trocar chat"
          onClick={() => setHistoryOpen((v) => !v)}
        >
          <span className="chat-top-title">{active?.title || "Agent"}</span>
          <span className="chat-caret">▾</span>
        </button>
        <button
          type="button"
          className="chat-new"
          title="Novo chat (mantém os antigos)"
          disabled={busy}
          onClick={newChat}
        >
          +
        </button>
      </div>

      {historyOpen && (
        <div className="chat-history">
          <div className="chat-history-head">
            <span>Chats salvos</span>
            <button type="button" className="chip-mini" onClick={newChat} disabled={busy}>
              Novo
            </button>
          </div>
          <div className="chat-history-list">
            {store.chats.map((c) => (
              <div
                key={c.id}
                className={`chat-history-row${c.id === store.activeId ? " active" : ""}`}
              >
                <button
                  type="button"
                  className="chat-history-main"
                  onClick={() => selectChat(c.id)}
                  disabled={busy}
                >
                  <span className="chat-history-title">{c.title}</span>
                  <span className="chat-history-date">
                    {new Date(c.updatedAt).toLocaleString("pt-BR", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
                <button
                  type="button"
                  className="chat-history-del"
                  title="Excluir chat"
                  disabled={busy}
                  onClick={() => {
                    if (confirm(`Excluir “${c.title}”?`)) deleteChat(c.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="chat-scroll">
        {items.length === 0 && (
          <div className="chat-empty">
            <p>{active?.title || "Novo chat"}</p>
            <span>Os chats ficam salvos neste workspace (.ia-ptx).</span>
          </div>
        )}

        {items.map((item) => {
          if (item.kind === "user") {
            return (
              <div key={item.id} className="c-user">
                <div className="c-user-bubble">
                  <div className="c-user-text">{item.text}</div>
                  <button
                    type="button"
                    className="c-icon-btn"
                    title="Reusar"
                    onClick={() => setInput(item.text)}
                  >
                    ↺
                  </button>
                </div>
              </div>
            );
          }

          if (item.kind === "todos") {
            return (
              <div key={item.id} className="c-todos">
                <span className="c-check">✓</span>
                {item.done} of {item.total} To-dos Completed
              </div>
            );
          }

          if (item.kind === "assistant") {
            return (
              <div key={item.id} className="c-assistant">
                <Markdown source={item.text} />
                <div className="c-assistant-foot">
                  <button
                    type="button"
                    className="c-icon-btn"
                    title="Copiar"
                    onClick={() => copyText(item.text)}
                  >
                    ⎘
                  </button>
                  <button
                    type="button"
                    className="c-icon-btn"
                    title="Regenerar"
                    disabled={busy}
                    onClick={() => {
                      const lastUser = [...items].reverse().find((x) => x.kind === "user");
                      if (lastUser && lastUser.kind === "user") void send(lastUser.text);
                    }}
                  >
                    ↻
                  </button>
                </div>
              </div>
            );
          }

          if (item.kind === "tool") {
            return (
              <details key={item.id} className={`c-tool${item.step.ok ? "" : " bad"}`}>
                <summary>
                  <span className="c-tool-label">
                    {item.step.ok ? "Ran" : "Failed"} <code>{item.step.name}</code>
                  </span>
                  <span className="c-tool-chevron">▾</span>
                </summary>
                <pre>{item.step.args}</pre>
                <pre className="c-tool-out">{item.step.result}</pre>
              </details>
            );
          }

          return (
            <div key={item.id} className="c-error">
              {item.text}
            </div>
          );
        })}

        {busy && (
          <div className="c-thinking">
            <span className="c-pulse" />
            Working…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {fileCount > 0 && (
        <div className="review-bar">
          <div className="review-left">
            <button type="button" className="review-toggle" onClick={() => setFilesOpen((v) => !v)}>
              {filesOpen ? "▾" : "▸"} {fileCount} arquivo{fileCount === 1 ? "" : "s"} no disco
            </button>
          </div>
          <div className="review-right">
            <button type="button" className="rb-btn" onClick={onUndoAll} title="Reverter arquivos">
              Desfazer
            </button>
            <button
              type="button"
              className="rb-btn primary"
              onClick={onKeepAll}
              title="Confirmar e limpar da lista (já estão salvos)"
            >
              Salvar
            </button>
            <button type="button" className="rb-btn" onClick={onReview}>
              Revisar
            </button>
          </div>
        </div>
      )}

      {filesOpen && fileCount > 0 && (
        <div className="review-files">
          {pendingChanges.map((f) => (
            <button
              key={f.absolutePath}
              type="button"
              className="review-file"
              onClick={() => onReview()}
              title={f.absolutePath}
            >
              {f.path}
            </button>
          ))}
        </div>
      )}

      <form className="composer" onSubmit={onSubmit}>
        <textarea
          ref={taRef}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            const el = e.target;
            el.style.height = "auto";
            el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
          }}
          placeholder="Plan, Build, / for skills, @ for context"
          rows={2}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(input);
            }
          }}
        />
        <div className="composer-bar">
          <div className="composer-left">
            <button type="button" className="mode-btn" title="Agent mode">
              <span className="inf">∞</span> Agent
            </button>
            <button type="button" className="mode-btn ghost" title={ready ? model : "sem API key"}>
              {ready ? "Auto" : "Offline"} ▾
            </button>
          </div>
          <div className="composer-right">
            <button
              type="submit"
              className="send-round"
              disabled={busy || !input.trim() || !workspace}
              title="Enviar"
            >
              ↑
            </button>
          </div>
        </div>
      </form>
    </aside>
  );
}
