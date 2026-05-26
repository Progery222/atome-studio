import { useEffect, useState } from "react";
import { apiFetch } from "../../lib/api";

interface PublishStats {
  since_min: number;
  total: number;
  by_status: Record<string, number>;
  success_rate: number;
  by_platform: Record<string, { total: number; completed: number; failed: number; success_rate: number }>;
  by_phone: Record<string, number>;
  by_hour: Record<string, number>;
  duration_avg_s: number;
  duration_max_s: number;
}

interface PublishEvent {
  task_id: string;
  phone_id: string;
  phone_display_name?: string | null;
  phone_display_id?: string | null;
  phone_serial_suffix?: string | null;
  phone_farm_number?: number | null;
  account_id: string;
  platform: string;
  caption: string;
  hashtags: string[];
  status: string;
  error: string;
  attempt: number;
  scheduled_at: string | null;
  executed_at: string | null;
  created_at: string | null;
  duration_s: number | null;
  thumbnail_url: string | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube_shorts: "YouTube Shorts",
};

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  in_progress: "#3b82f6",
  scheduled: "#a78bfa",
  failed: "#ef4444",
  dead: "#6b7280",
};

export function PublishAnalytics() {
  const [stats, setStats] = useState<PublishStats | null>(null);
  const [events, setEvents] = useState<PublishEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [windowMin, setWindowMin] = useState(1440); // 24h

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, e] = await Promise.all([
          apiFetch(`/api/publish/stats?since_min=${windowMin}`),
          apiFetch(`/api/publish/events?since_min=${windowMin}&limit=20`),
        ]);
        if (cancelled) return;
        const sJson = (await s.json()) as PublishStats;
        const eJson = (await e.json()) as { items: PublishEvent[] };
        setStats(sJson);
        setEvents(eJson.items || []);
      } catch (err) {
        console.warn("PublishAnalytics load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [windowMin]);

  if (loading) return <div style={panel}>Загрузка аналитики…</div>;
  if (!stats) return <div style={panel}>Нет данных</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={{ margin: 0, fontSize: 16, color: "#fff" }}>📊 Аналитика публикаций</h3>
        <select
          value={windowMin}
          onChange={(e) => setWindowMin(Number(e.target.value))}
          style={{
            background: "#1a1a2e",
            color: "#fff",
            border: "1px solid #2a2a3e",
            borderRadius: 6,
            padding: "4px 10px",
            fontSize: 13,
          }}
        >
          <option value={60}>За 1 час</option>
          <option value={360}>За 6 часов</option>
          <option value={1440}>За 24 часа</option>
          <option value={10080}>За 7 дней</option>
        </select>
      </header>

      {/* KPI cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        <KPI label="Всего публикаций" value={stats.total} color="#4a9eff" />
        <KPI label="Success rate" value={`${stats.success_rate}%`} color="#10b981" />
        <KPI label="Успешных" value={stats.by_status.completed || 0} color="#10b981" />
        <KPI label="Провалились" value={(stats.by_status.failed || 0) + (stats.by_status.dead || 0)} color="#ef4444" />
        <KPI label="Avg время" value={`${stats.duration_avg_s.toFixed(0)}s`} color="#a78bfa" />
      </div>

      {/* Per-platform */}
      <div style={panel}>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>По платформам</div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {Object.entries(stats.by_platform).map(([plat, p]) => (
            <div key={plat} style={{ flex: "1 1 200px", padding: 10, background: "#0f0f1a", borderRadius: 6 }}>
              <div style={{ fontWeight: 600, color: "#fff", marginBottom: 4 }}>{PLATFORM_LABELS[plat] || plat}</div>
              <div style={{ fontSize: 12, color: "#888" }}>
                {p.completed}/{p.total} • <span style={{ color: p.success_rate > 50 ? "#10b981" : "#ef4444" }}>{p.success_rate}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hourly bar chart */}
      {Object.keys(stats.by_hour).length > 0 && (
        <div style={panel}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>По часам</div>
          <HourlyBars data={stats.by_hour} />
        </div>
      )}

      {/* Recent events */}
      <div style={panel}>
        <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>Последние публикации</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflow: "auto" }}>
          {events.length === 0 && <div style={{ color: "#666", fontSize: 12 }}>пусто</div>}
          {events.map((e) => (
            <EventRow key={e.task_id} ev={e} />
          ))}
        </div>
      </div>
    </div>
  );
}

const panel: React.CSSProperties = {
  background: "#13131f",
  border: "1px solid #232336",
  borderRadius: 8,
  padding: 14,
};

function KPI({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div style={{ ...panel, borderLeft: `3px solid ${color}` }}>
      <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#fff", marginTop: 4 }}>{value}</div>
    </div>
  );
}

function HourlyBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data).slice(-24);
  const max = Math.max(...entries.map(([, v]) => v), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 80 }}>
      {entries.map(([hour, count]) => (
        <div
          key={hour}
          title={`${hour}: ${count}`}
          style={{
            flex: 1,
            background: "#4a9eff",
            height: `${(count / max) * 100}%`,
            minHeight: 2,
            borderRadius: "2px 2px 0 0",
          }}
        />
      ))}
    </div>
  );
}

function EventRow({ ev }: { ev: PublishEvent }) {
  const color = STATUS_COLORS[ev.status] || "#666";
  const time = ev.created_at ? new Date(ev.created_at).toLocaleTimeString() : "?";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0", borderBottom: "1px solid #1a1a2e", fontSize: 12 }}>
      <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
      <span style={{ color: "#888", width: 70, fontSize: 11 }}>{time}</span>
      <span style={{ color: "#fff", width: 100, fontWeight: 500 }}>{PLATFORM_LABELS[ev.platform] || ev.platform}</span>
      <span style={{ color: "#888", width: 96, fontSize: 11 }}>{ev.phone_display_name || (ev.phone_id ? ev.phone_id.slice(-6) : "—")}</span>
      <span style={{ color: "#ccc", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {ev.caption || ev.error || "—"}
      </span>
      {ev.duration_s !== null && <span style={{ color: "#888", fontSize: 11 }}>{ev.duration_s.toFixed(0)}s</span>}
    </div>
  );
}
