import {
  Bell,
  BookOpen,
  Calendar,
  Camera,
  Check,
  ChevronRight,
  Flame,
  Gift,
  Home,
  Image,
  LogOut,
  Menu,
  Mic,
  Pencil,
  Plus,
  Send,
  Settings,
  Sparkles,
  Trophy,
  User,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api, ApiError } from "./lib/api";
import type {
  Checkin,
  CheckinCalendarItem,
  CheckinCalendarResponse,
  PointAccount,
  Redemption,
  Reward,
  RouteName,
  User as UserType
} from "./lib/types";

const TOKEN_KEY = "reward_access_token";

const today = new Date();
const currentYear = today.getFullYear();
const currentMonth = today.getMonth() + 1;
const todayIso = formatDateInput(today);

const artByCategory: Record<string, string> = {
  "文具": "stationery",
  "会员": "member",
  "课程": "course",
  "虚拟奖励": "virtual"
};

function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserType | null>(null);
  const [route, setRoute] = useState<RouteName>("home");
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [latestCheckin, setLatestCheckin] = useState<Checkin | null>(null);
  const [points, setPoints] = useState<PointAccount | null>(null);
  const [calendar, setCalendar] = useState<CheckinCalendarResponse | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [activeCategory, setActiveCategory] = useState("全部");
  const [selectedReward, setSelectedReward] = useState<Reward | null>(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [message, setMessage] = useState("");

  const signedIn = Boolean(token && user);

  const applySession = useCallback((nextToken: string, nextUser: UserType) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
    setUser(nextUser);
    setRoute("home");
    setMessage("");
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setCheckins([]);
    setLatestCheckin(null);
    setPoints(null);
    setCalendar(null);
    setRewards([]);
    setRedemptions([]);
    setRoute("home");
  }, []);

  const refreshUser = useCallback(async (activeToken = token) => {
    if (!activeToken) return;
    const nextUser = await api.me(activeToken);
    setUser(nextUser);
  }, [token]);

  const refreshDashboard = useCallback(async (activeToken = token) => {
    if (!activeToken) return;
    const [nextUser, nextPoints, nextCalendar, nextCheckins] = await Promise.all([
      api.me(activeToken),
      api.points(activeToken),
      api.calendar(activeToken, currentYear, currentMonth),
      api.listCheckins(activeToken)
    ]);
    setUser(nextUser);
    setPoints(nextPoints);
    setCalendar(nextCalendar);
    setCheckins(nextCheckins);
    setLatestCheckin(nextCheckins[0] ?? null);
  }, [token]);

  const refreshShop = useCallback(async (activeToken = token) => {
    if (!activeToken) return;
    const [nextRewards, nextRedemptions, nextPoints, nextUser] = await Promise.all([
      api.rewards(activeToken),
      api.redemptions(activeToken),
      api.points(activeToken),
      api.me(activeToken)
    ]);
    setRewards(nextRewards);
    setRedemptions(nextRedemptions);
    setPoints(nextPoints);
    setUser(nextUser);
  }, [token]);

  useEffect(() => {
    let mounted = true;
    async function restoreSession() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const nextUser = await api.me(token);
        if (!mounted) return;
        setUser(nextUser);
        await refreshDashboard(token);
      } catch {
        if (mounted) signOut();
      } finally {
        if (mounted) setLoading(false);
      }
    }
    restoreSession();
    return () => {
      mounted = false;
    };
  }, [refreshDashboard, signOut, token]);

  useEffect(() => {
    if (!signedIn || !token) return;
    if (route === "shop") {
      refreshShop(token).catch((error) => setMessage(readableError(error)));
      return;
    }
    refreshDashboard(token).catch((error) => setMessage(readableError(error)));
  }, [refreshDashboard, refreshShop, route, signedIn, token]);

  async function handleAuth(mode: "login" | "register", form: FormData) {
    try {
      setMessage("");
      const password = String(form.get("password") ?? "");
      if (mode === "login") {
        const identifier = String(form.get("identifier") ?? "").trim();
        const response = await api.login({ identifier, password });
        applySession(response.access_token, response.user);
        await refreshDashboard(response.access_token);
        return;
      }

      const username = String(form.get("username") ?? "").trim();
      const displayName = String(form.get("display_name") ?? "").trim();
      const response = await api.register({
        username,
        display_name: displayName,
        password
      });
      applySession(response.access_token, response.user);
      await refreshDashboard(response.access_token);
    } catch (error) {
      setMessage(readableError(error));
    }
  }

  async function handleSubmitCheckin(contentText: string, imageFile: File | null) {
    if (!token) return;
    try {
      setMessage("");
      const form = new FormData();
      form.set("checkin_date", todayIso);
      if (contentText.trim()) form.set("content_text", contentText.trim());
      if (imageFile) form.set("image", imageFile);
      const created = await api.createCheckin(token, form);
      setLatestCheckin(created);
      setRoute("result");
      await refreshDashboard(token);
    } catch (error) {
      setMessage(readableError(error));
    }
  }

  async function handleRedeem(reward: Reward) {
    if (!token || !reward.can_redeem) return;
    try {
      setMessage("");
      await api.redeem(token, reward.id);
      setSelectedReward(null);
      await refreshShop(token);
    } catch (error) {
      setMessage(readableError(error));
    }
  }

  if (loading) {
    return <Shell><div className="empty-copy">正在连接学习记录...</div></Shell>;
  }

  if (!signedIn || !user) {
    return (
      <Shell>
        <AuthPage onSubmit={handleAuth} message={message} />
      </Shell>
    );
  }

  const calendarRecords = Object.fromEntries((calendar?.days ?? []).map((item) => [item.day, item]));

  return (
    <Shell>
      {message && <div className="toast" role="status">{message}</div>}
      {route === "home" && (
        <HomePage
          user={user}
          points={points}
          latestCheckin={latestCheckin}
          setRoute={setRoute}
        />
      )}
      {route === "checkin" && (
        <CheckinPage
          latestCheckin={latestCheckin}
          onSubmit={handleSubmitCheckin}
          setRoute={setRoute}
          message={message}
        />
      )}
      {route === "result" && (
        <ResultPage
          checkin={latestCheckin}
          user={user}
          setRoute={setRoute}
        />
      )}
      {route === "calendar" && (
        <CalendarPage
          calendar={calendar}
          records={calendarRecords}
          selectedDay={selectedDay}
          setSelectedDay={setSelectedDay}
          user={user}
        />
      )}
      {route === "shop" && (
        <ShopPage
          user={user}
          rewards={rewards}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          setSelectedReward={setSelectedReward}
        />
      )}
      {route === "profile" && (
        <ProfilePage
          user={user}
          points={points}
          checkins={checkins}
          redemptions={redemptions}
          onSignOut={signOut}
          onRefresh={refreshUser}
        />
      )}
      {selectedReward && (
        <RedeemModal
          reward={selectedReward}
          user={user}
          onClose={() => setSelectedReward(null)}
          onConfirm={() => handleRedeem(selectedReward)}
        />
      )}
      {route !== "checkin" && <BottomNav route={route} setRoute={setRoute} />}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="device-frame">
      <main className="app-shell" aria-live="polite">{children}</main>
    </div>
  );
}

