import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "../../lib/api";

interface ContentService {
  id: string;
  service_key: string;
  name: string;
  status: string;
}

interface ContentPool {
  id: string;
  service_key: string;
  pool_key: string;
  name: string;
  description: string;
  status: string;
  default_priority: number;
}

interface AccountGroup {
  id: string;
  group_key: string;
  name: string;
  status: string;
}

interface AccountRow {
  account_id: string;
  phone_id: string;
  platform: string;
  username: string;
  niche: string;
  status: string;
}

interface VideoAsset {
  id: string;
  service_key: string;
  pool_key: string;
  object_key: string;
  title: string;
  status: string;
  uploaded_at?: string;
}

const STATUS_COLORS: Record<string, string> = {
  active: "#22c55e",
  ready: "#22c55e",
  paused: "#f59e0b",
  reserved: "#38bdf8",
  downloaded: "#a78bfa",
  blocked: "#ef4444",
  failed: "#ef4444",
  used: "#71717a",
  archived: "#71717a",
};

const DEFAULT_SERVICES: ContentService[] = [
  { id: "sportzavod", service_key: "sportzavod", name: "SportZavod", status: "active" },
  { id: "streamcut", service_key: "streamcut", name: "StreamCut", status: "active" },
  { id: "agentmusic", service_key: "agentmusic", name: "AgentMusic", status: "active" },
  { id: "content-zavod", service_key: "content-zavod", name: "Content Zavod", status: "active" },
];

