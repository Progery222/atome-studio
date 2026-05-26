import type { Account } from "@atome/shared";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useT } from "../../i18n";
import { apiFetch } from "../../lib/api";
import { useAuthStore } from "../../stores/auth";
import { useFarmStore } from "../../stores/farm";
import { useVhaStore } from "../../stores/vha";
import { AccountsMatrix } from "./AccountsMatrix";
import { CreateAccountModal } from "./CreateAccountModal";
import styles from "./AccountsPage.module.css";

const NICHE_TO_SERVICE: Record<string, string> = {
  NFL: "sportzavod",
  NBA: "sportzavod",
  SOCCER: "sportzavod",
  MMA: "sportzavod",
  F1: "sportzavod",
  NCAA: "sportzavod",
  MLB: "sportzavod",
  NHL: "sportzavod",
  BOXING: "sportzavod",
  TENNIS: "sportzavod",
  GOLF: "sportzavod",
  SPORT: "sportzavod",
  MUSIC: "agentmusic",
  PHIL_ARENA: "streamcut",
  GENERIC: "content-zavod",
};

const SERVICES = ["sportzavod", "agentmusic", "streamcut", "content-zavod"];
const SERVICE_LABELS: Record<string, string> = {
  sportzavod: "SportZavod",
  agentmusic: "agentMUSIC",
  streamcut: "StreamCut",
  "content-zavod": "Content-Zavod",
};
const SPORTZAVOD_CATEGORY_KEYS = [
  "nfl",
  "nba",
  "soccer",
  "mma",
  "f1",
  "motorsport",
  "sports_biz",
  "lifestyle",
  "ncaa",
  "mlb",
  "nhl",
  "sports_tech",
  "boxing",
  "esports",
  "extreme",
  "ai",
];
const STREAMCUT_CATEGORY_KEYS = ["streaming", "gaming", "podcasts", "education", "ai", "business", "lifestyle", "clips"];
const STREAMCUT_INFLUENCER_KEYS = ["phil"];
const AGENTMUSIC_TECHNICAL_KEYS = ["karaoke", "lyrics", "music", "chorus"];
const SERVICE_CATEGORY_KEYS: Record<string, string[]> = {
  sportzavod: SPORTZAVOD_CATEGORY_KEYS,
};
const ROUTING_UI_VERSION = "routing-ui-2026-05-15-7";
const ALL_STATUSES: Account["status"][] = ["active", "warmup", "paused", "banned"];
const STATUS_COLOR: Record<Account["status"], string> = {
  active: "#22c55e",
  warmup: "#fbbf24",
  paused: "#60a5fa",
  banned: "#ef4444",
};

interface ContentTheme {
  id: string;
  serviceKey: string;
  themeKey: string;
  name: string;
  status: string;
  source?: string;
}

interface ContentRouteRule {
  id: string;
  targetType: "phone" | "account";
  targetId: string;
  themeIds: string[];
  queueDepth: number;
  status: string;
}

type TargetKey = `phone:${string}` | `account:${string}`;

function nicheToService(n: string | undefined | null): string {
  if (!n) return "—";
  return NICHE_TO_SERVICE[n.toUpperCase()] ?? "—";
}

function targetKey(type: "phone" | "account", id: string): TargetKey {
  return `${type}:${id}` as TargetKey;
}

function parseTargetKey(key: TargetKey): { type: "phone" | "account"; id: string } {
  const [type, ...rest] = key.split(":");
  return { type: type as "phone" | "account", id: rest.join(":") };
}

function themeLabel(theme: ContentTheme): string {
  return `${theme.serviceKey}/${theme.themeKey}`;
}

function isTechnicalTheme(theme: ContentTheme): boolean {
  const values = [theme.themeKey, theme.name].map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (theme.serviceKey === "agentmusic" && AGENTMUSIC_TECHNICAL_KEYS.includes(theme.themeKey.toLowerCase())) {
    return true;
  }
  if (theme.serviceKey === "streamcut") {
    return STREAMCUT_CATEGORY_KEYS.includes(theme.themeKey.toLowerCase()) || !STREAMCUT_INFLUENCER_KEYS.includes(theme.themeKey.toLowerCase());
  }
  const canonicalKeys = SERVICE_CATEGORY_KEYS[theme.serviceKey];
  if (canonicalKeys && !canonicalKeys.includes(theme.themeKey.toLowerCase())) {
    return true;
  }
  return values.some((value) => {
    const clean = value.replace(/\.(mp4|mov|m4v|json)$/i, "");
    return (
      value === "unclassified" ||
      /\.(mp4|mov|m4v|json)$/i.test(value) ||
      /^\d{4}[-_]\d{2}[-_]\d{2}$/.test(value) ||
      /^\d+$/.test(value) ||
      /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value) ||
      /^[a-f0-9]{10,}$/i.test(clean) ||
      /^[a-z0-9]{10,}$/i.test(clean)
    );
  });
}