function AuthPage({
  onSubmit,
  message
}: {
  onSubmit: (mode: "login" | "register", form: FormData) => Promise<void>;
  message: string;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit(mode, new FormData(event.currentTarget));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page auth-page">
      <div className="auth-hero">
        <p className="eyebrow">AI 学习打卡</p>
        <h1>把今天学到的东西，变成明天的奖励。</h1>
      </div>
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-switch" role="tablist" aria-label="认证方式">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
          >
            注册
          </button>
        </div>
        {mode === "register" ? (
          <>
            <label>
              昵称
              <input name="display_name" minLength={1} maxLength={80} placeholder="林小然" required />
            </label>
            <label>
              用户名
              <input name="username" minLength={3} maxLength={64} placeholder="study_user" required />
            </label>
          </>
        ) : (
          <label>
            用户名
            <input name="identifier" placeholder="study_user" required />
          </label>
        )}
        <label>
          密码
          <input name="password" type="password" minLength={8} maxLength={128} placeholder="至少 8 位" required />
        </label>
        {message && <p className="form-message">{message}</p>}
        <button className="primary-btn" type="submit" disabled={submitting}>
          {submitting ? "正在处理..." : mode === "login" ? "进入学习记录" : "创建账户"}
        </button>
      </form>
    </section>
  );
}

