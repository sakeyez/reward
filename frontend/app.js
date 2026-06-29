const icons = {
  home: '<path d="m3 10 9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
  chat: '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
  calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18"/>',
  gift: '<path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 1 1 2.1-3.86L12 7z"/><path d="M12 7h4.5a2.5 2.5 0 1 0-2.1-3.86L12 7z"/>',
  user: '<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
  bot: '<rect x="5" y="7" width="14" height="12" rx="3"/><path d="M12 3v4"/><path d="M8 12h.01"/><path d="M16 12h.01"/><path d="M9 16h6"/>',
  bell: '<path d="M10.3 21a2 2 0 0 0 3.4 0"/><path d="M18 8a6 6 0 1 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>',
  menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  mic: '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/>',
  waveform: '<path d="M4 10v4"/><path d="M8 7v10"/><path d="M12 4v16"/><path d="M16 7v10"/><path d="M20 10v4"/>',
  camera: '<path d="M14.5 4 16 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3l1.5-3z"/><circle cx="12" cy="13" r="3"/>',
  image: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10.5" r="1.5"/><path d="m21 15-5-5L5 19"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>',
  trophy: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M5 5H3v3a4 4 0 0 0 4 4"/><path d="M19 5h2v3a4 4 0 0 1-4 4"/>',
  flame: '<path d="M8.5 14.5A4.5 4.5 0 1 0 16 11c0-4-4-7-4-7S8 7 8 11c0 1.5.5 2.5.5 3.5z"/><path d="M12 20a2.5 2.5 0 0 0 2.5-2.5c0-1.9-2.5-3.5-2.5-3.5s-2.5 1.6-2.5 3.5A2.5 2.5 0 0 0 12 20z"/>',
  sparkles: '<path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7z"/><path d="m19 14 .9 2.1L22 17l-2.1.9L19 20l-.9-2.1L16 17l2.1-.9z"/><path d="m5 14 .9 2.1L8 17l-2.1.9L5 20l-.9-2.1L2 17l2.1-.9z"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6"/>',
  chevronRight: '<path d="m9 18 6-6-6-6"/>',
  close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z"/>',
  settings: '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5z"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 4.6 15a1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 1 1.5h.1a1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8v.1a1.6 1.6 0 0 0 1.5 1h.2a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.5 1z"/>'
};

const state = {
  route: "home",
  user: {
    name: "林小然",
    points: 1420,
    streakDays: 9,
    level: "Lv.5 坚持达人"
  },
  checkin: {
    status: "not_started",
    uploadedImage: "",
    hasUpload: false,
    score: 86,
    points: 86,
    saved: false,
    dimensions: [
      ["完成度", 88],
      ["清晰度", 82],
      ["理解深度", 84],
      ["坚持度", 91]
    ],
    comment: "今天的笔记结构完整，重点标注清楚，能看出你在主动整理知识。继续保持这种复盘节奏。",
    advice: "明天可以把错题原因单独写成 3 条，复习时会更容易定位薄弱点。"
  },
  selectedDay: 18,
  activeCategory: "全部",
  modalItem: null
};

const calendarRecords = {
  1: { score: 78, points: 78 },
  2: { score: 84, points: 84 },
  3: { score: 91, points: 91 },
  5: { score: 73, points: 73 },
  6: { score: 88, points: 88 },
  7: { score: 90, points: 90 },
  8: { score: 82, points: 82 },
  10: { score: 79, points: 79 },
  11: { score: 86, points: 86 },
  12: { score: 92, points: 92 },
  14: { score: 80, points: 80 },
  15: { score: 83, points: 83 },
  16: { score: 89, points: 89 },
  17: { score: 87, points: 87 },
  18: { score: 86, points: 86 }
};

const rewards = [
  { name: "笔记本套装", category: "文具", cost: 800, art: "stationery" },
  { name: "AI 学习报告包", category: "会员", cost: 1200, art: "member" },
  { name: "课程优惠券", category: "课程", cost: 2000, art: "course" },
  { name: "专属头像框", category: "虚拟奖励", cost: 500, art: "virtual" },
  { name: "错题复盘模板", category: "文具", cost: 680, art: "stationery" },
  { name: "7 天会员加速", category: "会员", cost: 1600, art: "member" }
];

function icon(name) {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">${icons[name]}</svg>`;
}

function setRoute(route) {
  state.route = route;
  render();
}

function render() {
  const app = document.querySelector("#app");
  const routes = {
    home: renderHome,
    checkin: renderCheckin,
    result: renderResult,
    calendar: renderCalendar,
    shop: renderShop,
    profile: renderProfile
  };
  app.innerHTML = routes[state.route]();
  bindEvents();
}