function displayThemeName(theme: ContentTheme): string {
  const name = (theme.name || theme.themeKey).trim();
  if (!name || name === "unclassified") return "Без темы";
  if (theme.serviceKey === "agentmusic") return name;
  if (theme.serviceKey === "streamcut") return name;
  if (SERVICE_CATEGORY_KEYS[theme.serviceKey]?.includes(theme.themeKey.toLowerCase())) {
    return theme.themeKey.toUpperCase();
  }
  return name.replace(/\.(mp4|mov|m4v|json)$/i, "").replace(/[_-]+/g, " ");
}

function displayThemeHint(theme: ContentTheme): string {
  if (theme.serviceKey === "agentmusic") {
    return "agentMUSIC · артист";
  }
  if (theme.serviceKey === "streamcut") {
    return "StreamCut · инфлюенсер";
  }
  if (SERVICE_CATEGORY_KEYS[theme.serviceKey]?.includes(theme.themeKey.toLowerCase())) {
    return `${SERVICE_LABELS[theme.serviceKey] ?? theme.serviceKey} · все ${theme.themeKey.toUpperCase()} видео`;
  }
  return themeLabel(theme);
}

export function AccountsPage() {
  const accounts = useFarmStore((s) => s.accounts);
  const phones = useFarmStore((s) => s.phones);
  const accountsLoading = useFarmStore((s) => s.accountsLoading);
  const fetchAccounts = useFarmStore((s) => s.fetchAccounts);
  const fetchPhones = useFarmStore((s) => s.fetchPhones);
  const reloadFromSheets = useFarmStore((s) => s.reloadFromSheets);
  const role = useAuthStore((s) => s.role);
  const syncSheet = useVhaStore((s) => s.syncSheet);
  const navigate = useNavigate();
  const t = useT();
  const canCreate = role !== "viewer";

  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "matrix">("list");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<"ok" | "err" | null>(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoverBanner, setDiscoverBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState<string | "all">("all");
  const [nicheFilter, setNicheFilter] = useState<string | "all">("all");
  const [statusFilter, setStatusFilter] = useState<Account["status"] | "all">("all");
  const [themeFilter, setThemeFilter] = useState<string | "all">("all");

  const [themes, setThemes] = useState<ContentTheme[]>([]);
  const [rules, setRules] = useState<Record<string, ContentRouteRule>>({});
  const [expandedPhones, setExpandedPhones] = useState<Set<string>>(new Set());
  const [selectedTargets, setSelectedTargets] = useState<Set<TargetKey>>(new Set());
  const [selectedThemeIds, setSelectedThemeIds] = useState<Set<string>>(new Set());
  const [selectedRoutingService, setSelectedRoutingService] = useState(SERVICES[0]);
  const [showTechnicalThemes, setShowTechnicalThemes] = useState(false);
  const [queueDepth, setQueueDepth] = useState(1);
  const [routingBusy, setRoutingBusy] = useState(false);
  const [routingBanner, setRoutingBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  async function loadRouting() {
    const [themesRes, rulesRes] = await Promise.all([
      apiFetch("/api/content-routing/themes"),
      apiFetch("/api/content-routing/rules"),
    ]);
    const [themesData, rulesData] = await Promise.all([themesRes.json(), rulesRes.json()]);
    setThemes(Array.isArray(themesData) ? themesData : []);
    const next: Record<string, ContentRouteRule> = {};
    if (Array.isArray(rulesData)) {
      for (const rule of rulesData as ContentRouteRule[]) {
        next[targetKey(rule.targetType, rule.targetId)] = {
          ...rule,
          themeIds: Array.isArray(rule.themeIds) ? rule.themeIds : [],
          queueDepth: Math.max(1, Math.min(10, Number(rule.queueDepth) || 1)),
        };
      }
    }
    setRules(next);
  }

  useEffect(() => {
    fetchAccounts();
    fetchPhones();
    loadRouting().catch((e) => console.warn("content routing load failed", e));
    const id = setInterval(fetchAccounts, 60_000);
    return () => clearInterval(id);
  }, [fetchAccounts, fetchPhones]);

  useEffect(() => {
    if (selectedTargets.size !== 1) return;
    const [key] = [...selectedTargets];
    const rule = rules[key];
    setSelectedThemeIds(new Set(rule?.themeIds ?? []));
    setQueueDepth(rule?.queueDepth ?? 1);
    const firstTheme = rule?.themeIds.map((id) => themesById.get(id)).find(Boolean);
    if (firstTheme) setSelectedRoutingService(firstTheme.serviceKey);
  }, [selectedTargets, rules]);

  const themesById = useMemo(() => new Map(themes.map((theme) => [theme.id, theme])), [themes]);
  const routingServices = useMemo(() => {
    const fromThemes = [...new Set(themes.map((theme) => theme.serviceKey).filter(Boolean))];
    return [...new Set([...SERVICES, ...fromThemes])].sort((a, b) => {
      const ai = SERVICES.indexOf(a);
      const bi = SERVICES.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      if (ai >= 0) return -1;
      if (bi >= 0) return 1;
      return a.localeCompare(b);
    });
  }, [themes]);
  const visibleRoutingThemes = useMemo(() => {
    const list = themes
      .filter((theme) => theme.serviceKey === selectedRoutingService)
      .filter((theme) => showTechnicalThemes || (theme.status === "active" && !isTechnicalTheme(theme)));
    return list.sort((a, b) => displayThemeName(a).localeCompare(displayThemeName(b)));
  }, [themes, selectedRoutingService, showTechnicalThemes]);

  const accountsByPhone = useMemo(() => {
    const map = new Map<string, Account[]>();
    for (const account of accounts) {
      const phoneId = account.phone_id || "—";
      map.set(phoneId, [...(map.get(phoneId) ?? []), account]);
    }
    return map;
  }, [accounts]);

  const phoneRows = useMemo(() => {
    const known = new Set(phones.map((phone) => phone.phone_id));
    const rows: Array<{ phoneId: string; label: string; status: string; accounts: Account[] }> = phones.map((phone) => ({
      phoneId: phone.phone_id,
      label: phone.serial || phone.phone_id,
      status: phone.status,
      accounts: accountsByPhone.get(phone.phone_id) ?? [],
    }));
    for (const [phoneId, list] of accountsByPhone.entries()) {
      if (!known.has(phoneId)) rows.push({ phoneId, label: phoneId, status: "unknown", accounts: list });
    }
    return rows.sort((a, b) => a.phoneId.localeCompare(b.phoneId));
  }, [accountsByPhone, phones]);

  const niches = useMemo(
    () => [...new Set(accounts.map((a) => a.niche).filter(Boolean))].sort(),
    [accounts],
  );

  const availableNiches = useMemo(() => {
    if (serviceFilter === "all") return niches;
    return niches.filter((n) => nicheToService(n) === serviceFilter);
  }, [niches, serviceFilter]);

  function effectiveRule(account: Account): { rule?: ContentRouteRule; source: "account" | "phone" | "none" } {
    const accountRule = rules[targetKey("account", account.account_id)];
    if (accountRule) return { rule: accountRule, source: "account" };
    const phoneRule = account.phone_id ? rules[targetKey("phone", account.phone_id)] : undefined;
    if (phoneRule) return { rule: phoneRule, source: "phone" };
    return { source: "none" };
  }

  const filtered = useMemo(() => {
    let list = accounts;
    if (statusFilter !== "all") list = list.filter((a) => a.status === statusFilter);
    if (nicheFilter !== "all") list = list.filter((a) => a.niche === nicheFilter);
    if (serviceFilter !== "all") list = list.filter((a) => nicheToService(a.niche) === serviceFilter);
    if (themeFilter !== "all") {
      list = list.filter((a) => effectiveRule(a).rule?.themeIds.includes(themeFilter));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (a) =>
          a.username.toLowerCase().includes(q) ||
          a.phone_id?.toLowerCase().includes(q) ||
          a.niche?.toLowerCase().includes(q),
      );
    }
    return [...list].sort((a, b) => {
      const sa = nicheToService(a.niche);
      const sb = nicheToService(b.niche);
      if (sa !== sb) return sa.localeCompare(sb);
      const na = (a.niche || "").toLowerCase();
      const nb = (b.niche || "").toLowerCase();
      if (na !== nb) return na.localeCompare(nb);
      return a.username.localeCompare(b.username);
    });
  }, [accounts, statusFilter, nicheFilter, serviceFilter, themeFilter, search, rules]);

  const subtitle = accountsLoading
    ? t("accounts_loading")
    : accounts.length > 0
      ? `${accounts.length} ${t("accounts_unit")} · ${accounts.filter((a) => a.status === "active").length} ${t("accounts_unit_active")}`
      : t("accounts_no_data");

  function toggleExpandedPhone(phoneId: string) {
    setExpandedPhones((prev) => {
      const next = new Set(prev);
      if (next.has(phoneId)) next.delete(phoneId);
      else next.add(phoneId);
      return next;
    });
  }

  function toggleTarget(key: TargetKey) {
    setSelectedTargets((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAccountForRouting(account: Account) {
    const key = targetKey("account", account.account_id);
    setSelectedTargets(new Set([key]));
    const rule = rules[key] ?? (account.phone_id ? rules[targetKey("phone", account.phone_id)] : undefined);
    setSelectedThemeIds(new Set(rule?.themeIds ?? []));
    setQueueDepth(rule?.queueDepth ?? 1);
  }

  function toggleTheme(themeId: string) {
    setSelectedThemeIds((prev) => {
      const next = new Set(prev);
      if (next.has(themeId)) next.delete(themeId);
      else next.add(themeId);
      return next;
    });
  }

  function changeRoutingService(service: string) {
    setSelectedRoutingService(service);
    setSelectedThemeIds((prev) => {
      const next = new Set<string>();
      for (const id of prev) {
        const theme = themesById.get(id);
        if (theme?.serviceKey === service) next.add(id);
      }
      return next;
    });
  }

  async function saveRoutingRules() {
    if (selectedTargets.size === 0) return;
    setRoutingBusy(true);
    setRoutingBanner(null);
    try {
      const theme_ids = [...selectedThemeIds];
      await Promise.all(
        [...selectedTargets].map((key) => {
          const target = parseTargetKey(key);
          return apiFetch("/api/content-routing/rules", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              target_type: target.type,
              target_id: target.id,
              theme_ids,
              queue_depth: queueDepth,
            }),
          });
        }),
      );
      await loadRouting();
      setRoutingBanner({ kind: "ok", text: `Правила сохранены: ${selectedTargets.size}` });
    } catch (e: any) {
      setRoutingBanner({ kind: "err", text: e?.message || "Routing save failed" });
    } finally {
      setRoutingBusy(false);
      window.setTimeout(() => setRoutingBanner(null), 5000);
    }
  }

  async function runRoutingAction(action: "scan" | "build") {
    setRoutingBusy(true);
    setRoutingBanner(null);
    try {
      const path = action === "scan" ? "/api/content-routing/scan-minio" : "/api/content-routing/build-manifests";
      const res = await apiFetch(path, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || `${action} failed`);
      if (action === "scan") await loadRouting();
      setRoutingBanner({
        kind: "ok",
        text:
          action === "scan"
            ? `Видео обновлены: ${data.indexed ?? 0} проиндексировано`
            : `Manifest собран: ${data.account_manifests ?? 0} аккаунтов, ${data.phone_manifests ?? 0} телефонов`,
      });
    } catch (e: any) {
      setRoutingBanner({ kind: "err", text: e?.message || `${action} failed` });
    } finally {
      setRoutingBusy(false);
      window.setTimeout(() => setRoutingBanner(null), 7000);
    }
  }

  function renderRuleSummary(account: Account) {
    const { rule, source } = effectiveRule(account);
    if (!rule) return <span className={styles.noPools}>не настроено</span>;
    const list = rule.themeIds.map((id) => themesById.get(id)).filter(Boolean) as ContentTheme[];
    return (
      <div className={styles.poolChips}>
        <span className={styles.noPools}>{source} · {rule.queueDepth} видео</span>
        {list.slice(0, 2).map((theme) => (
          <span key={theme.id} className={styles.poolChip}>
            {themeLabel(theme)}
          </span>
        ))}
        {list.length > 2 && <span className={styles.noPools}>+{list.length - 2}</span>}
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <div className={styles.title}>{t("accounts_title")}</div>
          <div className={styles.subtitle}>{subtitle}</div>
        </div>
        <div className={styles.headerActions}>
          {canCreate && (
            <button
              className={styles.importBtn}
              disabled={importing}
              onClick={async () => {
                setImporting(true);
                setImportResult(null);
                try {
                  const [farmOk] = await Promise.all([
                    reloadFromSheets().catch(() => false),
                    syncSheet().catch(() => null),
                  ]);
                  setImportResult(farmOk ? "ok" : "err");
                  await fetchAccounts();
                } catch (e: any) {
                  setImportResult("err");
                  alert(e.message || "Failed to reload");
                }
                setImporting(false);
                setTimeout(() => setImportResult(null), 3000);
              }}
            >
              {importing ? t("accounts_importing") : "🔄 Sync"}
            </button>
          )}
          {importResult === "ok" && <span className={styles.importOk}>{t("accounts_import_ok")}</span>}
          {importResult === "err" && <span className={styles.importErr}>{t("accounts_import_err")}</span>}
          {canCreate && (
            <button
              className={styles.importBtn}
              disabled={discovering}
              onClick={async () => {
                setDiscovering(true);
                setDiscoverBanner(null);
                try {
                  const r = await apiFetch("/api/farm/account-creation/discover-all", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({}),
                  });
                  const data = await r.json().catch(() => ({}));
                  if (!r.ok) {
                    setDiscoverBanner({ kind: "err", text: `Discover failed: ${data?.message || r.statusText}` });
                  } else {
                    setDiscoverBanner({
                      kind: "ok",
                      text: `Discover запущен: ${data.started} phones (пропущено ${data.skipped} — cooldown ${data.cooldown_hours}h). Через 5-10 мин обнови матрицу.`,
                    });
                  }
                } catch (e: any) {
                  setDiscoverBanner({ kind: "err", text: `Discover failed: ${e?.message || e}` });
                } finally {
                  setDiscovering(false);
                  window.setTimeout(() => setDiscoverBanner(null), 10000);
                }
              }}
            >
              {discovering ? "Discovering..." : "Discover all"}
            </button>
          )}
          {canCreate && (
            <button className={styles.createBtn} onClick={() => setShowModal(true)}>
              {t("accounts_create")}
            </button>
          )}
        </div>
      </header>

      {discoverBanner && (
        <div className={discoverBanner.kind === "ok" ? styles.routingOk : styles.routingErr}>
          {discoverBanner.text}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <button
          onClick={() => setViewMode("list")}
          style={{
            background: viewMode === "list" ? "rgba(0,210,255,0.15)" : "transparent",
            color: viewMode === "list" ? "#22d3ee" : "rgba(255,255,255,0.5)",
            border: viewMode === "list" ? "1px solid rgba(0,210,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
            padding: "6px 14px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Список
        </button>
        <button
          onClick={() => setViewMode("matrix")}
          style={{
            background: viewMode === "matrix" ? "rgba(0,210,255,0.15)" : "transparent",
            color: viewMode === "matrix" ? "#22d3ee" : "rgba(255,255,255,0.5)",
            border: viewMode === "matrix" ? "1px solid rgba(0,210,255,0.4)" : "1px solid rgba(255,255,255,0.1)",
            padding: "6px 14px",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Матрица
        </button>
      </div>

      {viewMode === "matrix" ? (
        <AccountsMatrix />
      ) : (
        <>
          <div className={styles.routingPanel} data-version={ROUTING_UI_VERSION}>
            <div className={styles.routingHeader}>
              <div>
                <div className={styles.contentBindingTitle}>Фильтрация контента по темам</div>
                <div className={styles.contentBindingText}>
                  Выбери телефоны или аккаунты, затем сервис генерации и темы. Dashboard соберет manifest JSON в MinIO для будущего publisher.
                </div>
              </div>
              <div className={styles.routingActions}>
                <button className={styles.importBtn} disabled={routingBusy} onClick={() => runRoutingAction("scan")}>
                  Обновить видео из MinIO
                </button>
                <button className={styles.importBtn} disabled={routingBusy} onClick={() => runRoutingAction("build")}>
                  Собрать manifest
                </button>
              </div>
            </div>

            {routingBanner && (
              <div className={routingBanner.kind === "ok" ? styles.routingOk : styles.routingErr}>
                {routingBanner.text}
              </div>
            )}

            <div className={styles.routingGrid}>
              <div className={styles.routingTree}>
                {phoneRows.map((phone) => {
                  const expanded = expandedPhones.has(phone.phoneId);
                  const pKey = targetKey("phone", phone.phoneId);
                  return (
                    <div key={phone.phoneId} className={styles.routingPhone}>
                      <div className={styles.routingPhoneRow}>
                        <button type="button" className={styles.routingArrow} onClick={() => toggleExpandedPhone(phone.phoneId)}>
                          {expanded ? "⌄" : "›"}
                        </button>
                        <input type="checkbox" checked={selectedTargets.has(pKey)} onChange={() => toggleTarget(pKey)} />
                        <div className={styles.routingPhoneTitle}>{phone.label}</div>
                        <span className={styles.noPools}>{phone.status}</span>
                        <span className={styles.noPools}>{phone.accounts.length} acc</span>
                      </div>
                      {expanded && (
                        <div className={styles.routingAccounts}>
                          {phone.accounts.map((account) => {
                            const aKey = targetKey("account", account.account_id);
                            const summary = effectiveRule(account);
                            return (
                              <label key={account.account_id} className={styles.routingAccountRow}>
                                <input
                                  type="checkbox"
                                  checked={selectedTargets.has(aKey)}
                                  onChange={() => toggleTarget(aKey)}
                                />
                                <span className={styles.username}>{account.username}</span>
                                <span className={styles.noPools}>{account.status}</span>
                                <span className={styles.noPools}>
                                  {summary.source === "none" ? "нет правила" : `${summary.source} · ${summary.rule?.queueDepth} видео`}
                                </span>
                              </label>
                            );
                          })}
                          {phone.accounts.length === 0 && <div className={styles.noPools}>нет аккаунтов</div>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className={styles.routingEditor}>
                <div className={styles.routingEditorTop}>
                  <div className={styles.noPools}>Выбрано телефонов/аккаунтов: {selectedTargets.size}</div>
                  <label className={styles.depthControl}>
                    Сколько видео подготовить
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={queueDepth}
                      onChange={(e) => setQueueDepth(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                    />
                  </label>
                </div>

                <div className={styles.servicePicker}>
                  <div className={styles.fieldLabel}>Сервис генерации</div>
                  <div className={styles.serviceButtons}>
                    {routingServices.map((service) => (
                      <button
                        key={service}
                        type="button"
                        className={`${styles.serviceButton} ${selectedRoutingService === service ? styles.serviceButtonActive : ""}`}
                        onClick={() => changeRoutingService(service)}
                      >
                        {SERVICE_LABELS[service] ?? service}
                      </button>
                    ))}
                  </div>
                </div>

                <div className={styles.themePicker}>
                  <div className={styles.themePickerHeader}>
                    <div>
                      <div className={styles.themeGroupTitle}>
                        {selectedRoutingService === "agentmusic"
                          ? "Артисты"
                          : selectedRoutingService === "streamcut"
                            ? "Инфлюенсеры"
                            : "Темы сервиса"}
                      </div>
                      <div className={styles.contentBindingText}>
                        Сейчас показан сервис {SERVICE_LABELS[selectedRoutingService] ?? selectedRoutingService}
                      </div>
                    </div>
                    <label className={styles.technicalToggle}>
                      <input
                        type="checkbox"
                        checked={showTechnicalThemes}
                        onChange={(e) => setShowTechnicalThemes(e.target.checked)}
                      />
                      Показать технические темы
                    </label>
                  </div>
                  <div className={styles.themeButtons}>
                    {visibleRoutingThemes.map((theme) => (
                      <button
                        key={theme.id}
                        type="button"
                        className={`${styles.poolToggle} ${selectedThemeIds.has(theme.id) ? styles.poolToggleActive : ""}`}
                        onClick={() => toggleTheme(theme.id)}
                      >
                        <span>{displayThemeName(theme)}</span>
                        <small>{displayThemeHint(theme)}</small>
                      </button>
                    ))}
                  </div>
                  {themes.length === 0 && (
                    <div className={styles.emptySmall}>
                      Тем пока нет. Нажми “Обновить видео из MinIO”, чтобы индексировать видео и создать темы.
                    </div>
                  )}
                  {themes.length > 0 && visibleRoutingThemes.length === 0 && (
                    <div className={styles.emptySmall}>
                      {selectedRoutingService === "agentmusic"
                        ? "Для agentMUSIC пока нет артистов. Нужен artist в metadata или импорт артистов из agentMUSIC."
                        : selectedRoutingService === "streamcut"
                          ? "Для StreamCut пока нет инфлюенсеров. Нужен influencer/creator/speaker в metadata."
                          : "Для этого сервиса пока нет понятных тем. Нажми “Обновить видео из MinIO”."}
                    </div>
                  )}
                </div>

                <div className={styles.routingActions}>
                  <button type="button" className={styles.importBtn} onClick={() => setSelectedThemeIds(new Set())}>
                    Сбросить выбор
                  </button>
                  <button
                    type="button"
                    className={styles.createBtn}
                    disabled={routingBusy || selectedTargets.size === 0}
                    onClick={saveRoutingRules}
                  >
                    {routingBusy ? "Сохранение..." : "Сохранить правила"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.filtersRow}>
            <input
              type="text"
              className={styles.searchInput}
              placeholder={t("accounts_search_ph")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className={styles.filterSelect}
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value);
                setNicheFilter("all");
              }}
            >
              <option value="all">Все сервисы</option>
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select className={styles.filterSelect} value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)}>
              <option value="all">{t("accounts_niches_all")}</option>
              {availableNiches.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
            <select className={styles.filterSelect} value={themeFilter} onChange={(e) => setThemeFilter(e.target.value)}>
              <option value="all">Все темы routing</option>
              {themes.map((theme) => (
                <option key={theme.id} value={theme.id}>
                  {themeLabel(theme)}
                </option>
              ))}
            </select>
            <div className={styles.filterTabs}>
              <button
                className={`${styles.filterTab} ${statusFilter === "all" ? styles.filterTabActive : ""}`}
                onClick={() => setStatusFilter("all")}
              >
                {t("accounts_filter_all")}
              </button>
              {ALL_STATUSES.map((st) => {
                const cnt = accounts.filter((a) => a.status === st).length;
                return (
                  <button
                    key={st}
                    className={`${styles.filterTab} ${statusFilter === st ? styles.filterTabActive : ""}`}
                    onClick={() => setStatusFilter(st)}
                    style={statusFilter === st ? { color: STATUS_COLOR[st] } : undefined}
                  >
                    {st}
                    {cnt > 0 && <span className={styles.filterCount}>{cnt}</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {filtered.length === 0 && !accountsLoading ? (
            <div className={styles.empty}>{accounts.length === 0 ? t("accounts_empty") : t("accounts_empty_filter")}</div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {[
                      t("accounts_col_phone"),
                      "Username",
                      "Сервис",
                      t("accounts_col_niche"),
                      t("accounts_col_status"),
                      "Health",
                      t("accounts_col_posts_today"),
                      t("accounts_col_posts_total"),
                      "Routing",
                    ].map((h) => (
                      <th key={h} className={styles.th}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((acc) => (
                    <tr key={acc.account_id} className={styles.tr} onClick={() => navigate(`/accounts/${acc.account_id}`)}>
                      <td className={styles.td}>
                        <span className={styles.phoneMain}>{acc.phone_id || "—"}</span>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.username}>{acc.username}</span>
                      </td>
                      <td className={styles.td}>
                        <span style={{ color: "#22d3ee", fontSize: 12 }}>{nicheToService(acc.niche)}</span>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.niche}>{acc.niche}</span>
                      </td>
                      <td className={styles.td}>
                        <span className={styles.statusDot} style={{ background: STATUS_COLOR[acc.status] }} />
                        {acc.status}
                      </td>
                      <td className={styles.td}>{acc.health_score}%</td>
                      <td className={styles.td}>{acc.stats?.posts_today ?? 0}</td>
                      <td className={styles.td}>{acc.stats?.posts_total ?? 0}</td>
                      <td className={styles.td} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.contentCell}>
                          {renderRuleSummary(acc)}
                          <button type="button" className={styles.managePoolsBtn} onClick={() => selectAccountForRouting(acc)}>
                            Настроить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {showModal && (
        <CreateAccountModal
          phones={phones}
          onClose={() => {
            setShowModal(false);
            fetchAccounts();
          }}
        />
      )}
    </div>
  );
}