function HomePage({
  user,
  points,
  latestCheckin,
  setRoute
}: {
  user: UserType;
  points: PointAccount | null;
  latestCheckin: Checkin | null;
  setRoute: (route: RouteName) => void;
}) {
  const completedToday = latestCheckin?.checkin_date === todayIso;
  const score = latestCheckin?.total_score ?? 0;
  const monthPoints = points?.transactions
    .filter((item) => item.type === "checkin_reward")
    .reduce((sum, item) => sum + item.amount, 0) ?? 0;

  return (
    <section className="page">
      <header className="home-hero">
        <div>
          <h1>早上好，<br />{user.display_name}</h1>
          <p className="date-pill">{formatReadableDate(today)}</p>
        </div>
        <button className="plain-icon" aria-label="通知"><Bell /></button>
      </header>
      <div className="section-row">
        <h2 className="section-title">学习计划</h2>
        <button className="plain-icon small" aria-label="设置"><Settings /></button>
      </div>
      <article className="plan-card">
        <div className="plan-media paper-preview" role="img" aria-label="学习成果示意图" />
        <div className="plan-copy">
          <p><strong>{user.display_name}</strong> 正在复盘</p>
          <h3>AI 学习打卡</h3>
          <div className="rule" />
          <p>上传今天的学习成果，收下成长分。</p>
        </div>
        <div className="plan-foot">
          <span><Calendar /> {formatMonthDay(today)}</span>
          <strong>{completedToday ? "已完成" : "待打卡"}</strong>
          <button className="chat-link" onClick={() => setRoute("checkin")} aria-label="进入打卡"><Send /></button>
        </div>
      </article>
      <article className="card task-card compact">
        <div className="task-layout">
          <div>
            <p className="eyebrow">今日学习小任务</p>
            <div className="goal">上传学习成果，收下今天的成长分</div>
            <div className="status-line">
              <span className="status-chip">最高 +100 积分</span>
              <span className="status-chip">{completedToday ? "已完成" : "待打卡"}</span>
            </div>
          </div>
          {completedToday && <EnergyRing value={score} label="能量" />}
        </div>
      </article>
      <h2 className="section-title">本周学习表现</h2>
      <div className="metrics-grid">
        <Metric label="最近得分" value={latestCheckin?.total_score?.toString() ?? "--"} />
        <Metric label="累计积分" value={String(user.current_points)} />
        <Metric label="连续打卡" value={String(user.streak_days)} />
      </div>
      <article className="card task-card compact history-card">
        <p className="eyebrow">积分流水</p>
        <h3>{monthPoints > 0 ? `最近收入 +${monthPoints}` : "还没有积分记录"}</h3>
        <p>{points?.transactions[0]?.reason ?? "完成一次打卡后，这里会出现你的积分变化。"}</p>
      </article>
    </section>
  );
}

