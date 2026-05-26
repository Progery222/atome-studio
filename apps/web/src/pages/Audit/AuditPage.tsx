import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";
import styles from "./AuditPage.module.css";

interface AuditRow {
  id: string;
  userId: string | null;
  userEmail: string | null;
  action: string;
  target: string | null;
  ip: string | null;
  status: string;
  createdAt: string;
  payloadJson?: unknown;
}

export function AuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ limit: "200" });
        if (actionFilter) q.set("action", actionFilter);
        const res = await apiFetch(`/api/audit?${q.toString()}`);
        const data = (await res.json()) as AuditRow[];
        if (!cancelled) setRows(Array.isArray(data) ? data : []);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [actionFilter]);

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <h1>Audit log</h1>
        <input
          className={styles.filter}
          placeholder="filter by action (e.g. autonomy.pause)"
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
        />
      </header>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Target</th>
              <th>Status</th>
              <th>IP</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className={styles.dim}>
                  Loading…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.dim}>
                  No entries.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id}>
                  <td>{new Date(r.createdAt).toLocaleString()}</td>
                  <td>{r.userEmail ?? r.userId ?? "—"}</td>
                  <td>
                    <code>{r.action}</code>
                  </td>
                  <td>{r.target ?? "—"}</td>
                  <td className={r.status === "error" ? styles.err : ""}>{r.status}</td>
                  <td>{r.ip ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