function bottomNav() {
  const items = [
    ["home", "首页", "home"],
    ["calendar", "日历", "calendar"],
    ["checkin", "打卡", "plus"],
    ["shop", "商城", "gift"],
    ["profile", "我的", "user"]
  ];

  return `<nav class="nav-bar" aria-label="底部导航">
    ${items.map(([route, label, iconName], index) => `
      <button class="nav-item ${route === "checkin" ? "compose" : ""} ${state.route === route ? "active" : ""}" data-route="${route}" aria-label="${label}">
        <span class="nav-icon">${icon(iconName)}</span>
        <span>${index === 2 ? "" : label}</span>
      </button>
    `).join("")}
  </nav>`;
}

function headerGreeting() {
  return `<header class="home-hero">
    <div>
      <h1>早上好，<br />${state.user.name}</h1>
      <p class="date-pill">Tue, Jun 30</p>
    </div>
    <button class="plain-icon" aria-label="通知">${icon("bell")}</button>
  </header>`;
}

function renderHome() {
  return `<section class="page">
    ${headerGreeting()}
    <div class="section-row">
      <h2 class="section-title">学习计划</h2>
      <button class="plain-icon small" aria-label="排序">${icon("settings")}</button>
    </div>
    <article class="plan-card">
      <div class="plan-media paper-preview" role="img" aria-label="学习成果示意图"></div>
      <div class="plan-copy">
        <p><strong>${state.user.name}</strong> 正在复盘</p>
        <h3>AI 学习打卡</h3>
        <div class="rule"></div>
        <p>上传今天的学习成果，收下成长分。</p>
      </div>
      <div class="plan-foot">
        <span>${icon("calendar")} Jun 30</span>
        <strong>${state.checkin.saved ? "已完成" : "待打卡"}</strong>
        <button class="chat-link" data-route="checkin" aria-label="进入 AI 对话">${icon("chat")}</button>
      </div>
    </article>
    <article class="card task-card compact">
      <div class="task-layout">
        <div>
          <p class="eyebrow">今日学习小任务</p>
          <div class="goal">上传学习成果，收下今天的成长分</div>
          <div class="status-line">
            <span class="status-chip">最高 +100 积分</span>
            <span class="status-chip">${state.checkin.saved ? "已完成" : "待打卡"}</span>
          </div>
        </div>
        ${state.checkin.saved ? `<div class="energy-ring" style="--value:${state.checkin.score}">
          <div><strong>${state.checkin.score}</strong><span>能量</span></div>
        </div>` : ""}
      </div>
    </article>
    <h2 class="section-title">本周学习表现</h2>
    <div class="metrics-grid">
      ${metric("平均分", "85.8")}
      ${metric("累计积分", "612")}
      ${metric("连续打卡", `${state.user.streakDays}`)}
    </div>
    ${bottomNav()}
  </section>`;
}

function metric(label, value) {
  return `<article class="metric-card"><span>${label}</span><strong>${value}</strong></article>`;
}

function renderCheckin() {
  const hasUpload = state.checkin.hasUpload || Boolean(state.checkin.uploadedImage);
  const analyzed = state.checkin.status === "analyzed" || state.checkin.saved;
  return `<section class="page chat-page with-input">
    <header class="chat-top">
      <button class="round-tool" data-route="home" aria-label="返回首页">${icon("menu")}</button>
      <button class="model-title" type="button">AI 教练 <span>⌄</span></button>
      <button class="round-tool accent" data-action="open-album" aria-label="添加学习成果">${icon("plus")}</button>
    </header>
    <div class="chat-list">
      ${botBubble("请上传你今天的学习成果，我会认真看看，并给你一张温柔的评分卡。笔记、作业、练习题或读书记录都可以。")}
      ${hasUpload ? userUploadBubble() : ""}
      ${state.checkin.status === "analyzing" ? botAnalyzing() : ""}
      ${analyzed ? botScoreCard() : ""}
    </div>
    ${inputBar()}
  </section>`;
}

function botBubble(text) {
  return `<div class="bubble-row">
    <div class="assistant-prose">${text}</div>
  </div>`;
}

function userUploadBubble() {
  const preview = state.checkin.uploadedImage
    ? `<img src="${state.checkin.uploadedImage}" alt="上传的学习成果缩略图" />`
    : `<div class="paper-preview" role="img" aria-label="学习成果示意图"></div>`;
  return `<div class="bubble-row user">
    <div class="chat-bubble">
      <div class="upload-preview">${preview}</div>
      <p style="margin: 8px 0 0;">这是今天的小成果，请帮我看看。</p>
    </div>
  </div>`;
}