export function AccountManager() {
  const [services, setServices] = useState<ContentService[]>([]);
  const [pools, setPools] = useState<ContentPool[]>([]);
  const [groups, setGroups] = useState<AccountGroup[]>([]);
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [groupAccounts, setGroupAccounts] = useState<AccountRow[]>([]);
  const [groupPools, setGroupPools] = useState<ContentPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPool, setNewPool] = useState({
    service_key: "sportzavod",
    pool_key: "",
    name: "",
    description: "",
  });
  const [newGroup, setNewGroup] = useState({ group_key: "", name: "" });
  const [accountID, setAccountID] = useState("");
  const [poolID, setPoolID] = useState("");
  const [poolServiceFilter, setPoolServiceFilter] = useState("all");
  const [poolStatusFilter, setPoolStatusFilter] = useState("all");
  const [syncingSportThemes, setSyncingSportThemes] = useState(false);

  const availablePools = useMemo(() => {
    const attached = new Set(groupPools.map((p) => p.id));
    return pools.filter((p) => !attached.has(p.id));
  }, [groupPools, pools]);

  const visiblePools = useMemo(() => {
    return pools.filter((pool) => {
      if (poolServiceFilter !== "all" && pool.service_key !== poolServiceFilter) return false;
      if (poolStatusFilter !== "all" && pool.status !== poolStatusFilter) return false;
      return true;
    });
  }, [poolServiceFilter, poolStatusFilter, pools]);

  async function loadAll() {
    setLoading(true);
    try {
      const [svcRes, poolRes, groupRes, videoRes] = await Promise.all([
        apiFetch("/api/content-services"),
        apiFetch("/api/content-pools"),
        apiFetch("/api/account-groups"),
        apiFetch("/api/videos/assets?limit=200"),
      ]);
      const [svcData, poolData, groupData, videoData] = await Promise.all([
        svcRes.json(),
        poolRes.json(),
        groupRes.json(),
        videoRes.json(),
      ]);
      const loadedServices = Array.isArray(svcData) ? svcData : [];
      const serviceMap = new Map<string, ContentService>();
      [...DEFAULT_SERVICES, ...loadedServices].forEach((service) => {
        serviceMap.set(service.service_key, service);
      });
      setServices([...serviceMap.values()]);
      setPools(Array.isArray(poolData) ? poolData : []);
      setGroups(Array.isArray(groupData) ? groupData : []);
      setVideos(Array.isArray(videoData) ? videoData : []);
    } finally {
      setLoading(false);
    }
  }

  async function loadGroupDetails(groupID: string) {
    if (!groupID) {
      setGroupAccounts([]);
      setGroupPools([]);
      return;
    }
    const [accountsRes, poolsRes] = await Promise.all([
      apiFetch(`/api/account-groups/${groupID}/accounts`),
      apiFetch(`/api/account-groups/${groupID}/pools`),
    ]);
    const [accountsData, poolsData] = await Promise.all([accountsRes.json(), poolsRes.json()]);
    setGroupAccounts(Array.isArray(accountsData) ? accountsData : []);
    setGroupPools(Array.isArray(poolsData) ? poolsData : []);
  }

  useEffect(() => {
    loadAll().catch(console.warn);
  }, []);

  useEffect(() => {
    loadGroupDetails(selectedGroup).catch(console.warn);
  }, [selectedGroup]);

  async function createPool() {
    await apiFetch("/api/content-pools", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPool),
    });
    setNewPool({ service_key: newPool.service_key, pool_key: "", name: "", description: "" });
    await loadAll();
  }

  async function syncSportzavodThemes() {
    setSyncingSportThemes(true);
    try {
      await apiFetch("/api/content-pools/sync/sportzavod-themes", { method: "POST" });
      await loadAll();
    } finally {
      setSyncingSportThemes(false);
    }
  }

  async function setPoolStatus(pool: ContentPool, status: "paused" | "blocked" | "archived") {
    await apiFetch(`/api/content-pools/${pool.id}/${status === "paused" ? "pause" : status}`, {
      method: "POST",
    });
    await loadAll();
    if (selectedGroup) await loadGroupDetails(selectedGroup);
  }

  async function createGroup() {
    await apiFetch("/api/account-groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newGroup),
    });
    setNewGroup({ group_key: "", name: "" });
    await loadAll();
  }

  async function addAccount() {
    if (!selectedGroup || !accountID.trim()) return;
    await apiFetch(`/api/account-groups/${selectedGroup}/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account_id: accountID.trim() }),
    });
    setAccountID("");
    await loadGroupDetails(selectedGroup);
  }

  async function addPool() {
    if (!selectedGroup || !poolID) return;
    await apiFetch(`/api/account-groups/${selectedGroup}/pools`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pool_id: poolID, priority: 100 }),
    });
    setPoolID("");
    await loadGroupDetails(selectedGroup);
  }

  if (loading) return <div style={page}>Loading content pools...</div>;

  return (
    <div style={page}>
      <header style={header}>
        <div>
          <h1 style={title}>Content Pools</h1>
          <p style={subtitle}>Pools are created from themes, artists, and speakers. Operators attach them to phones manually.</p>
        </div>
        <div style={headerActions}>
          <button type="button" onClick={syncSportzavodThemes} disabled={syncingSportThemes} style={button}>
            {syncingSportThemes ? "Syncing..." : "Sync SportZavod themes"}
          </button>
          <button type="button" onClick={() => loadAll()} style={button}>
            Refresh
          </button>
        </div>
      </header>

      <section style={grid}>
        <div style={panel}>
          <h2 style={sectionTitle}>Create Pool</h2>
          <select
            value={newPool.service_key}
            onChange={(e) => setNewPool({ ...newPool, service_key: e.target.value })}
            style={input}
          >
            {services.map((s) => (
              <option key={s.service_key} value={s.service_key}>
                {s.name}
              </option>
            ))}
          </select>
          <input
            placeholder="pool_key, e.g. sports_news or phil"
            value={newPool.pool_key}
            onChange={(e) => setNewPool({ ...newPool, pool_key: normalize(e.target.value) })}
            style={input}
          />
          <input
            placeholder="Name"
            value={newPool.name}
            onChange={(e) => setNewPool({ ...newPool, name: e.target.value })}
            style={input}
          />
          <input
            placeholder="Description"
            value={newPool.description}
            onChange={(e) => setNewPool({ ...newPool, description: e.target.value })}
            style={input}
          />
          <button type="button" disabled={!newPool.pool_key} onClick={createPool} style={button}>
            Create pool
          </button>
        </div>

        <div style={panel}>
          <h2 style={sectionTitle}>Create Account Group</h2>
          <input
            placeholder="group_key, e.g. sports_general_accounts"
            value={newGroup.group_key}
            onChange={(e) => setNewGroup({ ...newGroup, group_key: normalize(e.target.value) })}
            style={input}
          />
          <input
            placeholder="Name"
            value={newGroup.name}
            onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
            style={input}
          />
          <button type="button" disabled={!newGroup.group_key} onClick={createGroup} style={button}>
            Create group
          </button>
        </div>
      </section>

      <section style={split}>
        <div style={panel}>
          <h2 style={sectionTitle}>Pools</h2>
          <div style={attachRow}>
            <select value={poolServiceFilter} onChange={(e) => setPoolServiceFilter(e.target.value)} style={input}>
              <option value="all">All services</option>
              {services.map((service) => (
                <option key={service.service_key} value={service.service_key}>
                  {service.name}
                </option>
              ))}
            </select>
            <select value={poolStatusFilter} onChange={(e) => setPoolStatusFilter(e.target.value)} style={input}>
              <option value="all">All statuses</option>
              <option value="active">active</option>
              <option value="paused">paused</option>
              <option value="blocked">blocked</option>
              <option value="archived">archived</option>
            </select>
          </div>
          <div style={list}>
            {visiblePools.map((pool) => (
              <div key={pool.id} style={row}>
                <div>
                  <strong>{pool.service_key}/{pool.pool_key}</strong>
                  <div style={muted}>{pool.name || pool.description || "No description"}</div>
                </div>
                <div style={actions}>
                  <span style={{ ...badge, color: STATUS_COLORS[pool.status] ?? "#a1a1aa" }}>{pool.status}</span>
                  <button type="button" onClick={() => setPoolStatus(pool, "paused")} style={miniButton}>Pause</button>
                  <button type="button" onClick={() => setPoolStatus(pool, "blocked")} style={dangerButton}>Block</button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={panel}>
          <h2 style={sectionTitle}>Groups</h2>
          <div style={list}>
            {groups.map((group) => (
              <button
                type="button"
                key={group.id}
                onClick={() => setSelectedGroup(group.id)}
                style={{
                  ...rowButton,
                  borderColor: selectedGroup === group.id ? "#38bdf8" : "rgba(255,255,255,.08)",
                }}
              >
                <span>{group.name}</span>
                <span style={muted}>{group.group_key}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section style={split}>
        <div style={panel}>
          <h2 style={sectionTitle}>Selected Group</h2>
          {!selectedGroup ? (
            <div style={muted}>Select an account group.</div>
          ) : (
            <>
              <div style={attachRow}>
                <input
                  placeholder="account_id"
                  value={accountID}
                  onChange={(e) => setAccountID(e.target.value)}
                  style={input}
                />
                <button type="button" onClick={addAccount} style={button}>Add account</button>
              </div>
              <div style={attachRow}>
                <select value={poolID} onChange={(e) => setPoolID(e.target.value)} style={input}>
                  <option value="">Select pool</option>
                  {availablePools.map((pool) => (
                    <option key={pool.id} value={pool.id}>
                      {pool.service_key}/{pool.pool_key}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={addPool} style={button}>Attach pool</button>
              </div>

              <h3 style={smallTitle}>Allowed Pools</h3>
              {groupPools.map((pool) => (
                <div key={pool.id} style={compactRow}>
                  <span>{pool.service_key}/{pool.pool_key}</span>
                  <span style={{ color: STATUS_COLORS[pool.status] ?? "#a1a1aa" }}>{pool.status}</span>
                </div>
              ))}

              <h3 style={smallTitle}>Accounts</h3>
              {groupAccounts.map((account) => (
                <div key={account.account_id} style={compactRow}>
                  <span>@{account.username || account.account_id}</span>
                  <span style={muted}>{account.niche || account.platform}</span>
                  <span>{account.phone_id || "no phone"}</span>
                </div>
              ))}
            </>
          )}
        </div>

        <div style={panel}>
          <h2 style={sectionTitle}>Recent Video Assets</h2>
          <div style={list}>
            {videos.slice(0, 80).map((video) => (
              <div key={video.id} style={row}>
                <div style={{ minWidth: 0 }}>
                  <strong>{video.title || video.id}</strong>
                  <div style={mono}>{video.service_key}/{video.pool_key}</div>
                  <div style={muted}>{video.object_key}</div>
                </div>
                <span style={{ ...badge, color: STATUS_COLORS[video.status] ?? "#a1a1aa" }}>{video.status}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^\p{L}\p{N}-]+/gu, "_")
    .replace(/^_+|_+$/g, "");
}

const page: React.CSSProperties = {
  padding: 24,
  color: "var(--text-primary)",
  display: "flex",
  flexDirection: "column",
  gap: 18,
};

const header: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 16,
};

const headerActions: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
  justifyContent: "flex-end",
};

const title: React.CSSProperties = { margin: 0, fontSize: 24, letterSpacing: 0 };
const subtitle: React.CSSProperties = { margin: "6px 0 0", color: "var(--text-secondary)", fontSize: 13 };
const sectionTitle: React.CSSProperties = { margin: "0 0 12px", fontSize: 15, letterSpacing: 0 };
const smallTitle: React.CSSProperties = { margin: "16px 0 8px", fontSize: 13, letterSpacing: 0 };

const grid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 14,
};

const split: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))",
  gap: 14,
};

const panel: React.CSSProperties = {
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 8,
  padding: 14,
  background: "rgba(255,255,255,.035)",
};

const input: React.CSSProperties = {
  width: "100%",
  minHeight: 36,
  borderRadius: 6,
  border: "1px solid rgba(255,255,255,.12)",
  background: "rgba(0,0,0,.22)",
  color: "var(--text-primary)",
  padding: "8px 10px",
  fontSize: 12,
  boxSizing: "border-box",
  marginBottom: 8,
};

const button: React.CSSProperties = {
  minHeight: 34,
  borderRadius: 6,
  border: "1px solid rgba(56,189,248,.35)",
  background: "rgba(56,189,248,.12)",
  color: "#e0f2fe",
  padding: "7px 12px",
  cursor: "pointer",
};

const miniButton: React.CSSProperties = { ...button, minHeight: 28, padding: "4px 8px", fontSize: 11 };
const dangerButton: React.CSSProperties = {
  ...miniButton,
  borderColor: "rgba(239,68,68,.35)",
  background: "rgba(239,68,68,.1)",
  color: "#fecaca",
};

const list: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 8, maxHeight: 520, overflow: "auto" };
const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 0",
  borderBottom: "1px solid rgba(255,255,255,.06)",
};
const rowButton: React.CSSProperties = {
  ...row,
  width: "100%",
  border: "1px solid rgba(255,255,255,.08)",
  borderRadius: 6,
  background: "rgba(0,0,0,.16)",
  color: "var(--text-primary)",
  cursor: "pointer",
  padding: 10,
};
const compactRow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr auto auto",
  gap: 10,
  padding: "7px 0",
  borderBottom: "1px solid rgba(255,255,255,.05)",
  fontSize: 12,
};
const attachRow: React.CSSProperties = { display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "start" };
const actions: React.CSSProperties = { display: "flex", gap: 8, alignItems: "center", flexShrink: 0 };
const badge: React.CSSProperties = { fontSize: 11, textTransform: "uppercase", fontWeight: 700 };
const muted: React.CSSProperties = { color: "var(--text-secondary)", fontSize: 12, overflow: "hidden", textOverflow: "ellipsis" };
const mono: React.CSSProperties = { color: "#93c5fd", fontSize: 11, fontFamily: "monospace" };
