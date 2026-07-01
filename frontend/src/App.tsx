import {
  Bell,
  BookOpen,
  Calendar,
  Camera,
  ChevronLeft,
  Check,
  ChevronRight,
  Flame,
  Gift,
  Home,
  Image,
  LogOut,
  MoreVertical,
  Plus,
  Send,
  Settings,
  Sparkles,
  Trophy,
  User,
  X
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import dogecoinIcon from "./assets/dogecoin.png";
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
const THEME_KEY = "reward_theme";
const SAVINGS_GOAL_KEY = "reward_savings_goal_v2";

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

interface SavingsGoal {
  name: string;
  target: number;
  imageUrl: string;
}

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
  const [savingsGoal, setSavingsGoal] = useState<SavingsGoal | null>(() => readSavingsGoal());
  const [loading, setLoading] = useState(Boolean(token));
  const [message, setMessage] = useState("");
  const [theme, setTheme] = useState<"paper" | "focus">(() => {
    const savedTheme = localStorage.getItem(THEME_KEY);
    return savedTheme === "focus" ? "focus" : "paper";
  });

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

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    if (savingsGoal) {
      localStorage.setItem(SAVINGS_GOAL_KEY, JSON.stringify(savingsGoal));
      return;
    }
    localStorage.removeItem(SAVINGS_GOAL_KEY);
  }, [savingsGoal]);

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

  async function handleSubmitCheckin(
    contentText: string,
    imageFile: File | null,
    details?: {
      studyTimeMinutes: number;
      questionCount: number;
      noteImageFile: File | null;
      exerciseImageFile: File | null;
    }
  ) {
    if (!token) return;
    try {
      setMessage("");
      const form = new FormData();
      form.set("checkin_date", todayIso);
      if (contentText.trim()) form.set("content_text", contentText.trim());
      if (imageFile) form.set("image", imageFile);
      if (details) {
        form.set("study_time_minutes", String(details.studyTimeMinutes));
        form.set("question_count", String(details.questionCount));
        if (details.noteImageFile) form.set("note_image", details.noteImageFile);
        if (details.exerciseImageFile) form.set("exercise_image", details.exerciseImageFile);
      }
      const created = await api.createCheckin(token, form);
      setLatestCheckin(created);
      setRoute("checkin");
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

  async function handleUpdateProfile(form: FormData) {
    if (!token) return;
    try {
      setMessage("");
      const nextUser = await api.updateMe(token, form);
      setUser(nextUser);
    } catch (error) {
      setMessage(readableError(error));
      throw error;
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
    <Shell theme={theme}>
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
      {route === "shopGoal" && (
        <SavingsGoalPage
          user={user}
          goal={savingsGoal}
          setGoal={setSavingsGoal}
          setRoute={setRoute}
        />
      )}
      {route === "shop" && (
        <ShopPage
          user={user}
          rewards={rewards}
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          setSelectedReward={setSelectedReward}
          setRoute={setRoute}
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
          onUpdateProfile={handleUpdateProfile}
          theme={theme}
          setTheme={setTheme}
          setRoute={setRoute}
        />
      )}
      {route === "badges" && (
        <BadgeDetailPage
          user={user}
          checkins={checkins}
          redemptions={redemptions}
          setRoute={setRoute}
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

function Shell({ children, theme = "paper" }: { children: React.ReactNode; theme?: "paper" | "focus" }) {
  return (
    <div className={`device-frame theme-${theme}`}>
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
              <span className="status-chip">最高 <DogecoinAmount value="+100" compact /></span>
              <span className="status-chip">{completedToday ? "已完成" : "待打卡"}</span>
            </div>
          </div>
          {completedToday && <EnergyRing value={score} label="能量" />}
        </div>
      </article>
      <h2 className="section-title">本周学习表现</h2>
      <div className="metrics-grid">
        <Metric label="最近得分" value={latestCheckin?.total_score?.toString() ?? "--"} />
        <Metric label="累计狗狗币" value={String(user.current_points)} />
        <Metric label="连续打卡" value={String(user.streak_days)} />
      </div>
      <article className="card task-card compact history-card">
        <p className="eyebrow">狗狗币流水</p>
        <h3>{monthPoints > 0 ? <DogecoinAmount value={`+${monthPoints}`} /> : "还没有狗狗币记录"}</h3>
        <p>{points?.transactions[0]?.reason.replaceAll("积分", "狗狗币") ?? "完成一次打卡后，这里会出现你的狗狗币变化。"}</p>
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
  onSubmit: (
    contentText: string,
    imageFile: File | null,
    details?: {
      studyTimeMinutes: number;
      questionCount: number;
      noteImageFile: File | null;
      exerciseImageFile: File | null;
    }
  ) => Promise<void>;
  setRoute: (route: RouteName) => void;
  message: string;
}) {
  const completedToday = latestCheckin?.checkin_date === todayIso;
  const [studyHours, setStudyHours] = useState(2);
  const [questionCount, setQuestionCount] = useState("");
  const [aiEnabled, setAiEnabled] = useState(true);
  const [noteImageFile, setNoteImageFile] = useState<File | null>(null);
  const [exerciseImageFile, setExerciseImageFile] = useState<File | null>(null);
  const [notePreview, setNotePreview] = useState("");
  const [exercisePreview, setExercisePreview] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function chooseFile(file: File | undefined, kind: "note" | "exercise") {
    if (!file) return;
    const nextPreview = URL.createObjectURL(file);
    if (kind === "note") {
      setNoteImageFile(file);
      setNotePreview(nextPreview);
      return;
    }
    setExerciseImageFile(file);
    setExercisePreview(nextPreview);
  }

  async function submit() {
    const content = [
      `学习时长：${studyHours} 小时`,
      questionCount.trim() ? `做题总数：${questionCount.trim()}` : "",
      aiEnabled ? "AI 判题：开启" : "AI 判题：关闭"
    ].filter(Boolean).join("\n");
    const imageFile = exerciseImageFile ?? noteImageFile;
    if (!content.trim() && !imageFile) {
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(content, imageFile, {
        studyTimeMinutes: studyHours * 60,
        questionCount: Number(questionCount.trim() || 0),
        noteImageFile,
        exerciseImageFile
      });
      setQuestionCount("");
      setNoteImageFile(null);
      setExerciseImageFile(null);
      setNotePreview("");
      setExercisePreview("");
    } finally {
      setSubmitting(false);
    }
  }

  if (completedToday && latestCheckin) {
    if (latestCheckin.status === "analyzing" || latestCheckin.total_score == null) {
      return <AnalyzingCheckinPage setRoute={setRoute} />;
    }

    return (
      <section className="learning-record-page learning-result-page">
        <LearningTopBar title="今日总结" onBack={() => setRoute("home")} />
        <ScoreCard checkin={latestCheckin} />
      </section>
    );
  }

  if (submitting) {
    return <AnalyzingCheckinPage setRoute={setRoute} />;
  }

  return (
    <section className="learning-record-page">
      <LearningTopBar title="学习记录" onBack={() => setRoute("home")} />
      <article className="learning-card time-card">
        <div className="learning-section-title">
          <span className="learning-section-icon"><ClockGlyph /></span>
          <h2>学习时长</h2>
        </div>
        <div className="time-slider-wrap">
          <input
            className="time-slider"
            type="range"
            min={0}
            max={4}
            step={1}
            value={studyHours}
            onChange={(event) => setStudyHours(Number(event.target.value))}
            aria-label="学习时长"
          />
          <div className="time-labels" aria-hidden="true">
            <span>0h</span>
            <span>1h</span>
            <span>2h</span>
            <span>3h</span>
            <span>4h+</span>
          </div>
        </div>
      </article>

      <article className="learning-card">
        <div className="learning-section-title">
          <span className="learning-section-icon"><NoteGlyph /></span>
          <h2>学习笔记</h2>
        </div>
        <label className={`learning-upload ${notePreview ? "has-preview" : ""}`}>
          {notePreview ? (
            <img src={notePreview} alt="学习笔记预览" />
          ) : (
            <>
              <CameraPlusGlyph />
              <span>添加学习图片</span>
            </>
          )}
          <input className="file-input" type="file" accept="image/*" onChange={(event) => chooseFile(event.target.files?.[0], "note")} />
        </label>
      </article>

      <article className="learning-card">
        <div className="learning-section-title">
          <span className="learning-section-icon"><QuestionGlyph /></span>
          <h2>做题记录</h2>
        </div>
        <div className="ai-toggle-row">
          <span>AI 判题</span>
          <button
            className={`ai-switch ${aiEnabled ? "active" : ""}`}
            onClick={() => setAiEnabled((value) => !value)}
            type="button"
            role="switch"
            aria-checked={aiEnabled}
            aria-label="AI 判题"
          />
        </div>
        <label className="question-field">
          做题总数
          <input
            value={questionCount}
            onChange={(event) => setQuestionCount(event.target.value)}
            inputMode="numeric"
            placeholder="输入题目数量"
          />
        </label>
        <div className="ai-status-panel">
          <span>AI</span>
          <div>
            <strong>智能判题已开启</strong>
            <p>提交后将自动为您计算正确率及解析</p>
          </div>
        </div>
        <label className={`learning-upload exercise-upload ${exercisePreview ? "has-preview" : ""}`}>
          {exercisePreview ? (
            <img src={exercisePreview} alt="题目照片预览" />
          ) : (
            <>
              <CameraPlusGlyph />
              <span>上传题目照片</span>
            </>
          )}
          <input className="file-input" type="file" accept="image/*" capture="environment" onChange={(event) => chooseFile(event.target.files?.[0], "exercise")} />
        </label>
      </article>

      {message && <p className="form-message">{message}</p>}
      <div className="learning-submit-wrap">
        <button className="primary-btn" onClick={submit} disabled={submitting || (!questionCount.trim() && !noteImageFile && !exerciseImageFile)}>
          {submitting ? "正在提交..." : "提交学习记录"}
        </button>
      </div>
    </section>
  );
}

function LearningTopBar({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="learning-topbar">
      <button className="learning-icon-btn" onClick={onBack} aria-label="返回首页"><ChevronLeft /></button>
      <h1>{title}</h1>
      <button className="learning-icon-btn" type="button" aria-label="更多"><MoreVertical /></button>
    </header>
  );
}

function AnalyzingCheckinPage({ setRoute }: { setRoute: (route: RouteName) => void }) {
  return (
    <section className="learning-record-page analyzing-page">
      <LearningTopBar title="评分中" onBack={() => setRoute("home")} />
      <div className="analyzing-stage" role="status">
        <div className="analysis-orbit" aria-hidden="true">
          <span className="orbit orbit-outer" />
          <span className="orbit orbit-middle" />
          <span className="orbit orbit-dashed" />
          <span className="analysis-mascot">
            <img src={dogecoinIcon} alt="" />
          </span>
        </div>
        <h2>正在分析您的学习记录...</h2>
        <p>这通常需要几秒钟。</p>
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
            <span><DogecoinAmount value={`+${checkin?.awarded_points ?? 0}`} /></span>
          </div>
        </div>
      </article>
      {checkin && (
        <article className="card result-detail">
          <h2>AI 评价摘要</h2>
          <p style={{ color: "var(--muted)" }}>{checkin.ai_comment}</p>
          <Dimensions dimensions={checkin.score_dimensions} />
          <p className="ai-note"><Check /> 已累计到你的账户，当前狗狗币 <DogecoinAmount value={user.current_points} /></p>
        </article>
      )}
      <div className="result-actions">
        <button className="secondary-btn" onClick={() => setRoute("calendar")}>查看学习日历</button>
        <button className="primary-btn" onClick={() => setRoute("shopGoal")}>去存钱罐</button>
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
        <Metric label="本月狗狗币" value={String(monthPoints)} />
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
            <h2 style={{ marginBottom: 4 }}>{selected ? <DogecoinAmount value={`+${selected.awarded_points}`} /> : "未打卡"}</h2>
            {!selected && (
              <p style={{ margin: 0, color: "var(--muted)" }}>完成一次学习记录后，这一天会亮起来。</p>
            )}
          </div>
        </div>
      </article>
      <h2 className="section-title energy-title">本周学习能量</h2>
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

function SavingsGoalPage({
  user,
  goal,
  setGoal,
  setRoute
}: {
  user: UserType;
  goal: SavingsGoal | null;
  setGoal: (goal: SavingsGoal | null) => void;
  setRoute: (route: RouteName) => void;
}) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [draftName, setDraftName] = useState(goal?.name ?? "");
  const [draftTarget, setDraftTarget] = useState(goal ? String(goal.target) : "");
  const [draftImage, setDraftImage] = useState(goal?.imageUrl ?? "");
  const progress = goal ? Math.min(user.current_points / goal.target, 1) : 0;
  const percent = Math.round(progress * 100);
  const remaining = goal ? Math.max(goal.target - user.current_points, 0) : 0;
  const achieved = Boolean(goal && remaining === 0);

  function openEditor() {
    setDraftName(goal?.name ?? "");
    setDraftTarget(goal ? String(goal.target) : "");
    setDraftImage(goal?.imageUrl ?? "");
    setEditorOpen(true);
  }

  function chooseGoalImage(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") setDraftImage(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextName = draftName.trim();
    const nextTarget = Math.max(1, Math.round(Number(draftTarget) || 0));
    if (!nextName || !nextTarget) return;
    setGoal({
      name: nextName,
      target: nextTarget,
      imageUrl: draftImage
    });
    setEditorOpen(false);
  }

  return (
    <section className="page savings-page">
      <div className="title-row">
        <div>
          <p className="eyebrow">奖励中心</p>
          <h1>目标商城</h1>
        </div>
        <span className="pill savings-balance-pill"><DogecoinAmount value={user.current_points} hideLabel /></span>
      </div>
      {goal ? (
        <article className={`goal-card ${achieved ? "complete" : ""}`} aria-label={`${goal.name} 目标进度 ${percent}%`}>
          <div className={`goal-image ${goal.imageUrl ? "has-image" : ""}`}>
            {goal.imageUrl ? (
              <img src={goal.imageUrl} alt={goal.name} />
            ) : (
              <button type="button" onClick={openEditor} aria-label="添加目标图片">
                <Image />
              </button>
            )}
          </div>
          <div className="goal-card-copy">
            <div className="sheet-row">
              <p className="eyebrow">{achieved ? "目标达成" : "正在存"}</p>
              <button className="goal-edit-btn" onClick={openEditor}>编辑</button>
            </div>
            <h2>{goal.name}</h2>
            <div className="goal-progress-row">
              <strong>{percent}%</strong>
              <span>{achieved ? "已经存满啦" : `还差 ${remaining} 狗狗币`}</span>
            </div>
            <div className="progress-track savings-track">
              <div className="progress-fill" style={{ width: `${percent}%` }} />
            </div>
            <div className="goal-total">
              <DogecoinAmount value={user.current_points} hideLabel />
              <span>/</span>
              <span className="goal-target-value">{goal.target}</span>
            </div>
          </div>
        </article>
      ) : (
        <button className="empty-goal" onClick={openEditor}>
          <span><Plus /></span>
          <strong>设置一个目标</strong>
        </button>
      )}
      <button className="shop-entry-card" onClick={() => setRoute("shop")}>
        <span className="shop-entry-icon"><PawIcon /></span>
        <span>
          <strong>狗狗币商城</strong>
          <small>查看可以兑换的奖励</small>
        </span>
        <ChevronRight />
      </button>
      {editorOpen && (
        <div className="modal-scrim" onClick={() => setEditorOpen(false)} role="presentation">
          <form className="goal-form goal-sheet" onSubmit={saveGoal} role="dialog" aria-modal="true" aria-label="设置目标" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-row">
              <h2 style={{ margin: 0 }}>设置目标</h2>
              <button className="sheet-close" type="button" onClick={() => setEditorOpen(false)} aria-label="关闭"><X /></button>
            </div>
            <label className="goal-image-picker">
              <span className={draftImage ? "has-preview" : ""}>
                {draftImage ? <img src={draftImage} alt="" /> : <Image />}
              </span>
              上传目标图片
              <input className="file-input" type="file" accept="image/*" onChange={(event) => chooseGoalImage(event.target.files?.[0])} />
            </label>
            <label>
              想买什么
              <input value={draftName} onChange={(event) => setDraftName(event.target.value)} maxLength={30} autoFocus />
            </label>
            <label>
              需要多少狗狗币
              <input
                value={draftTarget}
                onChange={(event) => setDraftTarget(event.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </label>
            <button className="primary-btn" type="submit" disabled={!draftName.trim() || !Number(draftTarget)}>保存目标</button>
          </form>
        </div>
      )}
    </section>
  );
}

function ShopPage({
  user,
  rewards,
  activeCategory,
  setActiveCategory,
  setSelectedReward,
  setRoute
}: {
  user: UserType;
  rewards: Reward[];
  activeCategory: string;
  setActiveCategory: (category: string) => void;
  setSelectedReward: (reward: Reward) => void;
  setRoute: (route: RouteName) => void;
}) {
  const categories = useMemo(() => ["全部", ...Array.from(new Set(rewards.map((item) => item.category)))], [rewards]);
  const filtered = rewards.filter((item) => activeCategory === "全部" || item.category === activeCategory);

  return (
    <section className="page">
      <div className="title-row">
        <button className="round-tool compact-back" onClick={() => setRoute("shopGoal")} aria-label="返回存钱罐"><ChevronLeft /></button>
        <div>
          <p className="eyebrow">奖励中心</p>
          <h1>狗狗币商城</h1>
        </div>
        <span className="pill"><DogecoinAmount value={user.current_points} /></span>
      </div>
      <article className="card shop-balance">
        <p className="eyebrow" style={{ color: "rgba(255,255,255,.78)" }}>我的狗狗币</p>
        <strong><DogecoinAmount value={user.current_points} /></strong>
        <span>攒下一枚枚狗狗币，换一份小奖励。</span>
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
            aria-label={`${reward.name}，需要 ${reward.cost_points} 狗狗币`}
          >
            {reward.image_url ? (
              <img className="product-image" src={reward.image_url} alt={reward.name} />
            ) : (
              <div className={`product-art ${artByCategory[reward.category] ?? "stationery"}`} role="img" aria-label={`${reward.name} 商品图`} />
            )}
            <h3>{reward.name}</h3>
            <p className="reward-description">{reward.description}</p>
            <div className="product-meta">
              <span className="points"><DogecoinAmount value={reward.cost_points} hideLabel /></span>
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
  onRefresh,
  onUpdateProfile,
  theme,
  setTheme,
  setRoute
}: {
  user: UserType;
  points: PointAccount | null;
  checkins: Checkin[];
  redemptions: Redemption[];
  onSignOut: () => void;
  onRefresh: () => Promise<void>;
  onUpdateProfile: (form: FormData) => Promise<void>;
  theme: "paper" | "focus";
  setTheme: (theme: "paper" | "focus") => void;
  setRoute: (route: RouteName) => void;
}) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const badgeItems = getBadgeItems(user, checkins, redemptions);

  return (
    <section className="page">
      <article className="card profile-hero">
        <button className="profile-settings" onClick={() => setSettingsOpen(true)} aria-label="打开基础设置">
          <Settings />
        </button>
        <div className="profile-row">
          <div className="profile-row" style={{ gap: 12 }}>
            <Avatar user={user} large />
            <div>
              <p className="eyebrow">{levelName(user.current_points)}</p>
              <h1>{user.display_name}</h1>
            </div>
          </div>
          <span className="point-ticket"><DogecoinAmount value={user.current_points} /></span>
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
      <button className="section-link profile-section-title" onClick={() => setRoute("badges")}>
        <h2>徽章墙</h2>
        <ChevronRight />
      </button>
      <div className="badge-grid">
        {badgeItems.map((badge) => (
          <Badge key={badge.label} label={badge.label} icon={badge.icon} locked={badge.locked} />
        ))}
      </div>
      <h2 className="section-title profile-section-title account-title">账户</h2>
      <div className="entry-list">
        <Entry label={`兑换记录 ${redemptions.length}`} />
        <Entry label={`狗狗币流水 ${points?.transactions.length ?? 0}`} />
        <button className="list-item" onClick={() => onRefresh()}><span>刷新资料</span><ChevronRight /></button>
        <button className="list-item danger-entry" onClick={onSignOut}><span>退出登录</span><LogOut /></button>
      </div>
      {settingsOpen && (
        <SettingsSheet
          user={user}
          theme={theme}
          setTheme={setTheme}
          onClose={() => setSettingsOpen(false)}
          onSubmit={onUpdateProfile}
        />
      )}
    </section>
  );
}

function Avatar({ user, large = false }: { user: UserType; large?: boolean }) {
  return (
    <div className={`avatar ${large ? "large" : ""}`} role="img" aria-label="用户头像">
      {user.avatar_url && <img src={user.avatar_url} alt="" />}
    </div>
  );
}

function SettingsSheet({
  user,
  theme,
  setTheme,
  onClose,
  onSubmit
}: {
  user: UserType;
  theme: "paper" | "focus";
  setTheme: (theme: "paper" | "focus") => void;
  onClose: () => void;
  onSubmit: (form: FormData) => Promise<void>;
}) {
  const [displayName, setDisplayName] = useState(user.display_name);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [preview, setPreview] = useState(user.avatar_url ?? "");
  const [saving, setSaving] = useState(false);

  function chooseAvatar(file: File | undefined) {
    if (!file) return;
    setAvatarFile(file);
    setPreview(URL.createObjectURL(file));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData();
    form.set("display_name", displayName.trim());
    if (avatarFile) form.set("avatar", avatarFile);
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-scrim" onClick={onClose} role="presentation">
      <section className="settings-sheet" role="dialog" aria-modal="true" aria-label="基础设置" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-row">
          <h2 style={{ margin: 0 }}>基础设置</h2>
          <button className="sheet-close" onClick={onClose} aria-label="关闭"><X /></button>
        </div>
        <form className="settings-form" onSubmit={submit}>
          <div className="avatar-editor">
            <div className="avatar large" role="img" aria-label="头像预览">
              {preview && <img src={preview} alt="" />}
            </div>
            <label className="avatar-upload">
              上传头像
              <input className="file-input" type="file" accept="image/*" onChange={(event) => chooseAvatar(event.target.files?.[0])} />
            </label>
          </div>
          <label className="settings-field">
            昵称
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} maxLength={80} required />
          </label>
          <div className="settings-field">
            <span>主题</span>
            <div className="theme-options" role="group" aria-label="主题切换">
              <button type="button" className={theme === "paper" ? "active" : ""} onClick={() => setTheme("paper")}>纸张</button>
              <button type="button" className={theme === "focus" ? "active" : ""} onClick={() => setTheme("focus")}>专注</button>
            </div>
          </div>
          <button className="primary-btn" disabled={saving || !displayName.trim()}>{saving ? "保存中..." : "保存设置"}</button>
        </form>
      </section>
    </div>
  );
}

function BadgeDetailPage({
  user,
  checkins,
  redemptions,
  setRoute
}: {
  user: UserType;
  checkins: Checkin[];
  redemptions: Redemption[];
  setRoute: (route: RouteName) => void;
}) {
  const badgeItems = getBadgeItems(user, checkins, redemptions);
  const unlockedCount = badgeItems.filter((item) => !item.locked).length;

  return (
    <section className="page badge-detail-page">
      <header className="detail-top">
        <button className="round-tool" onClick={() => setRoute("profile")} aria-label="返回我的"><ChevronLeft /></button>
        <div>
          <p className="eyebrow">成长收藏</p>
          <h1>徽章墙</h1>
        </div>
        <span className="detail-ticket"><strong>{unlockedCount}</strong><small>/ {badgeItems.length}</small></span>
      </header>
      <article className="badge-summary card">
        <strong>{unlockedCount ? "继续把学习变成收藏" : "第一枚徽章正在路上"}</strong>
        <p>完成打卡、兑换奖励和保持连续学习后，徽章会自动点亮。</p>
      </article>
      <div className="badge-detail-grid">
        {badgeItems.map((badge) => (
          <article className={`badge-detail-card ${badge.locked ? "locked" : ""}`} key={badge.label}>
            <div className="badge-icon">{badge.icon}</div>
            <div>
              <h2>{badge.label}</h2>
              <p>{badge.description}</p>
              <span>{badge.locked ? "待解锁" : "已获得"}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function getBadgeItems(user: UserType, checkins: Checkin[], redemptions: Redemption[]) {
  return [
    {
      label: "连续 7 天",
      icon: <Flame />,
      locked: user.streak_days < 7,
      description: "连续完成 7 天学习打卡。"
    },
    {
      label: "高分学霸",
      icon: <Sparkles />,
      locked: !checkins.some((item) => (item.total_score ?? 0) >= 90),
      description: "任意一次 AI 综合评分达到 90 分。"
    },
    {
      label: "月度坚持",
      icon: <Trophy />,
      locked: checkins.length < 10,
      description: "本账号累计完成 10 次学习记录。"
    },
    {
      label: "早起学习",
      icon: <BookOpen />,
      locked: true,
      description: "清晨完成学习记录后解锁。"
    },
    {
      label: "商城达人",
      icon: <Gift />,
      locked: redemptions.length === 0,
      description: "完成一次狗狗币商城兑换。"
    },
    {
      label: "复盘高手",
      icon: <Check />,
      locked: checkins.length < 3,
      description: "累计完成 3 次学习复盘。"
    }
  ];
}

function BottomNav({ route, setRoute }: { route: RouteName; setRoute: (route: RouteName) => void }) {
  const items: Array<[RouteName, string, React.ReactNode]> = [
    ["home", "首页", <Home />],
    ["calendar", "日历", <Calendar />],
    ["checkin", "打卡", <Plus />],
    ["shopGoal", "商城", <PawIcon />],
    ["profile", "我的", <User />]
  ];
  const activeRoute = route === "badges" ? "profile" : route === "shop" ? "shopGoal" : route;

  return (
    <nav className="nav-bar" aria-label="底部导航">
      {items.map(([itemRoute, label, icon], index) => (
        <button
          className={`nav-item ${itemRoute === "checkin" ? "compose" : ""} ${activeRoute === itemRoute ? "active" : ""}`}
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
              消耗 {reward.cost_points} 狗狗币，兑换后剩余 {user.current_points - reward.cost_points}
            </p>
          </div>
        </div>
        <button className="primary-btn" disabled={!reward.can_redeem} onClick={onConfirm}>
          {reward.can_redeem ? "确认兑换" : `狗狗币不足，还差 ${reward.points_shortfall}`}
        </button>
      </section>
    </div>
  );
}

function ScoreCard({ checkin }: { checkin: Checkin }) {
  const score = checkin.total_score ?? 0;
  const scoreDelta = Math.max(1, Math.round((checkin.awarded_points || score) / 2));
  const rewardPoints = calculateDisplayReward(checkin);
  const scoreGrade = score >= 90 ? "A+" : score >= 80 ? "A" : score >= 70 ? "B" : score > 0 ? "C" : "--";
  const streakDays = readStreakFromComment(checkin.ai_advice) ?? 7;

  return (
    <div className="score-report">
      <article className="score-summary-card">
        <div>
          <p className="summary-label">今日综合评分</p>
          <div className="score-number">
            <strong>{checkin.total_score ?? "--"}</strong>
            <span>↗ +{scoreDelta} 较昨日</span>
          </div>
        </div>
        <GradeRing value={score} grade={scoreGrade} />
      </article>

      <article className="reward-banner">
        <img src={dogecoinIcon} alt="" />
        <div>
          <strong>恭喜！您已获得奖励</strong>
          <p><span>+{rewardPoints}</span> Dogecoins</p>
        </div>
      </article>

      <article className="score-detail-card">
        <Dimensions dimensions={checkin.score_dimensions} />
        <div className="streak-line">已连续学习 {streakDays} 天</div>
      </article>

      <article className="ai-review-card">
        <div className="review-title"><PawIcon /> 小狗评价</div>
        <p>{checkin.ai_comment ?? "今天的学习记录已经完成，继续保持稳定复盘。"}</p>
        {checkin.ai_advice && <p className="review-advice">{checkin.ai_advice}</p>}
      </article>
    </div>
  );
}

function Dimensions({ dimensions }: { dimensions: Checkin["score_dimensions"] }) {
  const fallbackDimensions: Checkin["score_dimensions"] = [
    { id: -1, dimension_code: "workload", dimension_name: "工作量", score: 84, sort_order: 1 },
    { id: -2, dimension_code: "completion", dimension_name: "工整度", score: 81, sort_order: 2 },
    { id: -3, dimension_code: "accuracy", dimension_name: "正确率", score: 76, sort_order: 3 },
    { id: -4, dimension_code: "notes", dimension_name: "笔记质量", score: 82, sort_order: 4 }
  ];
  const source = dimensions.length ? dimensions : fallbackDimensions;
  const displayNames = ["工作量", "工整度", "准确率", "笔记质量"];

  return (
    <div className="dimension-list">
      {[...source].sort((a, b) => a.sort_order - b.sort_order).slice(0, 4).map((dimension, index) => (
        <div key={dimension.id}>
          <div className="dim-head">
            <span>{displayNames[index] ?? dimension.dimension_name}</span>
            <span>{dimension.score}</span>
          </div>
          <div className="dim-track"><div className="dim-fill" style={{ width: `${dimension.score}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

function GradeRing({ value, grade }: { value: number; grade: string }) {
  return (
    <div className="grade-ring" style={{ "--value": value } as React.CSSProperties}>
      <span>{grade}</span>
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
      <small>{record ? `${score}分` : ""}</small>
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <article className="metric-card"><span>{label}</span><strong>{value}</strong></article>;
}

function DogecoinAmount({
  value,
  compact = false,
  hideLabel = false
}: {
  value: string | number;
  compact?: boolean;
  hideLabel?: boolean;
}) {
  return (
    <span className={`dogecoin-amount ${compact ? "compact-coin" : ""}`}>
      <img src={dogecoinIcon} alt="" />
      <span>{value}</span>
      {!hideLabel && <small>狗狗币</small>}
    </span>
  );
}

function PawIcon() {
  return (
    <svg className="paw-icon" viewBox="-4 -3 72 70" aria-hidden="true" focusable="false">
      <ellipse cx="11.8" cy="26.2" rx="7.3" ry="10.6" transform="rotate(-29 11.8 26.2)" />
      <ellipse cx="24.6" cy="13.8" rx="7.3" ry="10.6" transform="rotate(-10 24.6 13.8)" />
      <ellipse cx="43.4" cy="13.8" rx="7.3" ry="10.6" transform="rotate(10 43.4 13.8)" />
      <ellipse cx="56.2" cy="26.2" rx="7.3" ry="10.6" transform="rotate(29 56.2 26.2)" />
      <path d="M34 31c-10.6 0-20 10.8-20 21.4 0 5.9 3.8 8.8 9.1 7.1 3.7-1.2 6.1-2 10.9-2s7.2.8 10.9 2c5.3 1.7 9.1-1.2 9.1-7.1C54 41.8 44.6 31 34 31Z" />
    </svg>
  );
}

function ClockGlyph() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <path d="M5 7.5h10.5" />
      <path d="M5 14h7" />
      <path d="M5 20.5h4.5" />
      <path d="M17 18.5l3.2-3.2 2.3 2.3" />
      <path d="M20.2 15.3v5.4" />
    </svg>
  );
}

function NoteGlyph() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <path d="M5 7.5h10" />
      <path d="M5 14h7.5" />
      <path d="M5 20.5h5" />
      <path d="M16 20.5l5.8-5.8 2.2 2.2-5.8 5.8-3 .8.8-3Z" />
    </svg>
  );
}

function QuestionGlyph() {
  return (
    <svg viewBox="0 0 28 28" aria-hidden="true" focusable="false">
      <path d="M5.5 6.5h17v15h-17z" />
      <path d="M10.5 11.2a3.4 3.4 0 0 1 6.6 1.1c0 2.6-3.1 2.7-3.1 5" />
      <path d="M14 19.7v.1" />
      <path d="M3.5 9.5v14h16" />
    </svg>
  );
}

function CameraPlusGlyph() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M8 10h3.4l1.8-2.2h5.6l1.8 2.2H24a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z" />
      <circle cx="16" cy="18" r="4.5" />
      <path d="M25 5v6" />
      <path d="M22 8h6" />
    </svg>
  );
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

function readSavingsGoal(): SavingsGoal | null {
  try {
    const raw = localStorage.getItem(SAVINGS_GOAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavingsGoal>;
    if (typeof parsed.name !== "string" || !parsed.name.trim()) return null;
    if (typeof parsed.target !== "number" || parsed.target <= 0) return null;
    return {
      name: parsed.name,
      target: parsed.target,
      imageUrl: typeof parsed.imageUrl === "string" ? parsed.imageUrl : ""
    };
  } catch {
    return null;
  }
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

function readStreakFromComment(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/连续(?:学习|打卡)?\s*(\d+)\s*天/);
  return match ? Number(match[1]) : null;
}

function calculateDisplayReward(checkin: Checkin): number {
  if (checkin.awarded_points > 0) {
    return checkin.awarded_points;
  }
  return 0;
}

function levelName(points: number): string {
  if (points >= 3000) return "Lv.6 复盘高手";
  if (points >= 1500) return "Lv.5 坚持达人";
  if (points >= 800) return "Lv.4 学习能量";
  if (points >= 300) return "Lv.3 稳定进步";
  return "Lv.2 起步认真";
}

export default App;