function botAnalyzing() {
  return `<div class="bubble-row">
    <div class="analyzing-card"><div class="small-ring"></div><strong>正在认真阅读你的学习成果...</strong></div>
  </div>`;
}

function botScoreCard() {
  return `<div class="bubble-row">
    <div class="score-wrap">${scoreCard(true)}</div>
  </div>`;
}

function scoreCard(withActions = false) {
  return `<article class="score-card">
    <div class="score-head">
      <div>
        <p class="eyebrow">今日综合评分</p>
        <div class="score-number"><strong>${state.checkin.score}</strong><span>+${state.checkin.points}</span></div>
      </div>
      <div class="energy-ring" style="--value:${state.checkin.score}; width: 74px;"><div><strong style="font-size: 20px;">AI</strong><span>评分</span></div></div>
    </div>
    ${dimensions()}
    <p class="ai-note"><strong>AI 评价：</strong>${state.checkin.comment}</p>
    <p class="ai-note"><strong>明日建议：</strong>${state.checkin.advice}</p>
    ${withActions ? `<div class="score-actions">
      <button class="primary-btn" data-action="save-checkin">保存打卡</button>
      <button class="secondary-btn" data-action="supplement">继续补充</button>
      <button class="secondary-btn" data-route="calendar">查看日历</button>
    </div>` : ""}
  </article>`;
}

function dimensions() {
  return `<div class="dimension-list">
    ${state.checkin.dimensions.map(([label, score]) => `
      <div>
        <div class="dim-head"><span>${label}</span><span>${score} 分</span></div>
        <div class="dim-track"><div class="dim-fill" style="--score:${score}%"></div></div>
      </div>
    `).join("")}
  </div>`;
}

function inputBar() {
  return `<div class="input-bar">
    <input class="file-input" id="cameraInput" type="file" accept="image/*" capture="environment" />
    <input class="file-input" id="albumInput" type="file" accept="image/*" />
    <button class="composer-plus" data-action="open-album" aria-label="添加学习成果">${icon("plus")}</button>
    <input type="text" id="chatText" placeholder="Reply to AI 教练" aria-label="输入学习说明" />
    <button class="composer-mic" data-action="open-camera" aria-label="拍照上传">${icon("mic")}</button>
    <button class="composer-send" data-action="send-checkin" aria-label="发送">${icon("waveform")}</button>
  </div>`;
}

function renderResult() {
  return `<section class="page">
    <article class="card result-hero">
      <div class="celebrate-dots"></div>
      <div class="trophy-icon">${icon("trophy")}</div>
      <p class="eyebrow">今日打卡完成</p>
      <h1>今天的小成果已收好</h1>
      <div class="result-score"><div><strong>${state.checkin.score}</strong><span>+${state.checkin.points} 积分</span></div></div>
    </article>
    <article class="card" style="padding: 16px; margin-top: 14px;">
      <h2>AI 评价摘要</h2>
      <p style="color: var(--muted);">${state.checkin.comment}</p>
      ${dimensions()}
      <p class="ai-note">${icon("check")} 已累计到你的账户，当前积分 ${state.user.points}</p>
    </article>
    <div class="result-actions">
      <button class="secondary-btn" data-route="calendar">查看学习日历</button>
      <button class="primary-btn" data-route="shop">去商城兑换</button>
    </div>
    ${bottomNav()}
  </section>`;
}

