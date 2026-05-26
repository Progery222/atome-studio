import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { apiFetch } from "../../lib/api";
import styles from "./ChatPanel.module.css";

interface Msg {
  id: string;
  role: "user" | "assistant" | "tool" | "system";
  content: string;
  toolName?: string;
  toolOk?: boolean;
  actionId?: string;
  questionId?: string;
  options?: Array<{ label: string; value: string }>;
  resolved?: boolean;
}

function genId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function formatResult(v: unknown): string {
  if (v == null) return "ok";
  const s = typeof v === "string" ? v : JSON.stringify(v, null, 2);
  return s.length > 800 ? `${s.slice(0, 800)}…` : s;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(s: string): string {
  let out = escapeHtml(s);
  out = out.replace(/`([^`]+)`/g, '<code style="background:#0003;padding:1px 4px;border-radius:3px;font-family:ui-monospace,monospace;font-size:12px">$1</code>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1<em>$2</em>");
  return out;
}

function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const html: string[] = [];
  let listType: "ul" | "ol" | null = null;
  const closeList = () => {
    if (listType) {
      html.push(`</${listType}>`);
      listType = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const ul = /^\s*[-*]\s+(.+)$/.exec(line);
    const ol = /^\s*(\d+)\.\s+(.+)$/.exec(line);
    if (ul) {
      if (listType !== "ul") {
        closeList();
        html.push('<ul style="margin:4px 0;padding-left:20px">');
        listType = "ul";
      }
      html.push(`<li>${renderInline(ul[1])}</li>`);
    } else if (ol) {
      if (listType !== "ol") {
        closeList();
        html.push('<ol style="margin:4px 0;padding-left:22px">');
        listType = "ol";
      }
      html.push(`<li>${renderInline(ol[2])}</li>`);
    } else if (line === "") {
      closeList();
      html.push("<br>");
    } else {
      closeList();
      html.push(`<div>${renderInline(line)}</div>`);
    }
  }
  closeList();
  return html.join("");
}

function MsgBody({ content }: { content: string }) {
  return (
    <div
      className={styles.body}
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
    />
  );
}

export function ChatPanel() {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [wsReady, setWsReady] = useState(false);
  const sessionId = useRef<string>(localStorage.getItem("chat_session") || genId());
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    localStorage.setItem("chat_session", sessionId.current);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  // ── WebSocket connect ─────────────────────────────────────────────────
  useEffect(() => {
    const socket = io("/ws/chat", {
      query: { session_id: sessionId.current },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10000,
    });
    socketRef.current = socket;

    socket.on("connect", () => setWsReady(true));
    socket.on("disconnect", () => setWsReady(false));
    socket.on("connect_error", () => setWsReady(false));

    socket.on("chat_event", (ev: Record<string, unknown>) => {
      const t = ev.type as string;
      switch (t) {
        case "connected":
          return;
        case "message": {
          const text = (ev.text as string) ?? "";
          setMsgs((p) => [...p, { id: genId(), role: "assistant", content: text }]);
          setSending(false);
          return;
        }
        case "token": {
          const piece = (ev.v as string) ?? (ev.text as string) ?? "";
          setMsgs((p) => {
            const last = p[p.length - 1];
            if (last && last.role === "assistant" && !last.resolved) {
              return [...p.slice(0, -1), { ...last, content: last.content + piece }];
            }
            return [...p, { id: genId(), role: "assistant", content: piece }];
          });
          return;
        }
        case "done": {
          setSending(false);
          setMsgs((p) => p.map((m, i) => i === p.length - 1 && m.role === "assistant" ? { ...m, resolved: true } : m));
          return;
        }
        case "tool_call": {
          const name = ev.tool as string;
          const args = ev.args;
          setMsgs((p) => [
            ...p,
            {
              id: genId(),
              role: "tool",
              toolName: name,
              toolOk: undefined,
              content: `args: ${JSON.stringify(args)}`,
              actionId: ev.action_id as string,
            },
          ]);
          return;
        }
        case "tool_result": {
          const actionId = ev.action_id as string;
          const result = ev.result as Record<string, unknown> | undefined;
          const ok = !(result && (result.error || result.pending_confirm));
          const summary = result?.human_summary
            ? String(result.human_summary)
            : formatResult(result);
          setMsgs((p) =>
            p.map((m) =>
              m.actionId === actionId && m.role === "tool" && m.toolOk === undefined
                ? { ...m, toolOk: ok, content: summary }
                : m
            )
          );
          return;
        }
        case "question": {
          setMsgs((p) => [
            ...p,
            {
              id: genId(),
              role: "system",
              content: (ev.text as string) ?? "Уточнение:",
              questionId: ev.question_id as string,
              options: ev.options as Array<{ label: string; value: string }>,
            },
          ]);
          return;
        }
        case "pending_action": {
          setMsgs((p) => [
            ...p,
            {
              id: genId(),
              role: "system",
              content: `⚠ Подтвердить: ${ev.summary ?? ev.tool}`,
              actionId: ev.action_id as string,
            },
          ]);
          return;
        }
        case "interrupted":
          setSending(false);
          setMsgs((p) => [...p, { id: genId(), role: "system", content: "⏹ прервано" }]);
          return;
        case "generate_video_done": {
          setMsgs((p) => [
            ...p,
            {
              id: genId(),
              role: "system",
              content: `🎬 Видео готово: ${ev.minio_key ?? ev.job_id} (job ${ev.job_id})`,
            },
          ]);
          return;
        }
        case "generate_video_failed":
        case "generate_video_timeout": {
          setMsgs((p) => [
            ...p,
            {
              id: genId(),
              role: "system",
              content: `⚠ Генерация: ${ev.error ?? ev.type} (job ${ev.job_id})`,
            },
          ]);
          return;
        }
        case "post_sent":
          setMsgs((p) => [
            ...p,
            { id: genId(), role: "system", content: `✅ Опубликовано (task ${ev.task_id})` },
          ]);
          return;
        case "post_failed":
          setMsgs((p) => [
            ...p,
            {
              id: genId(),
              role: "system",
              content: `❌ Публикация упала: ${ev.error ?? ""} (task ${ev.task_id})`,
            },
          ]);
          return;
        case "error":
          setMsgs((p) => [
            ...p,
            {
              id: genId(),
              role: "system",
              content: `⚠ ${ev.code ?? "error"}: ${ev.msg ?? ""}`,
            },
          ]);
          setSending(false);
          return;
        default:
          return;
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ── Send ──────────────────────────────────────────────────────────────
  async function send() {
    const text = input.trim();
    if (!text || sending) return;
    setMsgs((p) => [...p, { id: genId(), role: "user", content: text }]);
    setInput("");
    setSending(true);

    const socket = socketRef.current;
    if (wsReady && socket) {
      socket.emit("message", { text });
      return;
    }
    // REST fallback
    try {
      const res = await apiFetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: sessionId.current, text }),
      });
      const data = (await res.json()) as {
        reply?: string;
        toolCalls?: Array<{
          name: string;
          args: unknown;
          result?: unknown;
          error?: string;
        }>;
      };
      for (const t of data.toolCalls ?? []) {
        const ok = !t.error;
        setMsgs((p) => [
          ...p,
          {
            id: genId(),
            role: "tool",
            toolName: t.name,
            toolOk: ok,
            content: ok ? formatResult(t.result) : (t.error ?? ""),
          },
        ]);
      }
      setMsgs((p) => [
        ...p,
        { id: genId(), role: "assistant", content: data.reply ?? "(нет ответа)" },
      ]);
    } catch (e) {
      setMsgs((p) => [
        ...p,
        { id: genId(), role: "system", content: `⚠ ${(e as Error).message}` },
      ]);
    } finally {
      setSending(false);
    }
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function answer(questionId: string, value: string) {
    const socket = socketRef.current;
    if (!socket || !wsReady) return;
    socket.emit("answer", { question_id: questionId, value });
    setMsgs((p) =>
      p.map((m) =>
        m.questionId === questionId
          ? { ...m, resolved: true, content: `${m.content}\n\n→ ${value}` }
          : m
      )
    );
  }

  function confirmAction(actionId: string) {
    const socket = socketRef.current;
    if (!socket || !wsReady) return;
    socket.emit("confirm", { action_id: actionId });
    setMsgs((p) =>
      p.map((m) =>
        m.actionId === actionId && m.role === "system"
          ? { ...m, resolved: true, content: `${m.content}\n\n→ подтверждено` }
          : m
      )
    );
  }

  function cancelAction(actionId: string) {
    const socket = socketRef.current;
    if (!socket || !wsReady) return;
    socket.emit("cancel", { action_id: actionId });
    setMsgs((p) =>
      p.map((m) =>
        m.actionId === actionId && m.role === "system"
          ? { ...m, resolved: true, content: `${m.content}\n\n→ отменено` }
          : m
      )
    );
  }

  function newChat() {
    if (sending) return;
    const newId = genId();
    sessionId.current = newId;
    localStorage.setItem("chat_session", newId);
    setMsgs([]);
    const socket = socketRef.current;
    if (socket) socket.disconnect();
    // re-open with new session_id — reload effect not available, so full page effect will pick up
    setTimeout(() => window.location.reload(), 50);
  }

  return (
    <div className={styles.panel}>
      <div className={styles.log}>
        {msgs.length === 0 && (
          <div className={styles.welcome}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 8,
              }}
            >
              <span>
                Управление фермой через чат {wsReady ? "(WS)" : "(REST)"}. Примеры:
              </span>
              <button
                type="button"
                onClick={newChat}
                className={styles.sendBtn}
                style={{ padding: "2px 10px", fontSize: 12 }}
              >
                Новый чат
              </button>
            </div>
            <ul>
              <li>сгенерируй видео про футбол</li>
              <li>опубликуй последнее из sportzavod на @acc1 через час</li>
              <li>warmup всех телефонов 2 часа</li>
              <li>статус по аккаунту @nfl_tactics_01</li>
            </ul>
          </div>
        )}
        {msgs.map((m) => (
          <div
            key={m.id}
            className={`${styles.msg} ${
              m.role === "user"
                ? styles.user
                : m.role === "tool"
                  ? styles.tool
                  : m.role === "system"
                    ? styles.tool
                    : styles.assistant
            }`}
          >
            {m.role === "tool" && (
              <div className={styles.toolHead}>
                {m.toolOk === undefined ? "⋯" : m.toolOk ? "✓" : "✗"} 🛠 {m.toolName}
              </div>
            )}
            {m.role === "tool" ? (
              <pre className={styles.body}>{m.content}</pre>
            ) : (
              <MsgBody content={m.content} />
            )}
            {m.options && m.questionId && !m.resolved && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {m.options.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    className={styles.sendBtn}
                    style={{ padding: "4px 10px", fontSize: 12 }}
                    onClick={() => answer(m.questionId as string, o.value)}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            )}
            {m.actionId && m.role === "system" && m.content.startsWith("⚠ Подтвердить") && !m.resolved && (
              <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                <button
                  type="button"
                  className={styles.sendBtn}
                  style={{ padding: "4px 10px", fontSize: 12 }}
                  onClick={() => confirmAction(m.actionId as string)}
                >
                  Подтвердить
                </button>
                <button
                  type="button"
                  className={styles.sendBtn}
                  style={{ padding: "4px 10px", fontSize: 12, background: "#555" }}
                  onClick={() => cancelAction(m.actionId as string)}
                >
                  Отмена
                </button>
              </div>
            )}
          </div>
        ))}
        {sending && (
          <div className={`${styles.msg} ${styles.assistant}`}>
            <pre className={styles.body}>⋯ думаю</pre>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className={styles.inputBox}>
        <textarea
          className={styles.input}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          placeholder="Сообщение (Enter — отправить, Shift+Enter — перенос)"
          disabled={sending}
        />
        <button
          type="button"
          className={styles.sendBtn}
          onClick={send}
          disabled={sending || !input.trim()}
        >
          ➤
        </button>
      </div>
    </div>
  );
}