function CheckinPage({
  latestCheckin,
  onSubmit,
  setRoute,
  message
}: {
  latestCheckin: Checkin | null;
  onSubmit: (contentText: string, imageFile: File | null) => Promise<void>;
  setRoute: (route: RouteName) => void;
  message: string;
}) {
  const [contentText, setContentText] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function chooseFile(file: File | undefined) {
    if (!file) return;
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function submit() {
    if (!contentText.trim() && !imageFile) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(contentText, imageFile);
      setContentText("");
      setImageFile(null);
      setPreview("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="page chat-page with-input">
      <header className="chat-top">
        <button className="round-tool" onClick={() => setRoute("home")} aria-label="返回首页"><Menu /></button>
        <button className="model-title" type="button">学习记录</button>
        <label className="round-tool accent" aria-label="添加学习成果">
          <Pencil />
          <input className="file-input" type="file" accept="image/*" onChange={(event) => chooseFile(event.target.files?.[0])} />
        </label>
      </header>
      <div className="chat-list">
        {!preview && !latestCheckin && (
          <div className="bubble-row">
            <div className="assistant-prose">发来今天的笔记、错题或一句复盘，我来给你评分。</div>
          </div>
        )}
        {preview && (
          <div className="bubble-row user">
            <div className="chat-bubble">
              <div className="upload-preview"><img src={preview} alt="上传的学习成果缩略图" /></div>
              <p style={{ margin: "8px 0 0" }}>这是今天的小成果，请帮我看看。</p>
            </div>
          </div>
        )}
        {latestCheckin && <div className="bubble-row"><div className="score-wrap"><ScoreCard checkin={latestCheckin} /></div></div>}
        {message && <p className="form-message">{message}</p>}
      </div>
      <div className="input-bar">
        <label className="composer-plus" aria-label="添加图片">
          <Plus />
          <input className="file-input" type="file" accept="image/*" onChange={(event) => chooseFile(event.target.files?.[0])} />
        </label>
        <input
          type="text"
          value={contentText}
          onChange={(event) => setContentText(event.target.value)}
          placeholder="记录今天的学习"
          aria-label="输入学习说明"
        />
        <label className="composer-mic" aria-label="拍照上传">
          <Camera />
          <input className="file-input" type="file" accept="image/*" capture="environment" onChange={(event) => chooseFile(event.target.files?.[0])} />
        </label>
        <button
          className="composer-send"
          onClick={submit}
          disabled={submitting || (!contentText.trim() && !imageFile)}
          aria-label="发送"
        >
          {submitting ? <Mic /> : <Send />}
        </button>
      </div>
    </section>
  );
}

function ResultPage({
  checkin,
  user,
  setRoute
}: {
  checkin: Checkin | null;
  user: UserType;
  setRoute: (route: RouteName) => void;
}) {
  return (
    <section className="page">
      <article className="card result-hero">
        <div className="celebrate-dots" />
        <div className="trophy-icon"><Trophy /></div>
        <p className="eyebrow">今日打卡完成</p>
        <h1>今天的小成果已收好</h1>
        <div className="result-score">
          <div>
            <strong>{checkin?.total_score ?? "--"}</strong>
            <span>+{checkin?.awarded_points ?? 0} 积分</span>
          </div>
        </div>
      </article>
      {checkin && (
        <article className="card result-detail">
          <h2>AI 评价摘要</h2>
          <p style={{ color: "var(--muted)" }}>{checkin.ai_comment}</p>
          <Dimensions dimensions={checkin.score_dimensions} />
          <p className="ai-note"><Check /> 已累计到你的账户，当前积分 {user.current_points}</p>
        </article>
      )}
      <div className="result-actions">
        <button className="secondary-btn" onClick={() => setRoute("calendar")}>查看学习日历</button>
        <button className="primary-btn" onClick={() => setRoute("shop")}>去商城兑换</button>
      </div>
    </section>
  );
}

function CalendarPage({
  calendar,
  records,
  selectedDay,
  setSelectedDay,
  user
}: {
  calendar: CheckinCalendarResponse | null;
  records: Record<number, CheckinCalendarItem>;
  selectedDay: number;
  setSelectedDay: (day: number) => void;
  user: UserType;
}) {
  const selected = records[selectedDay];
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const averageScore = average((calendar?.days ?? []).map((item) => item.total_score ?? 0));
  const monthPoints = (calendar?.days ?? []).reduce((sum, item) => sum + item.awarded_points, 0);

  return (
    <section className="page">
      <div className="title-row">
        <div>
          <p className="eyebrow">成长记录</p>
          <h1>{currentMonth} 月学习日历</h1>
        </div>
        <span className="pill mint">{user.streak_days} 天连续</span>
      </div>
      <div className="calendar-stats">
        <Metric label="本月积分" value={String(monthPoints)} />
        <Metric label="平均分" value={averageScore ? averageScore.toFixed(1) : "--"} />
        <Metric label="打卡天数" value={String(calendar?.days.length ?? 0)} />
      </div>
      <article className="card calendar-grid" aria-label={`${currentMonth} 月学习日历`}>
        {["一", "二", "三", "四", "五", "六", "日"].map((day) => <div className="week-label" key={day}>{day}</div>)}
        {Array.from({ length: daysInMonth }, (_, index) => {
          const day = index + 1;
          return (
            <CalendarCell
              key={day}
              day={day}
              record={records[day]}
              selected={selectedDay === day}
              onClick={() => setSelectedDay(day)}
            />
          );
        })}
      </article>
      <article className="card detail-sheet-inline">
        <div className="thumb-row">
          <div className="paper-preview thumb-mini" />
          <div>
            <p className="eyebrow">{currentMonth} 月 {selectedDay} 日详情</p>
            <h2 style={{ marginBottom: 4 }}>{selected ? `+${selected.awarded_points} 积分` : "未打卡"}</h2>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              {selected ? `综合评分 ${selected.total_score ?? "--"}，学习记录已入账。` : "完成一次学习记录后，这一天会亮起来。"}
            </p>
          </div>
        </div>
      </article>
      <h2 className="section-title energy-title">本月学习能量</h2>
      <article className="card energy-bars" aria-label="最近七次分数柱状图">
        {(calendar?.days ?? []).slice(-7).map((item) => (
          <div className="score-bar" aria-label={`${item.day} 日 ${item.total_score ?? 0} 分`} key={item.id}>
            <div className="bar-track">
              <span className="bar-fill" style={{ height: `${Math.max(item.total_score ?? 0, 22)}px` }} />
            </div>
            <strong>{item.total_score ?? "--"}</strong>
            <small>{item.day}</small>
          </div>
        ))}
      </article>
    </section>
  );
}

function ShopPage({
  user,
  rewards,
  activeCategory,
  setActiveCategory,
  setSelectedReward
}: {
  user: UserType;
  rewards: Reward[];
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  setSelectedReward: (reward: Reward) => void;
}) {
  const categories = useMemo(() => ["全部", ...Array.from(new Set(rewards.map((item) => item.category)))], [rewards]);
  const filtered = rewards.filter((item) => activeCategory === "全部" || item.category === activeCategory);

  return (
    <section className="page">
      <div className="title-row">
        <div>
          <p className="eyebrow">奖励中心</p>
          <h1>积分商城</h1>
        </div>
        <span className="pill">{user.current_points} 分</span>
      </div>
      <article className="card shop-balance">
        <p className="eyebrow" style={{ color: "rgba(255,255,255,.78)" }}>我的积分</p>
        <strong>{user.current_points}</strong>
        <span>攒下一点点努力，换一份小奖励。</span>
      </article>
      <div className="tab-scroll" role="tablist" aria-label="商品分类">
        {categories.map((category) => (
          <button
            className={`tab-btn ${activeCategory === category ? "active" : ""}`}
            key={category}
            onClick={() => setActiveCategory(category)}
            role="tab"
            aria-selected={activeCategory === category}
          >
            {category}
          </button>
        ))}
      </div>
      <div className="reward-grid">
        {filtered.map((reward) => (
          <button
            className="reward-card"
            key={reward.id}
            onClick={() => setSelectedReward(reward)}
            aria-label={`${reward.name}，需要 ${reward.cost_points} 积分`}
          >
            {reward.image_url ? (
              <img className="product-image" src={reward.image_url} alt={reward.name} />
            ) : (
              <div className={`product-art ${artByCategory[reward.category] ?? "stationery"}`} role="img" aria-label={`${reward.name} 商品图`} />
            )}
            <h3>{reward.name}</h3>
            <p className="reward-description">{reward.description}</p>
            <div className="product-meta">
              <span className="points">{reward.cost_points} 积分</span>
            </div>
            <span className={`stock ${reward.can_redeem ? "" : "locked"}`}>
              {reward.can_redeem ? "可兑换" : `还差 ${reward.points_shortfall}`}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function ProfilePage({
  user,
  points,
  checkins,
  redemptions,
  onSignOut,
  onRefresh
}: {
  user: UserType;
  points: PointAccount | null;
  checkins: Checkin[];
  redemptions: Redemption[];
  onSignOut: () => void;
  onRefresh: () => Promise<void>;
}) {
  return (
    <section className="page">
      <article className="card profile-hero">
        <div className="profile-row">
          <div className="profile-row" style={{ gap: 12 }}>
            <div className="avatar large" role="img" aria-label="用户头像" />
            <div>
              <p className="eyebrow">{levelName(user.current_points)}</p>
              <h1>{user.display_name}</h1>
            </div>
          </div>
          <span className="pill">{user.current_points} 分</span>
        </div>
        <div className="level-card">
          <div className="sheet-row">
            <strong>{levelName(user.current_points)}</strong>
            <span style={{ color: "var(--muted)", fontSize: 13 }}>连续 {user.streak_days} 天</span>
          </div>
          <div className="progress-track" style={{ marginTop: 10 }}>
            <div className="progress-fill" style={{ width: `${Math.min((user.current_points % 1000) / 10, 100)}%` }} />
          </div>
        </div>
      </article>
      <h2 className="section-title">徽章墙</h2>
      <div className="badge-grid">
        <Badge label="连续 7 天" icon={<Flame />} locked={user.streak_days < 7} />
        <Badge label="高分学霸" icon={<Sparkles />} locked={!checkins.some((item) => (item.total_score ?? 0) >= 90)} />
        <Badge label="月度坚持" icon={<Trophy />} locked={checkins.length < 10} />
        <Badge label="早起学习" icon={<BookOpen />} locked />
        <Badge label="商城达人" icon={<Gift />} locked={redemptions.length === 0} />
        <Badge label="复盘高手" icon={<Check />} locked={checkins.length < 3} />
      </div>
      <h2 className="section-title">账户</h2>
      <div className="entry-list">
        <Entry label={`兑换记录 ${redemptions.length}`} />
        <Entry label={`积分流水 ${points?.transactions.length ?? 0}`} />
        <button className="list-item" onClick={() => onRefresh()}><span>刷新资料</span><ChevronRight /></button>
        <button className="list-item danger-entry" onClick={onSignOut}><span>退出登录</span><LogOut /></button>
      </div>
    </section>
  );
}

function BottomNav({ route, setRoute }: { route: RouteName; setRoute: (route: RouteName) => void }) {
  const items: Array<[RouteName, string, React.ReactNode]> = [
    ["home", "首页", <Home />],
    ["calendar", "日历", <Calendar />],
    ["checkin", "打卡", <Plus />],
    ["shop", "商城", <Gift />],
    ["profile", "我的", <User />]
  ];

  return (
    <nav className="nav-bar" aria-label="底部导航">
      {items.map(([itemRoute, label, icon], index) => (
        <button
          className={`nav-item ${itemRoute === "checkin" ? "compose" : ""} ${route === itemRoute ? "active" : ""}`}
          key={itemRoute}
          onClick={() => setRoute(itemRoute)}
          aria-label={label}
        >
          <span className="nav-icon">{icon}</span>
          <span>{index === 2 ? "" : label}</span>
        </button>
      ))}
    </nav>
  );
}

function RedeemModal({
  reward,
  user,
  onClose,
  onConfirm
}: {
  reward: Reward;
  user: UserType;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <section className="redeem-sheet" role="dialog" aria-modal="true" aria-label="兑换确认" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-row">
          <h2 style={{ margin: 0 }}>兑换确认</h2>
          <button className="sheet-close" onClick={onClose} aria-label="关闭"><X /></button>
        </div>
        <div className="thumb-row" style={{ margin: "14px 0" }}>
          <div className={`product-art ${artByCategory[reward.category] ?? "stationery"} thumb-mini`} role="img" aria-label={`${reward.name} 商品图`} />
          <div>
            <h3>{reward.name}</h3>
            <p style={{ margin: 0, color: "var(--muted)" }}>
              消耗 {reward.cost_points} 积分，兑换后剩余 {user.current_points - reward.cost_points}
            </p>
          </div>
        </div>
        <button className="primary-btn" disabled={!reward.can_redeem} onClick={onConfirm}>
          {reward.can_redeem ? "确认兑换" : `积分不足，还差 ${reward.points_shortfall}`}
        </button>
      </section>
    </div>
  );
}

function ScoreCard({ checkin }: { checkin: Checkin }) {
  return (
    <article className="score-card">
      <div className="score-head">
        <div>
          <p className="eyebrow">今日综合评分</p>
          <div className="score-number">
            <strong>{checkin.total_score ?? "--"}</strong>
            <span>+{checkin.awarded_points}</span>
          </div>
        </div>
        <EnergyRing value={checkin.total_score ?? 0} label="评分" compact />
      </div>
      <Dimensions dimensions={checkin.score_dimensions} />
      <p className="ai-note"><strong>AI 评价：</strong>{checkin.ai_comment}</p>
      <p className="ai-note"><strong>明日建议：</strong>{checkin.ai_advice}</p>
    </article>
  );
}

function Dimensions({ dimensions }: { dimensions: Checkin["score_dimensions"] }) {
  return (
    <div className="dimension-list">
      {[...dimensions].sort((a, b) => a.sort_order - b.sort_order).map((dimension) => (
        <div key={dimension.id}>
          <div className="dim-head">
            <span>{dimension.dimension_name}</span>
            <span>{dimension.score} 分</span>
          </div>
          <div className="dim-track"><div className="dim-fill" style={{ width: `${dimension.score}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function CalendarCell({
  day,
  record,
  selected,
  onClick
}: {
  day: number;
  record?: CheckinCalendarItem;
  selected: boolean;
  onClick: () => void;
}) {
  const score = record?.total_score ?? 0;
  const scoreClass = record ? (score >= 88 ? "score-high" : score >= 80 ? "score-mid" : "score-low") : "";
  return (
    <button
      className={`calendar-cell ${scoreClass} ${selected ? "selected" : ""}`}
      onClick={onClick}
      aria-label={`${currentMonth} 月 ${day} 日${record ? `，${score} 分` : "，未打卡"}`}
    >
      {day}
      <small>{record ? `${score}分` : "未打卡"}</small>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong></article>;
}

function EnergyRing({ value, label, compact = false }: { value: number; label: string; compact?: boolean }) {
  return (
    <div className={`energy-ring ${compact ? "compact-ring" : ""}`} style={{ "--value": value } as React.CSSProperties}>
      <div><strong>{compact ? "AI" : value}</strong><span>{label}</span></div>
    </div>
  );
}

function Badge({ label, icon, locked = false }: { label: string; icon: React.ReactNode; locked?: boolean }) {
  return (
    <article className={`badge-card ${locked ? "locked" : ""}`}>
      <div className="badge-icon">{icon}</div>
      <strong>{label}</strong>
      <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: 12 }}>{locked ? "待解锁" : "已获得"}</p>
    </article>
  );
}

function Entry({ label }: { label: string }) {
  return <button className="list-item"><span>{label}</span><ChevronRight /></button>;
}

function readableError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) return "登录已过期，请重新登录。";
    if (error.status === 409) return "今天已经打过卡了，明天再继续。";
    if (error.status === 422) return "请补充学习文字或上传图片。";
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "请求失败，请稍后再试";
}

function formatDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatReadableDate(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    weekday: "short",
    month: "short",
    day: "numeric"
  }).format(date);
}

function formatMonthDay(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "short",
    day: "numeric"
  }).format(date);
}

function average(values: number[]): number {
  const filtered = values.filter((value) => value > 0);
  if (!filtered.length) return 0;
  return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
}

function levelName(points: number): string {
  if (points >= 3000) return "Lv.6 复盘高手";
  if (points >= 1500) return "Lv.5 坚持达人";
  if (points >= 800) return "Lv.4 学习能量";
  if (points >= 300) return "Lv.3 稳定进步";
  return "Lv.2 起步认真";
}

export default App;