function renderCalendar() {
  const selected = calendarRecords[state.selectedDay] || { score: state.checkin.score, points: state.checkin.points };
  return `<section class="page">
    <div class="title-row">
      <div>
        <p class="eyebrow">成长记录</p>
        <h1>六月学习日历</h1>
      </div>
      <span class="pill mint">${state.user.streakDays} 天连续</span>
    </div>
    <div class="calendar-stats">
      ${metric("本月积分", "1288")}
      ${metric("平均分", "85.9")}
      ${metric("打卡天数", "15")}
    </div>
    <article class="card calendar-grid" aria-label="六月学习日历">
      ${["一", "二", "三", "四", "五", "六", "日"].map(day => `<div class="week-label">${day}</div>`).join("")}
      ${Array.from({ length: 30 }, (_, index) => calendarCell(index + 1)).join("")}
    </article>
    <article class="card detail-sheet-inline">
      <div class="thumb-row">
        <div class="paper-preview thumb-mini"></div>
        <div>
          <p class="eyebrow">6 月 ${state.selectedDay} 日详情</p>
          <h2 style="margin-bottom: 4px;">+${selected.points} 积分</h2>
          <p style="margin: 0; color: var(--muted);">结构清晰，学习证据完整，建议继续补充错题原因。</p>
        </div>
      </div>
    </article>
    <h2 class="section-title energy-title">本周学习能量</h2>
    <article class="card energy-bars" aria-label="本周分数柱状图">
      ${[
        ["一", 78],
        ["二", 84],
        ["三", 91],
        ["四", 73],
        ["五", 86],
        ["六", 88],
        ["日", 90]
      ].map(([day, score]) => `<div class="score-bar" aria-label="周${day} ${score} 分">
        <div class="bar-track"><span class="bar-fill" style="height:${score}px"></span></div>
        <strong>${score}</strong>
        <small>${day}</small>
      </div>`).join("")}
    </article>
    ${bottomNav()}
  </section>`;
}

function calendarCell(day) {
  const record = calendarRecords[day];
  const scoreClass = record ? (record.score >= 88 ? "score-high" : record.score >= 80 ? "score-mid" : "score-low") : "";
  return `<button class="calendar-cell ${scoreClass} ${state.selectedDay === day ? "selected" : ""}" data-day="${day}" aria-label="6 月 ${day} 日${record ? `，${record.score} 分` : "，未打卡"}">
    ${day}
    <small>${record ? `${record.score}分` : "未打卡"}</small>
  </button>`;
}

function renderShop() {
  const categories = ["全部", "文具", "课程", "会员", "虚拟奖励"];
  const filtered = rewards.filter(item => state.activeCategory === "全部" || item.category === state.activeCategory);
  return `<section class="page">
    <div class="title-row">
      <div>
        <p class="eyebrow">奖励中心</p>
        <h1>积分商城</h1>
      </div>
      <span class="pill">${state.user.points} 分</span>
    </div>
    <article class="card shop-balance">
      <p class="eyebrow" style="color: rgba(255,255,255,.78);">我的积分</p>
      <strong>${state.user.points}</strong>
      <span>攒下一点点努力，换一份小奖励。</span>
    </article>
    <div class="tab-scroll" role="tablist" aria-label="商品分类">
      ${categories.map(cat => `<button class="tab-btn ${state.activeCategory === cat ? "active" : ""}" data-category="${cat}" role="tab" aria-selected="${state.activeCategory === cat}">${cat}</button>`).join("")}
    </div>
    <div class="reward-grid">
      ${filtered.map(rewardCard).join("")}
    </div>
    ${state.modalItem ? redeemModal() : ""}
    ${bottomNav()}
  </section>`;
}

function rewardCard(item) {
  const enough = state.user.points >= item.cost;
  const diff = item.cost - state.user.points;
  return `<button class="reward-card" data-reward="${item.name}" aria-label="${item.name}，需要 ${item.cost} 积分，${enough ? "可兑换" : `还差 ${diff} 积分`}">
    <div class="product-art ${item.art}" role="img" aria-label="${item.name} 商品图"></div>
    <h3>${item.name}</h3>
    <div class="product-meta">
      <span class="points">${item.cost} 积分</span>
    </div>
    <span class="stock ${enough ? "" : "locked"}">${enough ? "可兑换" : `还差 ${diff}`}</span>
  </button>`;
}

function redeemModal() {
  const item = state.modalItem;
  const enough = state.user.points >= item.cost;
  return `<div class="modal-scrim" data-action="close-modal" role="presentation">
    <section class="redeem-sheet" role="dialog" aria-modal="true" aria-label="兑换确认">
      <div class="sheet-row">
        <h2 style="margin: 0;">兑换确认</h2>
        <button class="sheet-close" data-action="close-modal" aria-label="关闭">${icon("close")}</button>
      </div>
      <div class="thumb-row" style="margin: 14px 0;">
        <div class="product-art ${item.art} thumb-mini" role="img" aria-label="${item.name} 商品图"></div>
        <div>
          <h3>${item.name}</h3>
          <p style="margin: 0; color: var(--muted);">消耗 ${item.cost} 积分，兑换后剩余 ${state.user.points - item.cost}</p>
        </div>
      </div>
      <button class="primary-btn" ${enough ? "" : "disabled"} data-action="confirm-redeem">${enough ? "确认兑换" : `积分不足，还差 ${item.cost - state.user.points}`}</button>
    </section>
  </div>`;
}

