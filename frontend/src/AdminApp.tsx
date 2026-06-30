import {
  BadgeCheck,
  BarChart3,
  Coins,
  Gift,
  LayoutDashboard,
  LogOut,
  PackageCheck,
  Plus,
  ReceiptText,
  Search,
  ShieldAlert,
  UserCog,
  Users
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./lib/api";
import type {
  AdminCheckin,
  AdminPointTransaction,
  AdminRedemption,
  AdminReward,
  AdminRewardPayload,
  AdminSummary,
  AdminUser,
  RedemptionStatus,
  RewardStatus,
  User
} from "./lib/types";

const TOKEN_KEY = "reward_access_token";

type AdminTab = "overview" | "users" | "checkins" | "transactions" | "rewards" | "redemptions";

function AdminApp() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<User | null>(null);
  const [tab, setTab] = useState<AdminTab>("overview");
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [checkins, setCheckins] = useState<AdminCheckin[]>([]);
  const [transactions, setTransactions] = useState<AdminPointTransaction[]>([]);
  const [rewards, setRewards] = useState<AdminReward[]>([]);
  const [redemptions, setRedemptions] = useState<AdminRedemption[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(Boolean(token));
  const [message, setMessage] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "blocked">("login");
  const [pointUser, setPointUser] = useState<AdminUser | null>(null);
  const [rewardForm, setRewardForm] = useState<AdminReward | "new" | null>(null);

  const refreshAll = useCallback(async (activeToken = token) => {
    if (!activeToken) return;
    const [nextUser, nextSummary, nextUsers, nextCheckins, nextTransactions, nextRewards, nextRedemptions] =
      await Promise.all([
        api.me(activeToken),
        api.adminSummary(activeToken),
        api.adminUsers(activeToken, { q: query || undefined }),
        api.adminCheckins(activeToken),
        api.adminPointTransactions(activeToken),
        api.adminRewards(activeToken),
        api.adminRedemptions(activeToken, { status: statusFilter as RedemptionStatus || undefined })
      ]);
    setUser(nextUser);
    setSummary(nextSummary);
    setUsers(nextUsers.items);
    setCheckins(nextCheckins.items);
    setTransactions(nextTransactions.items);
    setRewards(nextRewards.items);
    setRedemptions(nextRedemptions.items);
    setAuthMode("login");
    setMessage("");
  }, [query, statusFilter, token]);

  useEffect(() => {
    let mounted = true;
    async function boot() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        await refreshAll(token);
      } catch (error) {
        if (!mounted) return;
        if (error instanceof ApiError && error.status === 403) {
          setAuthMode("blocked");
        } else {
          setMessage(readableError(error));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    boot();
    return () => {
      mounted = false;
    };
  }, [refreshAll, token]);

  async function handleLogin(form: FormData) {
    try {
      setMessage("");
      const response = await api.login({
        identifier: String(form.get("identifier") ?? "").trim(),
        password: String(form.get("password") ?? "")
      });
      localStorage.setItem(TOKEN_KEY, response.access_token);
      setToken(response.access_token);
      await refreshAll(response.access_token);
    } catch (error) {
      setMessage(readableError(error));
    }
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  async function updateUserStatus(item: AdminUser) {
    if (!token) return;
    const nextStatus = item.status === "active" ? "disabled" : "active";
    await runAction(async () => {
      await api.adminUpdateUser(token, item.id, nextStatus);
      await refreshAll(token);
    });
  }

  async function adjustPoints(userId: number, amount: number, reason: string) {
    if (!token) return;
    await runAction(async () => {
      await api.adminAdjustPoints(token, userId, { amount, reason });
      setPointUser(null);
      await refreshAll(token);
    });
  }

  async function saveReward(payload: AdminRewardPayload, rewardId?: number) {
    if (!token) return;
    await runAction(async () => {
      if (rewardId) {
        await api.adminUpdateReward(token, rewardId, payload);
      } else {
        await api.adminCreateReward(token, payload);
      }
      setRewardForm(null);
      await refreshAll(token);
    });
  }

  async function updateRedemption(item: AdminRedemption, status: RedemptionStatus) {
    if (!token) return;
    await runAction(async () => {
      await api.adminUpdateRedemption(token, item.id, status);
      await refreshAll(token);
    });
  }

  async function runAction(action: () => Promise<void>) {
    try {
      setMessage("");
      await action();
    } catch (error) {
      setMessage(readableError(error));
    }
  }

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return users;
    return users.filter((item) =>
      [item.username, item.phone, item.email, item.display_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword))
    );
  }, [query, users]);

  if (loading) {
    return <AdminShell><div className="admin-empty">正在载入管理工作台...</div></AdminShell>;
  }

  if (!token || !user) {
    return (
      <AdminShell>
        <AdminLogin message={message} onSubmit={handleLogin} />
      </AdminShell>
    );
  }

  if (authMode === "blocked") {
    return (
      <AdminShell>
        <div className="admin-blocked">
          <ShieldAlert />
          <h1>没有管理员权限</h1>
          <p>请使用 seed 创建的管理员账号 admin / admin123456 登录。</p>
          <button className="admin-primary" onClick={signOut}>重新登录</button>
        </div>
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <aside className="admin-sidebar">
        <div className="admin-brand">
          <BadgeCheck />
          <div>
            <strong>Reward Admin</strong>
            <span>学习运营工作台</span>
          </div>
        </div>
        <nav className="admin-nav">
          <AdminNavItem tab="overview" active={tab} setTab={setTab} icon={<LayoutDashboard />} label="概览" />
          <AdminNavItem tab="users" active={tab} setTab={setTab} icon={<Users />} label="用户管理" />
          <AdminNavItem tab="checkins" active={tab} setTab={setTab} icon={<BarChart3 />} label="打卡记录" />
          <AdminNavItem tab="transactions" active={tab} setTab={setTab} icon={<Coins />} label="积分流水" />
          <AdminNavItem tab="rewards" active={tab} setTab={setTab} icon={<Gift />} label="奖励管理" />
          <AdminNavItem tab="redemptions" active={tab} setTab={setTab} icon={<PackageCheck />} label="兑换处理" />
        </nav>
        <button className="admin-signout" onClick={signOut}><LogOut />退出登录</button>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <p>管理员</p>
            <h1>{titleForTab(tab)}</h1>
          </div>
          <div className="admin-user-chip">{user.display_name}</div>
        </header>
        {message && <div className="admin-message">{message}</div>}
        {tab === "overview" && <Overview summary={summary} redemptions={redemptions} />}
        {tab === "users" && (
          <UsersPanel
            users={filteredUsers}
            query={query}
            setQuery={setQuery}
            onToggleStatus={updateUserStatus}
            onAdjustPoints={setPointUser}
          />
        )}
        {tab === "checkins" && <CheckinsPanel checkins={checkins} />}
        {tab === "transactions" && <TransactionsPanel transactions={transactions} />}
        {tab === "rewards" && (
          <RewardsPanel rewards={rewards} onCreate={() => setRewardForm("new")} onEdit={setRewardForm} />
        )}
        {tab === "redemptions" && (
          <RedemptionsPanel
            redemptions={redemptions}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            onUpdate={updateRedemption}
          />
        )}
      </main>
      {pointUser && (
        <PointModal
          user={pointUser}
          onClose={() => setPointUser(null)}
          onSubmit={(amount, reason) => adjustPoints(pointUser.id, amount, reason)}
        />
      )}
      {rewardForm && (
        <RewardModal
          reward={rewardForm === "new" ? null : rewardForm}
          onClose={() => setRewardForm(null)}
          onSubmit={saveReward}
        />
      )}
    </AdminShell>
  );
}

function AdminShell({ children }: { children: React.ReactNode }) {
  return <div className="admin-shell">{children}</div>;
}

function AdminLogin({
  message,
  onSubmit
}: {
  message: string;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const [submitting, setSubmitting] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(new FormData(event.currentTarget));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <section className="admin-login">
      <div className="admin-login-copy">
        <p>Reward Admin</p>
        <h1>管理学习积分、奖励和兑换处理。</h1>
      </div>
      <form className="admin-login-card" onSubmit={submit}>
        <label>账号<input name="identifier" defaultValue="admin" required /></label>
        <label>密码<input name="password" type="password" defaultValue="admin123456" required /></label>
        {message && <div className="admin-message">{message}</div>}
        <button className="admin-primary" disabled={submitting}>{submitting ? "登录中..." : "进入管理端"}</button>
      </form>
    </section>
  );
}

function AdminNavItem({
  tab,
  active,
  setTab,
  icon,
  label
}: {
  tab: AdminTab;
  active: AdminTab;
  setTab: (tab: AdminTab) => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button className={active === tab ? "active" : ""} onClick={() => setTab(tab)}>
      {icon}<span>{label}</span>
    </button>
  );
}

function Overview({ summary, redemptions }: { summary: AdminSummary | null; redemptions: AdminRedemption[] }) {
  const cards = [
    ["用户总数", summary?.users_total ?? 0],
    ["活跃用户", summary?.active_users ?? 0],
    ["今日打卡", summary?.today_checkins ?? 0],
    ["发放积分", summary?.points_earned ?? 0],
    ["消耗积分", summary?.points_spent ?? 0],
    ["待处理兑换", summary?.pending_redemptions ?? 0]
  ];
  return (
    <section className="admin-content">
      <div className="admin-metrics">
        {cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong></article>)}
      </div>
      <section className="admin-panel">
        <div className="admin-panel-title"><h2>待处理兑换</h2><ReceiptText /></div>
        <AdminTable
          headers={["用户", "奖励", "积分", "状态", "时间"]}
          rows={redemptions.filter((item) => item.status === "created").slice(0, 8).map((item) => [
            item.user_display_name,
            item.reward_name,
            item.cost_points,
            statusTag(item.status),
            formatDate(item.created_at)
          ])}
        />
      </section>
    </section>
  );
}

