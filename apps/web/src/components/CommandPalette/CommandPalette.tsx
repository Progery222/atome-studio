import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "../../stores/auth";
import { useThemeStore } from "../../stores/theme";
import styles from "./CommandPalette.module.css";

interface Cmd {
  id: string;
  title: string;
  keywords?: string;
  shortcut?: string;
  run: () => void;
}

export function CommandPalette() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const theme = useThemeStore((s) => s.theme);
  const toggleTheme = useThemeStore((s) => s.toggle);
  const logout = useAuthStore((s) => s.logout);

  const commands: Cmd[] = useMemo(
    () => [
      { id: "go.home", title: "Go to Galaxy", shortcut: "g h", run: () => navigate("/") },
      { id: "go.phones", title: "Go to Phones", shortcut: "g p", run: () => navigate("/phones") },
      { id: "go.grid", title: "Go to Phone Grid", shortcut: "g g", run: () => navigate("/phone-grid") },
      { id: "go.videos", title: "Go to Videos", shortcut: "g v", run: () => navigate("/videos") },
      { id: "go.analytics", title: "Go to Analytics", shortcut: "g a", run: () => navigate("/analytics") },
      { id: "go.generate", title: "Go to Generate", shortcut: "g n", run: () => navigate("/generate") },
      { id: "go.queue", title: "Go to Queue", shortcut: "g q", run: () => navigate("/queue") },
      { id: "go.settings", title: "Go to Settings", shortcut: "g s", run: () => navigate("/settings") },
      { id: "go.clients", title: "Go to Clients", shortcut: "g c", run: () => navigate("/clients") },
      { id: "go.audit", title: "Go to Audit", run: () => navigate("/audit") },
      {
        id: "theme.toggle",
        title: `Toggle theme (now: ${theme})`,
        run: () => toggleTheme(),
      },
      { id: "auth.logout", title: "Log out", run: () => logout().then(() => navigate("/login")) },
    ],
    [navigate, theme, toggleTheme, logout]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) =>
      (c.title + " " + (c.keywords ?? "")).toLowerCase().includes(q)
    );
  }, [query, commands]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        close();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10);
  }, [open]);

  if (!open) return null;

  function run(cmd: Cmd) {
    close();
    cmd.run();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter" && filtered[cursor]) {
      e.preventDefault();
      run(filtered[cursor]);
    }
  }

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className={styles.panel} role="dialog" aria-label="Command palette">
        <input
          ref={inputRef}
          className={styles.input}
          placeholder="Type a command…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={onKeyDown}
        />
        <div className={styles.list}>
          {filtered.length === 0 ? (
            <div className={styles.empty}>No commands match.</div>
          ) : (
            filtered.map((c, i) => (
              <button
                type="button"
                key={c.id}
                className={`${styles.item} ${i === cursor ? styles.active : ""}`}
                onMouseEnter={() => setCursor(i)}
                onClick={() => run(c)}
              >
                <span>{c.title}</span>
                {c.shortcut && <span className={styles.shortcut}>{c.shortcut}</span>}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