function renderProfile() {
  return `<section class="page">
    <article class="card profile-hero">
      <div class="profile-row">
        <div class="profile-row" style="gap: 12px;">
          <div class="avatar large" role="img" aria-label="用户头像"></div>
          <div>
            <p class="eyebrow">${state.user.level}</p>
            <h1>${state.user.name}</h1>
          </div>
        </div>
        <span class="pill">${state.user.points} 分</span>
      </div>
      <div class="level-card">
        <div class="sheet-row">
          <strong>Lv.5 坚持达人</strong>
          <span style="color: var(--muted); font-size: 13px;">距 Lv.6 还差 380</span>
        </div>
        <div class="progress-track" style="margin-top: 10px;"><div class="progress-fill"></div></div>
      </div>
    </article>
    <h2 class="section-title">徽章墙</h2>
    <div class="badge-grid">
      ${badge("连续 7 天", "flame")}
      ${badge("高分学霸", "sparkles")}
      ${badge("月度坚持", "trophy")}
      ${badge("早起学习", "book", true)}
      ${badge("商城达人", "gift", true)}
      ${badge("复盘高手", "check")}
    </div>
    <h2 class="section-title">账户</h2>
    <div class="entry-list">
      ${entry("兑换记录")}
      ${entry("打卡记录")}
      ${entry("账户设置")}
    </div>
    ${bottomNav()}
  </section>`;
}

function badge(label, iconName, locked = false) {
  return `<article class="badge-card ${locked ? "locked" : ""}">
    <div class="badge-icon">${icon(iconName)}</div>
    <strong>${label}</strong>
    <p style="margin: 4px 0 0; color: var(--muted); font-size: 12px;">${locked ? "待解锁" : "已获得"}</p>
  </article>`;
}

function entry(label) {
  return `<button class="list-item"><span>${label}</span>${icon("chevronRight")}</button>`;
}

function bindEvents() {
  document.querySelectorAll("[data-route]").forEach(btn => {
    btn.addEventListener("click", () => setRoute(btn.dataset.route));
  });

  document.querySelectorAll("[data-day]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.selectedDay = Number(btn.dataset.day);
      render();
    });
  });

  document.querySelectorAll("[data-category]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.activeCategory = btn.dataset.category;
      render();
    });
  });

  document.querySelectorAll("[data-reward]").forEach(btn => {
    btn.addEventListener("click", () => {
      state.modalItem = rewards.find(item => item.name === btn.dataset.reward);
      render();
    });
  });

  const cameraInput = document.querySelector("#cameraInput");
  const albumInput = document.querySelector("#albumInput");
  document.querySelector('[data-action="open-camera"]')?.addEventListener("click", () => cameraInput?.click());
  document.querySelector('[data-action="open-album"]')?.addEventListener("click", () => albumInput?.click());
  cameraInput?.addEventListener("change", handleUpload);
  albumInput?.addEventListener("change", handleUpload);

  document.querySelector('[data-action="send-checkin"]')?.addEventListener("click", () => {
    if (!state.checkin.uploadedImage) {
      state.checkin.uploadedImage = "";
    }
    analyze();
  });

  document.querySelector('[data-action="supplement"]')?.addEventListener("click", () => {
    state.checkin.status = "not_started";
    render();
  });

  document.querySelector('[data-action="save-checkin"]')?.addEventListener("click", () => {
    if (!state.checkin.saved) {
      state.user.points += state.checkin.points;
      state.checkin.saved = true;
      calendarRecords[18] = { score: state.checkin.score, points: state.checkin.points };
    }
    setRoute("result");
  });

  document.querySelectorAll('[data-action="close-modal"]').forEach(el => {
    el.addEventListener("click", event => {
      if (event.target.closest(".redeem-sheet") && !event.target.closest(".sheet-close")) return;
      state.modalItem = null;
      render();
    });
  });

  document.querySelector('[data-action="confirm-redeem"]')?.addEventListener("click", () => {
    const item = state.modalItem;
    if (item && state.user.points >= item.cost) {
      state.user.points -= item.cost;
      state.modalItem = null;
      render();
    }
  });
}

function handleUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    state.checkin.uploadedImage = String(reader.result);
    state.checkin.hasUpload = true;
    analyze();
  };
  reader.readAsDataURL(file);
}

function analyze() {
  state.checkin.status = "analyzing";
  state.checkin.hasUpload = true;
  render();
  window.setTimeout(() => {
    state.checkin.status = "analyzed";
    if (!state.checkin.uploadedImage) {
      state.checkin.uploadedImage = "";
    }
    render();
  }, 900);
}

render();