function UsersPanel({
  users,
  query,
  setQuery,
  onToggleStatus,
  onAdjustPoints
}: {
  users: AdminUser[];
  query: string;
  setQuery: (query: string) => void;
  onToggleStatus: (user: AdminUser) => void;
  onAdjustPoints: (user: AdminUser) => void;
}) {
  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <label className="admin-search"><Search /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索用户" /></label>
      </div>
      <AdminTable
        headers={["ID", "昵称", "账号", "积分", "连续", "角色", "状态", "操作"]}
        rows={users.map((item) => [
          item.id,
          item.display_name,
          item.username ?? "-",
          item.current_points,
          item.streak_days,
          item.roles.join(", "),
          statusTag(item.status),
          <div className="admin-actions">
            <button onClick={() => onAdjustPoints(item)}>调分</button>
            <button onClick={() => onToggleStatus(item)}>{item.status === "active" ? "禁用" : "启用"}</button>
          </div>
        ])}
      />
    </section>
  );
}

function CheckinsPanel({ checkins }: { checkins: AdminCheckin[] }) {
  return (
    <section className="admin-panel">
      <AdminTable
        headers={["用户", "日期", "内容", "分数", "积分", "状态", "AI 评价"]}
        rows={checkins.map((item) => [
          item.user_display_name,
          item.checkin_date,
          truncate(item.content_text ?? "-"),
          item.total_score ?? "-",
          item.awarded_points,
          statusTag(item.status),
          truncate(item.ai_comment ?? "-")
        ])}
      />
    </section>
  );
}

