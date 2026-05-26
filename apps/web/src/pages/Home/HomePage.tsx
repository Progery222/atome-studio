import { type CSSProperties, useEffect, useMemo, useState } from "react";
import type { Phone, VhaPolicy } from "@atome/shared";
import { PhoneStream } from "../../components/PhoneStream/PhoneStream";
import { QueuePanel } from "../../components/QueuePanel/QueuePanel";
import { useAutonomyStore } from "../../stores/autonomy";
import { useFarmStore } from "../../stores/farm";
import { useVhaStore } from "../../stores/vha";
import styles from "./HomePage.module.css";

function phoneDisplayName(phone: {
  display_name?: string | null;
  display_id?: string | null;
  serial?: string | null;
  phone_id: string;
}) {
  return phone.display_name || phone.display_id || phone.serial || phone.phone_id;
}

function tsAgo(ts?: string | null): string {
  if (!ts) return "";
  const t = Date.parse(ts);
  if (Number.isNaN(t)) return "";
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const POLICIES: VhaPolicy[] = ["off", "manual", "auto"];

function phoneAccountCount(phone: Phone): number {
  if (Array.isArray(phone.vha_accounts) && phone.vha_accounts.length > 0)
    return phone.vha_accounts.length;
  if (Array.isArray(phone.accounts)) return phone.accounts.length;
  return 0;
}

type CardBorderState = "linked" | "pending" | "banned" | "neutral";

function phoneCardBorderState(phone: Phone): CardBorderState {
  const accounts = phone.vha_accounts ?? [];
  if (accounts.length === 0) return "neutral";
  let hasLinked = false;
  let hasPending = false;
  let hasBanned = false;
  for (const a of accounts) {
    if (a.status === "banned" || a.plan_state === "banned") hasBanned = true;
    if (a.plan_state === "linked") hasLinked = true;
    if (a.plan_state === "planned" || a.plan_state === "bound")
      hasPending = true;
  }
  if (hasBanned) return "banned";
  if (hasLinked) return "linked";
  if (hasPending) return "pending";
  return "neutral";
}

const CARD_BORDER_STYLE: Record<CardBorderState, CSSProperties> = {
  linked: { border: "1px solid #22c55e", boxShadow: "0 0 0 1px #14532d40" },
  pending: { border: "1px solid #fbbf24", boxShadow: "0 0 0 1px #78350f40" },
  banned: { border: "1px solid #ef4444", boxShadow: "0 0 0 1px #7f1d1d40" },
  neutral: { border: "1px solid transparent" },
};

function phoneThemeKey(phone: Phone): string | null {
  const accounts = phone.vha_accounts ?? [];
  for (const a of accounts) {
    if (a.theme_key) return a.theme_key;
  }
  return null;
}

function VhaPanel({ phone }: { phone: Phone }) {
  const setPolicy = useVhaStore((s) => s.setPolicy);
  const runVhaNow = useVhaStore((s) => s.runVhaNow);
  const fetchFleet = useVhaStore((s) => s.fetchFleet);
  const rediscoverPhone = useVhaStore((s) => s.rediscoverPhone);
  const markAccountBanned = useVhaStore((s) => s.markAccountBanned);
  const detachPlan = useVhaStore((s) => s.detachPlan);
  const autofillPlan = useVhaStore((s) => s.autofillPlan);
  const [pending, setPending] = useState(false);
  const [rediscoverPending, setRediscoverPending] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [autofillPending, setAutofillPending] = useState(false);
  const [localPolicy, setLocalPolicy] = useState<VhaPolicy | null>(
    (phone.vha?.policy as VhaPolicy | undefined) ?? null,
  );

  const accounts = phone.vha_accounts ?? [];
  const accountCount = phoneAccountCount(phone);
  const noAccounts = accountCount === 0;
  const hasVha = !!phone.vha?.vha_id;
  const linkedPlans = accounts.filter((a) => !!a.plan_id);
  const hasLinkedPlans = linkedPlans.length > 0;

  const onPolicy = async (next: VhaPolicy) => {
    if (pending || !phone.vha?.vha_id) return;
    if (noAccounts && next !== "off") {
      alert("Сначала привяжите plan к телефону (no accounts)");
      return;
    }
    setPending(true);
    setLocalPolicy(next);
    try {
      await setPolicy(phone.vha.vha_id, next);
      await fetchFleet();
    } catch (e) {
      alert(`Policy change failed: ${(e as Error).message}`);
    } finally {
      setPending(false);
    }
  };

  const onRun = async () => {
    if (pending || !phone.vha?.vha_id) return;
    if (noAccounts) {
      alert("No accounts on this phone — bind a plan first");
      return;
    }
    setPending(true);
    try {
      const r = (await runVhaNow(phone.vha.vha_id)) as Record<string, unknown>;
      const action = r.final_action ?? r.action ?? "?";
      const taskId = r.pushed_task_id ?? r.task_id ?? "—";
      alert(`Decision: ${action} · task=${taskId}`);
      await fetchFleet();
    } catch (e) {
      alert(`Run failed: ${(e as Error).message}`);
    } finally {
      setPending(false);
    }
  };

  const onRediscover = async () => {
    if (rediscoverPending || discovering) return;
    setRediscoverPending(true);
    setDiscovering(true);
    try {
      await rediscoverPhone(phone.phone_id);
      // Auto-clear discovering after 120s + refresh
      setTimeout(() => {
        setDiscovering(false);
        fetchFleet().catch(() => {});
      }, 120_000);
    } catch (e) {
      setDiscovering(false);
      alert(`Re-discover failed: ${(e as Error).message}`);
    } finally {
      setRediscoverPending(false);
    }
  };

  const onDetach = async (planId: string, username: string | null | undefined) => {
    const ok = window.confirm(
      `Отвязать @${username ?? "?"} от плана?`,
    );
    if (!ok) return;
    try {
      await detachPlan(planId);
      await fetchFleet();
    } catch (e) {
      alert(`Detach failed: ${(e as Error).message}`);
    }
  };

  const onAutofillPhone = async () => {
    if (autofillPending) return;
    if (!hasLinkedPlans) {
      alert("Нет привязанных plans на этом телефоне");
      return;
    }
    const ok = window.confirm(
      "Дозаполнить пустые поля персоны через LLM для всех plans телефона?",
    );
    if (!ok) return;
    setAutofillPending(true);
    try {
      const results = await Promise.allSettled(
        linkedPlans
          .filter((a) => a.plan_id)
          .map((a) => autofillPlan(a.plan_id as string)),
      );
      let totalFilled = 0;
      let plansTouched = 0;
      let endpointMissing = false;
      for (const r of results) {
        if (r.status !== "fulfilled") continue;
        if (r.value.status === 404) endpointMissing = true;
        const fields = r.value.filled_fields ?? [];
        if (fields.length > 0) {
          totalFilled += fields.length;
          plansTouched += 1;
        }
      }
      if (endpointMissing) {
        alert("Autofill endpoint не задеплоен на сервере (404)");
      } else {
        alert(
          `Autofill: заполнено ${totalFilled} полей в ${plansTouched} plans`,
        );
        await fetchFleet();
      }
    } finally {
      setAutofillPending(false);
    }
  };

  const policy = localPolicy ?? "off";
  const persona = phone.persona;
  const project = phone.project;
  const last = phone.last_decision;
  const themeKey = phoneThemeKey(phone);

  return (
    <div
      style={{
        marginTop: 6,
        padding: "6px 8px",
        background: "rgba(255,255,255,0.03)",
        borderRadius: 6,
        fontSize: 11,
        color: "#aab",
        lineHeight: 1.4,
      }}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {discovering && (
        <div
          style={{
            margin: "2px 0 4px",
            padding: "2px 6px",
            background: "rgba(124,221,255,0.14)",
            border: "1px solid #7cd",
            borderRadius: 3,
            fontSize: 10,
            color: "#7cd",
            animation: "pulse 1.6s ease-in-out infinite",
          }}
        >
          Discovering accounts...
        </div>
      )}
      {persona?.first_name && (
        <div>
          {persona.first_name} {persona.last_name ?? ""}
          {persona.age ? ` · ${persona.age}` : ""}
          {persona.niche ? ` · ${persona.niche}` : ""}
          {persona.city ? ` · ${persona.city}` : ""}
        </div>
      )}
      {(themeKey || project?.name) && (
        <div style={{ color: "#7cd" }}>
          {themeKey ? `🎯 ${themeKey}` : ""}
          {themeKey && project?.name ? " · " : ""}
          {project?.name && !themeKey ? `🎯 ${project.name}` : project?.name ?? ""}
        </div>
      )}
      {accounts.length > 0 ? (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", margin: "2px 0" }}>
          {accounts.map((a) => {
            const isBanned = a.status === "banned" || a.plan_state === "banned";
            const isLinked = a.plan_state === "linked";
            const isOrphan = !a.plan_id;
            const isPlannedOrBound =
              a.plan_state === "planned" || a.plan_state === "bound";
            // Pill colors: linked=blue, planned/bound=yellow, banned=red, orphan=grey
            const pillStyle: CSSProperties = isBanned
              ? {
                  background: "rgba(239,68,68,0.18)",
                  color: "#fbb",
                  border: "1px solid #ef4444",
                  textDecoration: "line-through",
                }
              : isLinked
                ? {
                    background: "rgba(59,130,246,0.14)",
                    color: "#9cf",
                    border: "1px solid #3b82f6",
                  }
                : isPlannedOrBound
                  ? {
                      background: "rgba(251,191,36,0.14)",
                      color: "#fed",
                      border: "1px solid #fbbf24",
                    }
                  : isOrphan
                    ? {
                        background: "rgba(120,120,120,0.18)",
                        color: "#aab",
                        border: "1px solid #555",
                      }
                    : {
                        background: "rgba(34,197,94,0.12)",
                        color: "#9eb",
                        border: "1px solid transparent",
                      };
            return (
              <span
                key={a.account_id}
                title={isOrphan ? "no plan" : a.plan_state ?? ""}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "1px 5px",
                  borderRadius: 3,
                  fontSize: 10,
                  ...pillStyle,
                }}
              >
                {a.platform} @{a.username ?? "—"}
                {a.status ? ` · ${a.status}` : ""}
                {!isBanned && (
                  <button
                    type="button"
                    title={`Mark @${a.username ?? "?"} as banned`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!a.account_id) return;
                      const ok = window.confirm(
                        `Mark @${a.username ?? "?"} (${a.platform}) as banned?`,
                      );
                      if (!ok) return;
                      const reason =
                        window.prompt("Reason (optional):", "") ?? "";
                      try {
                        await markAccountBanned(a.account_id, reason);
                        await fetchFleet();
                      } catch (err) {
                        alert(`Mark banned failed: ${(err as Error).message}`);
                      }
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#f88",
                      cursor: "pointer",
                      fontSize: 10,
                      padding: 0,
                    }}
                  >
                    🚫
                  </button>
                )}
                {a.plan_id && !isBanned && (
                  <button
                    type="button"
                    title={`Detach @${a.username ?? "?"} from plan`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!a.plan_id) return;
                      onDetach(a.plan_id, a.username);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#7cd",
                      cursor: "pointer",
                      fontSize: 10,
                      padding: 0,
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            display: "inline-block",
            padding: "1px 5px",
            margin: "2px 0",
            background: "rgba(120,120,120,0.18)",
            borderRadius: 3,
            fontSize: 10,
            color: "#aab",
            fontStyle: "italic",
          }}
          title="Phone has no bound accounts. Bind a plan or run Discover."
        >
          no accounts
        </div>
      )}
      {last?.action && (
        <div style={{ fontStyle: "italic", color: "#889" }}>
          last: {last.action} · {tsAgo(last.ts)}
        </div>
      )}
      <div style={{ display: "flex", gap: 4, marginTop: 4, alignItems: "center" }}>
        {hasVha && (
          <div
            style={{
              display: "flex",
              border: "1px solid #334",
              borderRadius: 4,
              overflow: "hidden",
              opacity: noAccounts ? 0.5 : 1,
            }}
            title={noAccounts ? "Bind plan first" : ""}
          >
            {POLICIES.map((p) => (
              <button
                key={p}
                type="button"
                disabled={pending || (noAccounts && p !== "off")}
                onClick={() => onPolicy(p)}
                style={{
                  padding: "2px 6px",
                  fontSize: 10,
                  background: policy === p ? "#22c55e" : "transparent",
                  color: policy === p ? "#000" : "#aab",
                  border: "none",
                  cursor:
                    pending || (noAccounts && p !== "off")
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        {hasVha && (
          <button
            type="button"
            disabled={pending || noAccounts}
            onClick={onRun}
            title={noAccounts ? "No accounts on this phone" : "Run decision now"}
            style={{
              padding: "2px 8px",
              fontSize: 10,
              background: noAccounts ? "#374151" : "#1e40af",
              color: noAccounts ? "#889" : "#cdf",
              border: "none",
              borderRadius: 4,
              cursor: pending || noAccounts ? "not-allowed" : "pointer",
            }}
          >
            ▶ Run
          </button>
        )}
        <button
          type="button"
          disabled={rediscoverPending || discovering}
          onClick={onRediscover}
          title="Re-discover accounts on this phone"
          style={{
            padding: "2px 6px",
            fontSize: 10,
            background: "transparent",
            color: discovering ? "#fa3" : "#7cd",
            border: `1px solid ${discovering ? "#fa3" : "#244"}`,
            borderRadius: 4,
            cursor: rediscoverPending || discovering ? "wait" : "pointer",
          }}
        >
          {discovering ? "⏳" : "🔍"}
        </button>
        {hasLinkedPlans && (
          <button
            type="button"
            disabled={autofillPending}
            onClick={onAutofillPhone}
            title="LLM autofill missing persona fields for plans on this phone"
            style={{
              padding: "2px 6px",
              fontSize: 10,
              background: "transparent",
              color: "#fa3",
              border: "1px solid #422",
              borderRadius: 4,
              cursor: autofillPending ? "wait" : "pointer",
            }}
          >
            {autofillPending ? "⏳" : "🪄"}
          </button>
        )}
      </div>
    </div>
  );
}

function ProjectGroupHeader({
  projectId,
  name,
  niche,
  count,
  withAccountsCount,
}: {
  projectId: string;
  name: string;
  niche?: string | null;
  count: number;
  withAccountsCount: number;
}) {
  const runProjectAll = useVhaStore((s) => s.runProjectAll);
  const fetchFleet = useVhaStore((s) => s.fetchFleet);
  const [pending, setPending] = useState(false);

  const allEmpty = withAccountsCount === 0;
  const partial = withAccountsCount > 0 && withAccountsCount < count;

  const onClick = async () => {
    if (pending || allEmpty) return;
    if (
      !confirm(
        `Запустить decisions для всех ${withAccountsCount} VHA проекта "${name}"?`,
      )
    )
      return;
    setPending(true);
    try {
      const r = (await runProjectAll(projectId)) as { items?: unknown[]; total?: number };
      const total = r.total ?? r.items?.length ?? 0;
      alert(`Запущено ${total} decisions для "${name}"`);
      await fetchFleet();
    } catch (e) {
      alert(`Run-all failed: ${(e as Error).message}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 12px",
        background: "rgba(124,221,255,0.06)",
        borderLeft: "3px solid #7cd",
        margin: "10px 0 6px",
      }}
    >
      <strong style={{ color: "#7cd" }}>🎯 {name}</strong>
      {niche && <span style={{ fontSize: 11, color: "#889" }}>· {niche}</span>}
      <span style={{ fontSize: 11, color: "#aab" }}>
        · {count} VHA
        {partial && (
          <span style={{ color: "#fa3", marginLeft: 4 }}>
            ({withAccountsCount} with accounts)
          </span>
        )}
        {allEmpty && (
          <span style={{ color: "#f66", marginLeft: 4 }}>(no accounts)</span>
        )}
      </span>
      <div style={{ flex: 1 }} />
      {projectId !== "_no_project" && (
        <button
          type="button"
          disabled={pending || allEmpty}
          onClick={onClick}
          title={allEmpty ? "All phones in group have no accounts" : ""}
          style={{
            padding: "4px 10px",
            fontSize: 11,
            background: allEmpty ? "#374151" : "#1e40af",
            color: allEmpty ? "#889" : "#cdf",
            border: "none",
            borderRadius: 4,
            cursor: pending || allEmpty ? "not-allowed" : "pointer",
          }}
        >
          ▶ Publish all ({withAccountsCount}
          {partial ? ` / ${count}` : ""})
        </button>
      )}
    </div>
  );
}

export function HomePage() {
  const phones = useFarmStore((s) => s.phones);
  const fetchPhones = useFarmStore((s) => s.fetchPhones);
  const sessionsBySerial = useAutonomyStore((s) => s.sessionsBySerial);
  const fleetByPhoneId = useVhaStore((s) => s.fleetByPhoneId);
  const fetchFleet = useVhaStore((s) => s.fetchFleet);

  const [focused, setFocused] = useState<string | null>(null);

  useEffect(() => {
    fetchPhones();
    fetchFleet();
    const id = setInterval(() => {
      fetchPhones();
      fetchFleet();
    }, 60_000);
    return () => clearInterval(id);
  }, [fetchPhones, fetchFleet]);

  // Merge: enrich phones with VHA data
  const enriched: Phone[] = useMemo(
    () =>
      phones.map((p) => {
        const fleet = fleetByPhoneId[p.phone_id];
        if (!fleet) return p;
        return {
          ...p,
          vha: fleet.vha ?? p.vha,
          persona: fleet.persona ?? p.persona,
          project: fleet.project ?? p.project,
          vha_accounts: fleet.vha_accounts ?? p.vha_accounts ?? null,
          last_decision: fleet.last_decision ?? p.last_decision,
        };
      }),
    [phones, fleetByPhoneId],
  );

  // Group phones by project
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { projectId: string; name: string; niche?: string | null; phones: Phone[] }
    >();
    for (const p of enriched) {
      const pid = p.project?.project_id ?? "_no_project";
      const name = p.project?.name ?? "Без темы";
      const niche = p.project?.niche ?? null;
      if (!map.has(pid)) map.set(pid, { projectId: pid, name, niche, phones: [] });
      map.get(pid)!.phones.push(p);
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.projectId === "_no_project") return 1;
      if (b.projectId === "_no_project") return -1;
      return a.name.localeCompare(b.name);
    });
  }, [enriched]);

  const hasProjects = grouped.some((g) => g.projectId !== "_no_project");

  const renderCard = (phone: Phone) => {
    const serial = phone.serial || phone.phone_id;
    const displayName = phoneDisplayName(phone);
    const session = sessionsBySerial[serial]?.session;
    const noAccounts = phoneAccountCount(phone) === 0;
    const borderState = phoneCardBorderState(phone);
    const cardBorder = CARD_BORDER_STYLE[borderState];
    return (
      <button
        key={serial}
        type="button"
        className={styles.card}
        onClick={() => setFocused(serial)}
        style={{
          opacity: noAccounts ? 0.7 : 1,
          ...cardBorder,
        }}
      >
        {borderState === "banned" && (
          <div
            style={{
              position: "absolute",
              top: 4,
              right: 4,
              padding: "1px 5px",
              fontSize: 9,
              background: "#ef4444",
              color: "#fff",
              borderRadius: 3,
              fontWeight: 700,
              zIndex: 2,
            }}
          >
            ACCOUNTS BANNED
          </div>
        )}
        <PhoneStream serial={serial} className={styles.stream} />
        <div className={styles.cardFoot}>
          <span className={styles.serial}>{displayName}</span>
          <span
            className={`${styles.dot} ${
              phone.status === "active"
                ? styles.dotOn
                : phone.status === "paused"
                  ? styles.dotPause
                  : styles.dotOff
            }`}
          />
          {session && <span className={styles.state}>{session.state}</span>}
        </div>
        <VhaPanel phone={phone} />
      </button>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.body}>
        <section className={styles.left}>
          {hasProjects ? (
            <div>
              {grouped.map((g) => {
                const withAccounts = g.phones.filter(
                  (p) => phoneAccountCount(p) > 0,
                ).length;
                return (
                  <div key={g.projectId}>
                    <ProjectGroupHeader
                      projectId={g.projectId}
                      name={g.name}
                      niche={g.niche}
                      count={g.phones.length}
                      withAccountsCount={withAccounts}
                    />
                    <div className={styles.grid}>
                      {g.phones.map(renderCard)}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={styles.grid}>
              {enriched.map(renderCard)}
              {enriched.length === 0 && (
                <div className={styles.empty}>Нет подключённых телефонов</div>
              )}
            </div>
          )}
        </section>

        <aside className={styles.right}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tab} ${styles.tabActive}`}
            >
              Queue
            </button>
          </div>
          <div className={styles.tabBody}>
            <QueuePanel />
          </div>
        </aside>
      </div>

      {focused && (
        // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop
        // biome-ignore lint/a11y/noStaticElementInteractions: backdrop
        <div
          className={styles.focusOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) setFocused(null);
          }}
        >
          <div className={styles.focusBox}>
            <div className={styles.focusHead}>
              <span className={styles.focusSerial}>
                {phoneDisplayName(
                  enriched.find((phone) => (phone.serial || phone.phone_id) === focused) || {
                    phone_id: focused,
                  },
                )}
              </span>
              <button
                type="button"
                className={styles.focusClose}
                onClick={() => setFocused(null)}
              >
                ✕
              </button>
            </div>
            <PhoneStream serial={focused} className={styles.focusStream} />
          </div>
        </div>
      )}

    </div>
  );
}