function TransactionsPanel({ transactions }: { transactions: AdminPointTransaction[] }) {
  return (
    <section className="admin-panel">
      <AdminTable
        headers={["用户", "类型", "变动", "余额", "原因", "时间"]}
        rows={transactions.map((item) => [
          item.user_display_name,
          statusTag(item.type),
          item.amount > 0 ? `+${item.amount}` : item.amount,
          item.balance_after,
          item.reason,
          formatDate(item.created_at)
        ])}
      />
    </section>
  );
}

function RewardsPanel({
  rewards,
  onCreate,
  onEdit
}: {
  rewards: AdminReward[];
  onCreate: () => void;
  onEdit: (reward: AdminReward) => void;
}) {
  return (
    <section className="admin-panel">
      <div className="admin-toolbar"><button className="admin-primary compact" onClick={onCreate}><Plus />新增奖励</button></div>
      <AdminTable
        headers={["名称", "分类", "积分", "库存", "状态", "说明", "操作"]}
        rows={rewards.map((item) => [
          item.name,
          item.category,
          item.cost_points,
          item.stock ?? "不限",
          statusTag(item.status),
          truncate(item.description ?? "-"),
          <div className="admin-actions"><button onClick={() => onEdit(item)}>编辑</button></div>
        ])}
      />
    </section>
  );
}

function RedemptionsPanel({
  redemptions,
  statusFilter,
  setStatusFilter,
  onUpdate
}: {
  redemptions: AdminRedemption[];
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  onUpdate: (item: AdminRedemption, status: RedemptionStatus) => void;
}) {
  const visible = statusFilter ? redemptions.filter((item) => item.status === statusFilter) : redemptions;
  return (
    <section className="admin-panel">
      <div className="admin-toolbar">
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">全部状态</option>
          <option value="created">待处理</option>
          <option value="fulfilled">已完成</option>
          <option value="cancelled">已取消</option>
        </select>
      </div>
      <AdminTable
        headers={["用户", "奖励", "积分", "收件信息", "状态", "时间", "操作"]}
        rows={visible.map((item) => [
          item.user_display_name,
          item.reward_name,
          item.cost_points,
          [item.receiver_name, item.receiver_phone, item.receiver_address].filter(Boolean).join(" / ") || "-",
          statusTag(item.status),
          formatDate(item.created_at),
          item.status === "created" ? (
            <div className="admin-actions">
              <button onClick={() => onUpdate(item, "fulfilled")}>完成</button>
              <button onClick={() => onUpdate(item, "cancelled")}>取消退款</button>
            </div>
          ) : "-"
        ])}
      />
    </section>
  );
}

function PointModal({
  user,
  onClose,
  onSubmit
}: {
  user: AdminUser;
  onClose: () => void;
  onSubmit: (amount: number, reason: string) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit(Number(form.get("amount")), String(form.get("reason") ?? ""));
  }
  return (
    <Modal title={`调整积分：${user.display_name}`} onClose={onClose}>
      <form className="admin-form" onSubmit={submit}>
        <label>变动积分<input name="amount" type="number" placeholder="例如 100 或 -50" required /></label>
        <label>原因<input name="reason" maxLength={255} placeholder="运营补发积分" required /></label>
        <button className="admin-primary">保存调整</button>
      </form>
    </Modal>
  );
}

function RewardModal({
  reward,
  onClose,
  onSubmit
}: {
  reward: AdminReward | null;
  onClose: () => void;
  onSubmit: (payload: AdminRewardPayload, rewardId?: number) => void;
}) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const stockText = String(form.get("stock") ?? "").trim();
    onSubmit({
      name: String(form.get("name") ?? ""),
      category: String(form.get("category") ?? ""),
      description: String(form.get("description") ?? "") || null,
      image_url: String(form.get("image_url") ?? "") || null,
      cost_points: Number(form.get("cost_points")),
      stock: stockText === "" ? null : Number(stockText),
      status: String(form.get("status")) as RewardStatus
    }, reward?.id);
  }
  return (
    <Modal title={reward ? "编辑奖励" : "新增奖励"} onClose={onClose}>
      <form className="admin-form" onSubmit={submit}>
        <label>名称<input name="name" defaultValue={reward?.name} required /></label>
        <label>分类<input name="category" defaultValue={reward?.category ?? "文具"} required /></label>
        <label>说明<input name="description" defaultValue={reward?.description ?? ""} /></label>
        <label>图片 URL<input name="image_url" defaultValue={reward?.image_url ?? ""} /></label>
        <label>积分<input name="cost_points" type="number" min={0} defaultValue={reward?.cost_points ?? 100} required /></label>
        <label>库存<input name="stock" type="number" min={0} defaultValue={reward?.stock ?? ""} placeholder="留空表示不限" /></label>
        <label>状态<select name="status" defaultValue={reward?.status ?? "active"}><option value="active">active</option><option value="inactive">inactive</option></select></label>
        <button className="admin-primary">保存奖励</button>
      </form>
    </Modal>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="admin-modal-scrim" onClick={onClose}>
      <section className="admin-modal" onClick={(event) => event.stopPropagation()}>
        <div className="admin-modal-head"><h2>{title}</h2><button onClick={onClose}>关闭</button></div>
        {children}
      </section>
    </div>
  );
}

function AdminTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead>
        <tbody>
          {rows.length ? rows.map((row, index) => (
            <tr key={index}>{row.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          )) : <tr><td colSpan={headers.length} className="admin-empty">暂无数据</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function statusTag(value: string) {
  return <span className={`admin-tag tag-${value}`}>{value}</span>;
}

function titleForTab(tab: AdminTab): string {
  const titles: Record<AdminTab, string> = {
    overview: "运营概览",
    users: "用户管理",
    checkins: "打卡记录",
    transactions: "积分流水",
    rewards: "奖励管理",
    redemptions: "兑换处理"
  };
  return titles[tab];
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function truncate(value: string, length = 42): string {
  return value.length > length ? `${value.slice(0, length)}...` : value;
}

function readableError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 403) return "当前账号没有管理员权限。";
    if (error.status === 409) return "当前记录已经处理，不能重复操作。";
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "请求失败，请稍后再试";
}

export default AdminApp;
