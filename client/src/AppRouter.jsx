import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  BrowserRouter,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams
} from "react-router-dom";
import { fetchJson, postJson } from "./api";
import { AuthProvider, portalDestinations, useAuth } from "./auth";

const navigationConfig = {
  admin: [
    { label: "Dashboard", to: "/admin/dashboard", icon: "grid" },
    { label: "School Ops", to: "/admin/schools", icon: "users" },
    { label: "Reports", to: "/admin/reports", icon: "chart" }
  ],
  teacher: [
    { label: "Dashboard", to: "/teacher/dashboard", icon: "grid" },
    { label: "Classroom", to: "/teacher/classroom", icon: "users" },
    { label: "Assignments", to: "/teacher/assignments", icon: "clipboard" },
    { label: "Reports", to: "/teacher/reports", icon: "chart" }
  ],
  student: [
    { label: "Dashboard", to: "/student/home", icon: "grid" },
    { label: "Practice", to: "/student/practice", icon: "clipboard" },
    { label: "Progress", to: "/student/progress", icon: "chart" }
  ],
  parent: [
    { label: "Dashboard", to: "/parent/home", icon: "grid" }
  ]
};

const classOptions = ["Grade 8 - A", "Grade 8 - B", "Grade 9 - A"];
const portalRoles = ["admin", "teacher", "student", "parent"];
const ThemeContext = createContext(null);

function formatLastActive(value) {
  if (!value) return "Not available";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const diffHours = Math.max(1, Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60)));
  return diffHours < 24 ? `${diffHours}h ago` : `${Math.round(diffHours / 24)}d ago`;
}

function normalizeDashboardData(role, payload) {
  if (!payload) return payload;

  if (role === "teacher") {
    const pathStatuses = (payload.pathStatuses ?? []).map((student) => ({
      ...student,
      lastActive: formatLastActive(student.latestAssignmentDate ?? "")
    }));

    return {
      ...payload,
      summaryCards: payload.summaryCards ?? [],
      classrooms: payload.classrooms ?? [],
      pathStatuses,
      flaggedStudents: payload.flaggedStudents ?? [],
      classConcepts: payload.classConcepts ?? [],
      roster: payload.roster ?? [],
      weekPlan: payload.weekPlan ?? [],
      assignments: payload.assignments ?? [],
      bankStatus: payload.bankStatus ?? []
    };
  }

  if (role === "student") {
    return {
      ...payload,
      currentTasks: payload.currentTasks ?? [],
      recommendations: payload.recommendations ?? [],
      mastery: payload.mastery ?? [],
      recentResults: payload.recentResults ?? [],
      checkpoints: payload.checkpoints ?? [],
      todayTask: payload.todayTask ?? null,
      learningPath: payload.learningPath ?? null,
      assignmentSummary: payload.assignmentSummary ?? null,
      assignmentHistory: payload.assignmentHistory ?? [],
      latestBatch: payload.latestBatch ?? null,
      studentInsight: payload.studentInsight ?? { summary: "", highlights: [] },
      coachNote:
        payload.coachNote ??
        "Your path focuses on the concepts where your latest answers show the biggest learning gaps."
    };
  }

  if (role === "parent") {
    return {
      ...payload,
      summaryCards: payload.summaryCards ?? [],
      linkedStudents: payload.linkedStudents ?? [],
      weakAreas: payload.weakAreas ?? [],
      dailyProgress: payload.dailyProgress ?? [],
      suggestions: payload.suggestions ?? [],
      assignmentOverview: payload.assignmentOverview ?? [],
      progressByStudent: payload.progressByStudent ?? []
    };
  }

  return {
    ...payload,
    metrics: payload.metrics ?? [],
    summaryCards: payload.summaryCards ?? payload.metrics ?? [],
    schools: payload.schools ?? [],
    pulse:
      payload.pulse ??
      (payload.weeklyHighlights ?? []).map((item, index) => ({
        title: `Highlight ${index + 1}`,
        detail: item
      })),
    riskDistribution: payload.riskDistribution ?? [],
    milestoneDistribution: payload.milestoneDistribution ?? [],
    chapterDistribution: payload.chapterDistribution ?? [],
    classroomRollup: payload.classroomRollup ?? [],
    students: payload.students ?? [],
    insightSummary: payload.insightSummary ?? "",
    insightHighlights: payload.insightHighlights ?? [],
    buyerNotes: payload.buyerNotes ?? []
  };
}

function Icon({ name }) {
  const paths = {
    users: <path d="M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5ZM13.5 10.5A2.5 2.5 0 1 0 13.5 5a2.5 2.5 0 0 0 0 5ZM2.5 15.5c0-2.21 1.79-4 4-4h1c2.21 0 4 1.79 4 4M10.5 15.5c.18-1.87 1.76-3.33 3.68-3.33h.65c1.84 0 3.34 1.49 3.34 3.33" />,
    clipboard: <path d="M7 4.5h6M8 3h4a1 1 0 0 1 1 1v1H7V4a1 1 0 0 1 1-1ZM5.5 5h9A1.5 1.5 0 0 1 16 6.5v9A1.5 1.5 0 0 1 14.5 17h-9A1.5 1.5 0 0 1 4 15.5v-9A1.5 1.5 0 0 1 5.5 5ZM7 9h6M7 12h4" />,
    chart: <path d="M4 15.5h12M6.5 13V9.5M10 13V6.5M13.5 13V8" />,
    grid: <path d="M4 4.5h5v5H4v-5ZM11 4.5h5v5h-5v-5ZM4 11.5h5v5H4v-5ZM11 11.5h5v5h-5v-5Z" />,
    book: <path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H15v13h-8.5A1.5 1.5 0 0 0 5 17.5v-13ZM15 16V4M5 16h8.5" />
  };

  return (
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {paths[name] ?? paths.grid}
    </svg>
  );
}

function MetricCard({ label, value, className = "" }) {
  return (
    <article className={`metric-card ${className}`.trim()}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function DonutChart({ title, segments, totalLabel = "Total", className = "" }) {
  const safeSegments = segments.filter((segment) => segment.value > 0);
  const total = safeSegments.reduce((sum, segment) => sum + segment.value, 0) || 1;
  let cursor = 0;
  const gradient = safeSegments
    .map((segment) => {
      const start = Math.round((cursor / total) * 360);
      cursor += segment.value;
      const end = Math.round((cursor / total) * 360);
      return `${segment.color} ${start}deg ${end}deg`;
    })
    .join(", ");

  return (
    <article className={`chart-card ${className}`.trim()}>
      <div className="chart-card__header">
        <strong>{title}</strong>
        <span>{totalLabel}: {safeSegments.reduce((sum, segment) => sum + segment.value, 0)}</span>
      </div>
      <div className="donut-layout">
        <div className="donut-chart" style={{ background: `conic-gradient(${gradient || "#e5e7eb 0deg 360deg"})` }}>
          <div className="donut-chart__center">{safeSegments.reduce((sum, segment) => sum + segment.value, 0)}</div>
        </div>
        <div className="chart-legend">
          {safeSegments.map((segment) => (
            <div className="chart-legend__item" key={segment.label}>
              <span className="chart-legend__dot" style={{ background: segment.color }} />
              <span>{segment.label}</span>
              <strong>{segment.value}</strong>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function BarChart({ title, items, suffix = "", className = "" }) {
  const max = Math.max(...items.map((item) => item.value), 1);

  return (
      <article className={`chart-card ${className}`.trim()}>
        <div className="chart-card__header">
          <strong>{title}</strong>
        </div>
        <div className="bar-chart">
        {items.map((item, index) => (
          <div className="bar-chart__row" key={item.key ?? `${item.label}-${index}`}>
            <div className="bar-chart__meta">
              <span>{item.label}</span>
              <strong>{item.value}{suffix}</strong>
            </div>
            <div className="bar-chart__track">
              <div className="bar-chart__fill" style={{ width: `${(item.value / max) * 100}%`, background: item.color || "#2563eb" }} />
            </div>
          </div>
        ))}
      </div>
    </article>
  );
}

function HistogramChart({ title, bins, className = "" }) {
  const max = Math.max(...bins.map((item) => item.value), 1);

  return (
    <article className={`chart-card ${className}`.trim()}>
      <div className="chart-card__header">
        <strong>{title}</strong>
      </div>
      <div className="histogram">
        {bins.map((bin) => (
          <div className="histogram__col" key={bin.label}>
            <div className="histogram__bar-wrap">
              <div className="histogram__bar" style={{ height: `${(bin.value / max) * 100}%` }} />
            </div>
            <strong>{bin.value}</strong>
            <span>{bin.label}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function LineChart({ title, points, suffix = "", className = "" }) {
  const safePoints = points.length ? points : [{ label: "Now", value: 0 }];
  const hasSinglePoint = safePoints.length === 1;
  const max = Math.max(...safePoints.map((point) => point.value), 1);
  const min = Math.min(...safePoints.map((point) => point.value), 0);
  const range = Math.max(max - min, 1);
  const coordinates = safePoints.map((point, index) => {
    const x = safePoints.length === 1 ? 50 : (index / (safePoints.length - 1)) * 100;
    const y = 100 - (((point.value - min) / range) * 80 + 10);
    return `${x},${y}`;
  }).join(" ");

  return (
    <article className={`chart-card ${hasSinglePoint ? "chart-card--single-point" : ""} ${className}`.trim()}>
      <div className="chart-card__header">
        <strong>{title}</strong>
      </div>
      <div className="line-chart">
        {hasSinglePoint ? (
          <div className="line-chart__single">
            <div className="line-chart__single-value">{safePoints[0].value}{suffix}</div>
            <div className="line-chart__single-label">{safePoints[0].label}</div>
          </div>
        ) : (
          <svg className="line-chart__svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <polyline className="line-chart__path" points={coordinates} />
            {safePoints.map((point, index) => {
              const x = (index / (safePoints.length - 1)) * 100;
              const y = 100 - (((point.value - min) / range) * 80 + 10);
              return <circle className="line-chart__dot" cx={x} cy={y} key={point.key ?? `${point.label}-${index}`} r="1.8" />;
            })}
          </svg>
        )}
        <div className="line-chart__labels">
          {safePoints.map((point, index) => (
            <div className="line-chart__label" key={point.key ?? `${point.label}-${index}`}>
              <span>{point.label}</span>
              <strong>{point.value}{suffix}</strong>
            </div>
          ))}
        </div>
      </div>
    </article>
  );
}

function MilestoneChart({ title, items, className = "" }) {
  const max = Math.max(...items.map((item) => item.goal ?? item.value ?? 0), 1);

  return (
    <article className={`chart-card ${className}`.trim()}>
      <div className="chart-card__header">
        <strong>{title}</strong>
      </div>
      <div className="milestone-chart">
        {items.map((item, index) => {
          const goal = Math.max(Number(item.goal ?? item.value ?? 0), 0);
          const start = Math.max(Number(item.start ?? 0), 0);
          const current = Math.max(Number(item.current ?? item.value ?? 0), 0);
          return (
            <div className="milestone-chart__row" key={item.key ?? `${item.label}-${index}`}>
              <div className="milestone-chart__meta">
                <span>{item.label}</span>
                <strong>{current}%</strong>
              </div>
              <div className="milestone-chart__track">
                <div className="milestone-chart__goal" style={{ width: `${(goal / max) * 100}%` }} />
                <div className="milestone-chart__start" style={{ width: `${(start / max) * 100}%` }} />
                <div className="milestone-chart__current" style={{ width: `${(current / max) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function Card({ title, subtitle, children, action, className = "" }) {
  return (
      <section className={`card ${className}`.trim()}>
        <div className="card__header">
          <div>
            <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function StoryHero({ tone = "student", eyebrow, title, subtitle, action, className = "", children }) {
  return (
    <section className={`story-hero story-hero--${tone} ${className}`.trim()}>
      <div className="story-hero__content">
        {eyebrow ? <span className="story-hero__eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        {children ? <div className="story-hero__extras">{children}</div> : null}
      </div>
      {action ? <div className="story-hero__action">{action}</div> : null}
    </section>
  );
}

function AccentMetric({ tone = "blue", label, value, meta, className = "" }) {
  return (
    <article className={`accent-metric accent-metric--${tone} ${className}`.trim()}>
      <span className="accent-metric__label">{label}</span>
      <strong className="accent-metric__value">{value}</strong>
      {meta ? <small className="accent-metric__meta">{meta}</small> : null}
    </article>
  );
}

function StatusBadge({ risk }) {
  return <span className={`status-badge status-badge--${risk.toLowerCase()}`}>{risk}</span>;
}

function formatAssignmentStateLabel(status) {
  switch (status) {
    case "assigned":
      return "Assigned";
    case "started":
    case "in_progress":
      return "In progress";
    case "completed":
      return "Completed";
    default:
      return "Not assigned";
  }
}

function AssignmentStateBadge({ status }) {
  const normalized = status === "in_progress" ? "started" : status || "none";
  return (
    <span className={`assignment-state-badge assignment-state-badge--${normalized}`}>
      {formatAssignmentStateLabel(normalized)}
    </span>
  );
}

function formatPathStatusLabel(status) {
  switch (status) {
    case "working":
      return "Working";
    case "stuck":
      return "Stuck";
    case "ready_to_unlock":
      return "Ready to unlock";
    case "completed":
      return "Completed";
    case "paused":
      return "Paused";
    default:
      return "Not started";
  }
}

function PathStatusBadge({ status }) {
  const normalized = status || "not_started";
  return <span className={`assignment-state-badge assignment-state-badge--${normalized}`}>{formatPathStatusLabel(normalized)}</span>;
}

function ChapterLadderCard({ ladder, title = "Chapter ladder", subtitle = "Progress through the Class 10 sequence." }) {
  return (
    <Card title={title} subtitle={subtitle}>
      <div className="compact-list chapter-ladder-list">
        {(ladder ?? []).map((chapter) => (
          <article className="compact-list__item compact-list__item--history chapter-ladder-item" key={chapter.code}>
            <div className="chapter-ladder-item__main">
              <strong>Chapter {chapter.chapterNumber} - {chapter.name}</strong>
              <p>{chapter.mastery}% mastery</p>
            </div>
            <div className="inline-tags top-space--tight">
              {chapter.current ? <span className="tag">Current</span> : null}
              {chapter.completed ? <span className="tag">Completed</span> : null}
              {chapter.locked ? <span className="tag">Locked</span> : null}
              {chapter.checkpointPassed ? <span className="tag">Checkpoint passed</span> : null}
            </div>
          </article>
        ))}
      </div>
    </Card>
  );
}

function getChapterPointers(ladder = [], currentChapterNumber = null) {
  const currentChapter =
    ladder.find((chapter) => chapter.current) ??
    ladder.find((chapter) => chapter.chapterNumber === currentChapterNumber) ??
    null;
  const upcomingChapter = currentChapter
    ? ladder.find((chapter) => chapter.chapterNumber > currentChapter.chapterNumber && !chapter.completed) ?? null
    : ladder.find((chapter) => !chapter.completed && !chapter.locked) ?? null;

  return { currentChapter, upcomingChapter };
}

function getDisplayPathStatus(learningPath = {}) {
  if (!learningPath) return "not_started";
  if (learningPath.status === "not_started") {
    const hasProgress =
      Number(learningPath.currentMastery ?? 0) > 0 ||
      Number(learningPath.completedChaptersCount ?? 0) > 0 ||
      Number(learningPath.currentCycleIndex ?? 0) > 0;
    return hasProgress ? "working" : "not_started";
  }

  return learningPath.status ?? "not_started";
}

function getTaskItemId(item) {
  return item?.id ?? item?.variantId ?? "";
}

function getAssignmentSessionKey(assignmentId) {
  return `eblms-assignment-session:${assignmentId}`;
}

function readAssignmentSession(assignmentId) {
  if (!assignmentId || typeof window === "undefined") {
    return { answers: {}, timings: {}, lastQuestionIndex: 0 };
  }

  try {
    const raw = window.sessionStorage.getItem(getAssignmentSessionKey(assignmentId));
    if (!raw) {
      return { answers: {}, timings: {}, lastQuestionIndex: 0 };
    }
    const parsed = JSON.parse(raw);
    return {
      answers: parsed.answers ?? {},
      timings: parsed.timings ?? {},
      lastQuestionIndex: Number(parsed.lastQuestionIndex ?? 0)
    };
  } catch {
    return { answers: {}, timings: {}, lastQuestionIndex: 0 };
  }
}

function writeAssignmentSession(assignmentId, nextState) {
  if (!assignmentId || typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(getAssignmentSessionKey(assignmentId), JSON.stringify(nextState));
}

function clearAssignmentSession(assignmentId) {
  if (!assignmentId || typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(getAssignmentSessionKey(assignmentId));
}

function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === "undefined") {
      return "dark";
    }
    return window.localStorage.getItem("eblms-theme") || "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    window.localStorage.setItem("eblms-theme", theme);
  }, [theme]);

  const value = useMemo(
    () => ({
      theme,
      toggleTheme: () => setTheme((current) => (current === "dark" ? "light" : "dark"))
    }),
    [theme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

function useThemeMode() {
  return useContext(ThemeContext);
}

function ThemeToggle() {
  const themeApi = useThemeMode();
  if (!themeApi) return null;

  const { theme, toggleTheme } = themeApi;
  return (
    <button className="theme-toggle" onClick={toggleTheme} type="button">
      <span className="theme-toggle__icon" aria-hidden="true">{theme === "dark" ? "☀" : "☾"}</span>
      <span>{theme === "dark" ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}

function QuestionStatusBadge({ status }) {
  const normalized = (status || "draft").toLowerCase();
  return <span className={`pill-badge pill-badge--${normalized}`}>{normalized.replace("_", " ")}</span>;
}

function GeneratorBadge({ ready }) {
  return (
    <span className={ready ? "pill-badge pill-badge--approved" : "pill-badge pill-badge--draft"}>
      {ready ? "AI ready" : "Review needed"}
    </span>
  );
}

function PortalSidebar({ role }) {
  const { currentUser, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const roleNavItems = useMemo(() => navigationConfig[role] ?? [], [role]);
  const usesCompactShell = role === "student" || role === "admin";

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
      }
    }

    if (drawerOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        document.body.style.overflow = "";
      };
    }

    document.body.style.overflow = "";
    return undefined;
  }, [drawerOpen]);

  function handleLogout(targetRole = role) {
    logout();
    navigate(`/login/${targetRole}`);
  }

  function renderNavLinks(classNamePrefix = "nav-item") {
    return roleNavItems.map((item) => (
      <NavLink
        key={item.to}
        className={({ isActive }) => (isActive ? `${classNamePrefix} ${classNamePrefix}--active` : classNamePrefix)}
        to={item.to}
      >
        <Icon name={item.icon} />
        <span>{item.label}</span>
      </NavLink>
    ));
  }

  return (
    <>
      <div className="mobile-topbar">
        <button className="mobile-topbar__toggle" onClick={() => setDrawerOpen(true)} type="button" aria-label="Open navigation menu">
          <span />
          <span />
          <span />
        </button>
        <div className="mobile-topbar__brand">
          <div className="portal-sidebar__mark">EB</div>
          <div>
            <strong>Elder Bro LMS</strong>
          </div>
        </div>
        <ThemeToggle />
      </div>
      {drawerOpen ? <button className="mobile-backdrop" onClick={() => setDrawerOpen(false)} type="button" aria-label="Close navigation overlay" /> : null}
      {usesCompactShell ? (
        <header className={`portal-topnav portal-topnav--${role}`}>
          <div className="portal-topnav__brand">
            <div className="portal-sidebar__mark">EB</div>
            <div>
              <strong>Elder Bro LMS</strong>
            </div>
          </div>
          <nav className="portal-topnav__nav">{renderNavLinks("nav-pill")}</nav>
          <div className="portal-topnav__actions">
            <ThemeToggle />
            <div className="portal-topnav__profile">
              <span className="portal-topnav__avatar">{(currentUser?.user?.fullName ?? "U").charAt(0).toUpperCase()}</span>
              <div>
                <strong>{currentUser?.user?.fullName}</strong>
              </div>
            </div>
            <button className="button button--secondary" onClick={() => handleLogout(role)} type="button">Logout</button>
          </div>
        </header>
      ) : (
        <aside className="portal-sidebar">
          <div className="portal-sidebar__logo">
            <div className="portal-sidebar__mark">EB</div>
            <div>
              <strong>Elder Bro LMS</strong>
            </div>
          </div>
          <nav className="portal-sidebar__nav">{renderNavLinks()}</nav>
          <div className="portal-sidebar__footer">
            <ThemeToggle />
            <div className="portal-user">
              <strong>{currentUser?.user?.fullName}</strong>
              <span>{currentUser?.user?.email}</span>
            </div>
            <div className="portal-switcher">
              {portalRoles
                .filter((portalRole) => portalRole !== role)
                .map((portalRole) => (
                  <button
                    key={portalRole}
                    className="portal-switcher__link"
                    onClick={() => handleLogout(portalRole)}
                    type="button"
                  >
                    Open {portalRole[0].toUpperCase() + portalRole.slice(1)} Portal
                  </button>
                ))}
            </div>
            <button className="button button--secondary button--full" onClick={() => handleLogout(role)} type="button">Logout</button>
          </div>
        </aside>
      )}
      <aside className={drawerOpen ? "mobile-drawer mobile-drawer--open" : "mobile-drawer"} aria-hidden={!drawerOpen}>
        <div className="mobile-drawer__header">
          <div>
            <strong>Elder Bro LMS</strong>
          </div>
          <div className="mobile-drawer__header-actions">
            <ThemeToggle />
            <button className="mobile-drawer__close" onClick={() => setDrawerOpen(false)} type="button" aria-label="Close navigation menu">
              x
            </button>
          </div>
        </div>
        <nav className="mobile-drawer__nav">{renderNavLinks("mobile-nav-item")}</nav>
        <div className="mobile-drawer__footer">
          <div className="portal-user">
            <strong>{currentUser?.user?.fullName}</strong>
            <span>{currentUser?.user?.email}</span>
          </div>
          {!usesCompactShell ? (
            <div className="portal-switcher">
              {portalRoles
                .filter((portalRole) => portalRole !== role)
                .map((portalRole) => (
                  <button key={portalRole} className="portal-switcher__link" onClick={() => handleLogout(portalRole)} type="button">
                    Open {portalRole[0].toUpperCase() + portalRole.slice(1)} Portal
                  </button>
                ))}
            </div>
          ) : null}
          <button className="button button--secondary button--full" onClick={() => handleLogout(role)} type="button">Logout</button>
        </div>
      </aside>
    </>
  );
}

function PortalHeader({ title, subtitle, actions }) {
  return (
    <header className="portal-header">
      <div>
        <h1>{title}</h1>
      </div>
      {actions ? <div className="portal-header__actions">{actions}</div> : null}
    </header>
  );
}

function FocusLayout({ role, children }) {
  const navigate = useNavigate();

  return (
    <div className={`focus-layout focus-layout--${role}`}>
      <header className={`focus-topbar focus-topbar--${role}`}>
        <div className="focus-topbar__brand">
          <div className="portal-sidebar__mark">EB</div>
          <div>
            <strong>Elder Bro LMS</strong>
          </div>
        </div>
        <div className="focus-actions">
          <ThemeToggle />
          <button className="button button--secondary" onClick={() => navigate(portalDestinations[role])} type="button">
            Exit focus mode
          </button>
        </div>
      </header>
      <main className="focus-main">{children}</main>
    </div>
  );
}

function DashboardLayout({ role, children }) {
  return (
    <div className={`dashboard-layout dashboard-layout--${role}`}>
      <PortalSidebar role={role} />
      <main className={`dashboard-main dashboard-main--${role}`}>{children}</main>
    </div>
  );
}

function PortalDataLoader({ role, children }) {
  const location = useLocation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        setError("");
        const payload = await fetchJson(`/api/dashboard/${role}`);
        if (active) setData(normalizeDashboardData(role, payload));
      } catch (loadError) {
        if (active) setError(loadError.message);
      }
    }

    load();
    return () => {
      active = false;
    };
  }, [role, location.pathname]);

  if (error) return <p className="state-banner state-banner--error">{error}</p>;
  if (!data) return <p className="state-banner">Loading workspace...</p>;
  return children(data);
}

function ProtectedRoute({ role }) {
  const { isAuthenticated, isBootstrapping, currentUser } = useAuth();
  const location = useLocation();

  if (isBootstrapping) return <p className="state-banner">Loading session...</p>;
  if (!isAuthenticated) return <Navigate replace state={{ from: location }} to={`/login/${role}`} />;
  if (currentUser?.user?.role !== role) return <Navigate replace to={portalDestinations[currentUser.user.role]} />;
  return <Outlet />;
}

function LoginPage() {
  const { role = "teacher" } = useParams();
  const navigate = useNavigate();
  const { login, currentUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (currentUser?.user?.role === role) navigate(portalDestinations[role], { replace: true });
  }, [currentUser, navigate, role]);

  if (!portalRoles.includes(role)) return <Navigate replace to="/login/teacher" />;

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setError("");
      const destination = await login(role, email, password);
      navigate(destination, { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <main className={`login-screen login-screen--${role}`}>
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-card__head">
          <span className="login-card__eyebrow">Secure access</span>
          <h1>{role[0].toUpperCase() + role.slice(1)} Portal</h1>
          <p>Sign in to your live workspace.</p>
        </div>
        <label className="field">
          <span>Email</span>
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" />
        </label>
        <label className="field">
          <span>Password</span>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" />
        </label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button button--primary button--full" type="submit">Login</button>
        <div className="login-portals">
          {portalRoles.map((portalRole) => (
            <button
              key={portalRole}
              className={portalRole === role ? "login-portals__link login-portals__link--active" : "login-portals__link"}
              onClick={() => navigate(`/login/${portalRole}`)}
              type="button"
            >
              {portalRole[0].toUpperCase() + portalRole.slice(1)}
            </button>
          ))}
        </div>
        {role === "admin" ? (
          <button className="button button--secondary button--full" onClick={() => navigate("/register-school")} type="button">
            Register new school
          </button>
        ) : null}
      </form>
    </main>
  );
}

function extractGradeLevel(value) {
  const match = String(value ?? "").match(/\d+/);
  return match ? match[0] : "";
}

function getGradeSupportMeta(gradeLevel) {
  const normalized = extractGradeLevel(gradeLevel);
  return normalized === "10"
    ? { label: "Live", tone: "live" }
    : { label: "Coming soon", tone: "coming-soon" };
}

function StudentGradeComingSoon({ gradeLevel }) {
  const resolvedGrade = extractGradeLevel(gradeLevel) || "this grade";

  return (
    <>
      <PortalHeader
        title="Coming Soon"
        subtitle={`The adaptive chapter path is currently available for Class 10 only.`}
      />
      <div className="split-grid">
        <Card title={`Class ${resolvedGrade} support is coming soon`} subtitle="This student account is active, but the learning workflow for this grade has not been released yet.">
          <div className="stack-grid">
            <article className="info-tile info-tile--feature">
              <strong>What is available right now</strong>
              <p>Class 10 math mastery paths, chapter progression, assignment runner, and progress tracking.</p>
            </article>
            <article className="info-tile">
              <strong>What will happen later</strong>
              <p>When support for this grade is enabled, the student dashboard, practice flow, and progress tracking will appear here automatically.</p>
            </article>
          </div>
        </Card>
        <Card title="Current status" subtitle="Why this account is not entering the live practice flow.">
          <div className="stack-grid">
            <article className="info-tile">
              <strong>Student grade</strong>
              <p>Class {resolvedGrade}</p>
            </article>
            <article className="info-tile">
              <strong>Supported grade today</strong>
              <p>Class 10 only</p>
            </article>
          </div>
        </Card>
      </div>
    </>
  );
}

function TeacherDashboard({ data }) {
  const { availableClasses, selectedClass, setSelectedClass, classroomError } = useTeacherClassrooms(data);
  const [actionMessage, setActionMessage] = useState("");
  const dashboardState = useTeacherDashboardData(selectedClass);
  const dashboardPayload = dashboardState.data ?? {};
  const pathStudents = dashboardPayload.pathStatuses ?? [];
  const summaryCards = dashboardPayload.summaryCards ?? [];
  const chapterDistribution = dashboardPayload.chapterDistribution ?? [];
  const riskDistribution = dashboardPayload.riskDistribution ?? [];
  const milestoneDistribution = dashboardPayload.milestoneDistribution ?? [];
  const masteryHistogram = dashboardPayload.masteryHistogram ?? [];
  const chapterMasteryAverages = dashboardPayload.chapterMasteryAverages ?? [];
  const milestoneRanges = dashboardPayload.milestoneRanges ?? [];
  const selectedClassroomLabel = availableClasses.find((item) => item.id === selectedClass)?.label ?? "Selected class";

  async function handleAssign(studentIds, successMessage) {
    try {
      setActionMessage("");
      await postJson("/api/teacher/tasks/assign", {
        classroomId: selectedClass,
        studentIds
      });
      setActionMessage(successMessage);
      dashboardState.refresh();
    } catch (submitError) {
      setActionMessage(submitError.message);
    }
  }

  return (
    <>
      <PortalHeader
        title="Teacher Dashboard"
        subtitle="See where each learner is in the Class 10 chapter path and start or resume them."
        actions={
          <div className="toolbar-row">
            <select className="select" value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
              {availableClasses.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
            <button
              className="button button--primary"
              disabled={!selectedClass || pathStudents.length === 0}
              onClick={() => handleAssign(pathStudents.map((student) => student.studentId), "Class path assigned successfully.")}
              type="button"
            >
              Assign class path
            </button>
          </div>
        }
      />
      <div className="metric-row">
        {summaryCards.map((item) => <MetricCard key={item.label} label={item.label} value={item.value} />)}
      </div>
      {classroomError ? <p className="form-error">{classroomError}</p> : null}
      {dashboardState.error ? <p className="form-error">{dashboardState.error}</p> : null}
      {actionMessage ? <p className={/assigned|successfully|resumed/i.test(actionMessage) ? "form-success" : "form-error"}>{actionMessage}</p> : null}
      <div className="dashboard-grid">
        <Card title="Chapter path status" subtitle={`${selectedClassroomLabel} current learner state`}>
          {dashboardState.loading ? <p className="support-copy">Loading chapter path status...</p> : null}
          {!dashboardState.loading && pathStudents.length === 0 ? (
            <p className="support-copy">No students are integrated into this class flow yet. Create students, then assign the class path.</p>
          ) : null}
          <div className="data-table">
            <div className="data-table__head data-table__head--teacher">
              <span>Name</span><span>Current chapter</span><span>Mastery</span><span>Status</span><span>Action</span>
            </div>
            {pathStudents.map((student) => {
              const assignLabel = student.status === "not_started" ? "Assign path" : student.status === "completed" ? "Completed" : "Resume path";
              const assignDisabled = student.status === "completed";
              return (
              <div className="data-table__row data-table__row--teacher" key={student.studentId}>
                <span><strong>{student.name}</strong></span>
                <span>
                  <div>Chapter {student.currentChapterNumber ?? "-"} - {student.currentChapterName}</div>
                  <div className="inline-tags top-space--tight">
                    <span className="tag">{student.completedChaptersCount} completed</span>
                    <span className="tag">{student.currentCycleIndex} cycles</span>
                  </div>
                </span>
                <span><strong>{student.currentMastery}%</strong></span>
                <span><PathStatusBadge status={student.status} /></span>
                <span>
                  <button
                    className="button button--primary"
                    disabled={assignDisabled}
                    onClick={() => handleAssign([student.studentId], `${assignLabel} completed for ${student.name}.`)}
                    type="button"
                  >
                    {assignLabel}
                  </button>
                </span>
              </div>
            );
            })}
          </div>
        </Card>
        <Card title="Chapter distribution" subtitle="Where this class is currently working in the syllabus">
          <div className="heatmap-list">
            {chapterDistribution.map((chapter) => (
              <article className="heatmap-item" key={chapter.chapterNumber}>
                <div>
                  <strong>Chapter {chapter.chapterNumber}</strong>
                </div>
                <div className="heatmap-item__meta">
                  <span className="heatmap-band">Active</span>
                  <strong>{chapter.value}</strong>
                </div>
              </article>
            ))}
          </div>
        </Card>
      </div>
      <div className="top-space">
        <div className="split-grid">
          <DonutChart title="Path status" segments={[
            { label: "Working", value: pathStudents.filter((student) => student.status === "working").length, color: "#2563eb" },
            { label: "Stuck", value: pathStudents.filter((student) => student.status === "stuck").length, color: "#dc2626" },
            { label: "Completed", value: pathStudents.filter((student) => student.status === "completed").length, color: "#16a34a" }
          ]} totalLabel="Students" />
          <DonutChart title="Risk mix" segments={riskDistribution} totalLabel="Learners" />
        </div>
      </div>
      <div className="top-space">
        <div className="split-grid">
          <HistogramChart title="Current mastery histogram" bins={masteryHistogram} />
          <DonutChart title="Daily milestone status" segments={milestoneDistribution} totalLabel="Learners" />
        </div>
      </div>
      <div className="top-space">
        <div className="split-grid">
          <BarChart title="Average mastery by active chapter" items={chapterMasteryAverages.length ? chapterMasteryAverages : [{ label: "No live data", value: 0, color: "#94a3b8" }]} suffix="%" />
          <MilestoneChart title="Student milestone range" items={milestoneRanges.length ? milestoneRanges : [{ label: "No live data", start: 0, current: 0, goal: 0 }]} />
        </div>
      </div>
    </>
  );
}

function ParentHome({ data }) {
  const assignmentSegments = (data.assignmentOverview ?? []).map((item) => ({
    ...item,
    color:
      item.label === "Completed"
        ? "#16a34a"
        : item.label === "In progress"
          ? "#f59e0b"
          : "#2563eb"
  }));

  return (
    <>
      <PortalHeader title="Parent Dashboard" subtitle="See the same assignment and progress signals that drive teacher action." />
      <div className="metric-row">
        {(data.summaryCards ?? []).map((item) => (
          <MetricCard key={item.label} label={item.label} value={item.value} />
        ))}
      </div>
      <div className="split-grid top-space">
        <Card title="Children overview" subtitle="Current concept, assignment state, and recent performance per learner.">
          {!(data.linkedStudents ?? []).length ? <p className="support-copy">No linked students yet.</p> : null}
          <div className="data-table">
            <div className="data-table__head data-table__head--parent-students">
              <span>Student</span>
              <span>Current concept</span>
              <span>Assignment</span>
              <span>Mastery</span>
              <span>Latest score</span>
            </div>
            {(data.linkedStudents ?? []).map((student) => (
              <div className="data-table__row data-table__row--parent-students" key={student.id}>
                <span className="review-list__student">
                  <strong>{student.name}</strong>
                  <small className="support-copy">Grade {student.gradeLevel || "-"}</small>
                </span>
                <span className="review-list__focus">
                  <strong>{student.currentConcept}</strong>
                  <small className="support-copy">{student.summary}</small>
                </span>
                <span className="review-list__status">
                  <AssignmentStateBadge status={student.latestAssignmentStatus} />
                  <small className="support-copy">
                    {student.assignedForDate ? `Assigned for ${student.assignedForDate}` : "No active assignment"}
                  </small>
                </span>
                <span>
                  <strong>{student.averageMastery}%</strong>
                  <small className="support-copy">
                    {student.dailyMasteryGoal > student.dailyMasteryStart
                      ? `Today's target: ${student.dailyMasteryStart}% -> ${student.dailyMasteryGoal}%${student.dailyTargetDate ? ` / ${student.dailyTargetDate}` : ""}`
                      : student.weakConcepts?.length
                        ? `Watch: ${student.weakConcepts.map((item) => item.concept).join(", ")}`
                        : "No weak concept flagged"}
                  </small>
                </span>
                <span>{student.lastScore == null ? "No recent score" : `${student.lastScore}%`}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Suggested support" subtitle="Narratives and prompts aligned to each child's current learning state.">
          <ul className="simple-list">
            {(data.suggestions ?? []).map((item, index) => (
              <li key={`${item}-${index}`}>{item}</li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="split-grid top-space">
        <DonutChart title="Assignment status" segments={assignmentSegments} totalLabel="Children" />
        <BarChart title="Mastery by student" items={data.progressByStudent ?? []} suffix="%" />
      </div>
      <div className="split-grid top-space">
        <Card title="Weak concept watchlist">
          <ul className="simple-list">
            {(data.weakAreas ?? []).map((item, index) => (
              <li key={`${item.studentId}-${item.concept}-${index}`}>
                {item.studentName}: {item.concept} - {item.mastery}%
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Recent progress">
          <ul className="simple-list">
            {(data.dailyProgress ?? []).map((item, index) => (
              <li key={`${item.studentId ?? item.title}-${index}`}>
                {item.studentName}: {item.title} - {item.score}% ({formatLastActive(item.createdAt)})
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

function TeacherClassroom({ data }) {
  return (
    <>
      <PortalHeader title="Classroom" subtitle="Track roster health and day-to-day classroom status." />
      <TeacherStudentManager />
      <div className="split-grid top-space">
        <Card title="Roster">
          <div className="data-table">
            <div className="data-table__head"><span>Name</span><span>Attendance</span><span>Mastery</span><span>Status</span></div>
            {data.roster.map((student) => (
              <div className="data-table__row" key={student.name}>
                <span>{student.name}</span><span>{student.attendance}%</span><span>{student.mastery}%</span><span>{student.status}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Weekly plan">
          <div className="compact-list">
            {data.weekPlan.map((item) => (
              <article className="compact-list__item" key={item.day}>
                <strong>{item.day}</strong>
                <div><p>{item.focus}</p><span>{item.note}</span></div>
              </article>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function TeacherPracticeReviewPage({ data }) {
  return (
    <>
      <PortalHeader
        title="Practice Review"
        subtitle="Review generated practice, inspect the source references, and assign only what looks right."
      />
      <TeacherPracticeReviewManager data={data} />
    </>
  );
}

function TeacherReports({ data }) {
  const { availableClasses, selectedClass, setSelectedClass, classroomError } = useTeacherClassrooms(data);
  const reportState = useTeacherReportsData(selectedClass);
  const { data: insightPayload, loading: insightLoading, error: insightError } = useApiData(
    () => (selectedClass ? fetchJson(`/api/teacher/insights/students?classroomId=${encodeURIComponent(selectedClass)}`) : Promise.resolve({ students: [] })),
    [selectedClass]
  );
  const { data: aiStatus } = useApiData(() => fetchJson("/api/ai/status"), []);
  const report = reportState.data;

  return (
    <>
      <PortalHeader
        title="Reports"
        subtitle="Quick readouts of intervention impact and activity."
        actions={
          <select className="select" value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
            {availableClasses.map((item) => (
              <option key={item.id} value={item.id}>{item.label}</option>
            ))}
          </select>
        }
      />
      {reportState.loading ? <p className="state-banner">Loading reports...</p> : null}
      {insightLoading ? <p className="support-copy">Refreshing AI-backed student insights...</p> : null}
      {classroomError ? <p className="form-error">{classroomError}</p> : null}
      {reportState.error ? <p className="form-error">{reportState.error}</p> : null}
      {insightError ? <p className="form-error">{insightError}</p> : null}
      {aiStatus ? (
        <div className="top-space">
          <Card title="AI enhancement status" subtitle="This controls OpenAI-powered rewrites, hints, and narrative insights.">
            <div className="inline-tags">
              <span className="tag">{aiStatus.enabled ? "Enhanced generation on" : "Rules-only mode"}</span>
              <span className="tag">Variant: {aiStatus.models.variant}</span>
              <span className="tag">Insight: {aiStatus.models.insight}</span>
            </div>
          </Card>
        </div>
      ) : null}
      <div className="split-grid">
        <Card title="Intervention summary">
          <div className="metric-row metric-row--two">
            {(report?.metrics ?? []).map((item) => (
              <MetricCard key={item.label} label={item.label} value={item.value} />
            ))}
          </div>
        </Card>
        <Card title="Concept focus areas">
          <ul className="simple-list">
            {(report?.interventionBreakdown ?? []).map((concept) => (
              <li key={concept.concept ?? concept.name}>
                {(concept.concept ?? concept.name)}: {concept.flagged ?? concept.studentsFlagged} students flagged
              </li>
            ))}
          </ul>
        </Card>
      </div>
      <div className="top-space">
        <div className="split-grid">
          <BarChart
            title="Intervention breakdown by concept"
            items={(report?.interventionBreakdown ?? []).map((item) => ({
              label: item.concept,
              value: item.flagged,
              color: "#2563eb"
            }))}
          />
          <BarChart
            title="Student growth"
            items={(report?.studentGrowth ?? []).map((item) => ({
              label: item.name,
              value: item.improvement,
              color: item.improvement > 0 ? "#16a34a" : "#dc2626"
            }))}
            suffix="%"
          />
        </div>
      </div>
      <div className="top-space">
        <div className="split-grid">
          <LineChart title="Recent submission trend" points={report?.submissionTrend ?? []} suffix="%" />
          <DonutChart title="Risk distribution" segments={report?.riskDistribution ?? []} totalLabel="Students" />
        </div>
      </div>
      <div className="top-space">
        <HistogramChart title="Mastery spread" bins={report?.masteryBands ?? [{ label: "No data", value: 0 }]} />
      </div>
      <div className="top-space">
        <Card title="Student insight feed" subtitle="Narratives stay grounded in mastery, pace, and completion telemetry.">
          <div className="compact-list">
            {(insightPayload?.students ?? []).slice(0, 8).map((student) => (
              <article className="compact-list__item" key={student.studentId}>
                <strong>{student.name}</strong>
                <div>
                  <p>{student.summary}</p>
                  <div className="inline-tags top-space--tight">
                    {(student.tags ?? []).map((tag) => <span className="tag" key={`${student.studentId}-${tag}`}>{tag}</span>)}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Card>
      </div>
      <div className="top-space">
        <Card title="Student growth" subtitle="Baseline-to-current improvement by learner.">
          <div className="data-table">
            <div className="data-table__head"><span>Student</span><span>Risk</span><span>Improvement</span><span>Actionability</span></div>
            {(report?.studentGrowth ?? []).map((student) => (
              <div className="data-table__row" key={student.name}>
                <span>{student.name}</span>
                <span><StatusBadge risk={student.risk} /></span>
                <span>{student.improvement}%</span>
                <span>{student.improvement > 0 ? "Improving" : "Needs more support"}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function AdminDashboard({ data }) {
  const { items: teachers } = useResource("/api/teachers");
  const { items: classrooms } = useResource("/api/classrooms");
  const { items: students } = useResource("/api/students");
  const chapterItems = (data.chapterDistribution ?? []).map((item) => ({
    label: `Ch ${item.chapterNumber || 0}`,
    value: item.value,
    color: "#2563eb"
  }));
  const riskSegments = (data.riskDistribution ?? []).map((item) => ({
    ...item,
    color: item.label === "High" ? "#dc2626" : item.label === "Medium" ? "#f59e0b" : "#16a34a"
  }));
  const milestoneSegments = (data.milestoneDistribution ?? []).map((item) => ({
    ...item,
    color: item.label === "Behind target" ? "#dc2626" : item.label === "Reached today" ? "#16a34a" : "#2563eb"
  }));
  const attentionStudents = (data.students ?? [])
    .filter((student) => student.status === "stuck" || ["medium", "high"].includes(student.riskLevel))
    .slice(0, 8);
  const pulseHighlights = (data.pulse ?? []).slice(0, 4);

  return (
    <>
      <StoryHero
        tone="admin"
        eyebrow="School command center"
        title="Live rollout, risk, and mastery at a glance"
        subtitle="Track how the Class 10 engine is spreading across classrooms and where school-level intervention is needed."
      >
        <div className="inline-tags">
          <span className="tag">{teachers.length} teachers</span>
          <span className="tag">{classrooms.length} classrooms</span>
          <span className="tag">{students.length} students</span>
        </div>
      </StoryHero>
      <div className="accent-metrics top-space">
        {(data.summaryCards ?? []).map((item, index) => (
          <AccentMetric
            className="accent-metric--admin"
            key={item.label}
            label={item.label}
            value={item.value}
            tone={["green", "blue", "orange", "purple"][index % 4]}
          />
        ))}
      </div>
      <div className="play-grid play-grid--admin top-space">
        <section className="play-panel play-panel--feature play-panel--admin">
          <div className="play-panel__head">
            <div>
              <h2>School pulse</h2>
              <p>Signals worth noticing right now.</p>
            </div>
          </div>
          <div className="pulse-grid">
            {pulseHighlights.map((item) => (
              <article className="pulse-card" key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.detail}</p>
              </article>
            ))}
            <article className="pulse-card pulse-card--strong">
              <strong>Current footprint</strong>
              <p>{teachers.length} teachers, {classrooms.length} classrooms, and {students.length} students are active inside this school workspace.</p>
            </article>
          </div>
        </section>
        <section className="play-panel play-panel--admin">
          <div className="play-panel__head">
            <div>
              <h2>Learners to watch</h2>
              <p>Students who need school-level attention soon.</p>
            </div>
          </div>
          {!attentionStudents.length ? <p className="support-copy">No students currently need school-level escalation.</p> : null}
          <div className="watch-grid">
            {attentionStudents.map((student) => (
              <article className="watch-card" key={student.studentId}>
                <div className="watch-card__head">
                  <strong>{student.name}</strong>
                  <StatusBadge risk={student.riskLabel ?? "Low"} />
                </div>
                <p>{student.classroomName || "Unassigned"} · Chapter {student.currentChapterNumber ?? "-"} · {student.currentChapterName || "Not started"}</p>
                <div className="inline-tags">
                  {(student.dailyMasteryGoal ?? 0) > (student.dailyMasteryStart ?? 0)
                    ? <span className="tag">{`${student.dailyMasteryStart}% -> ${student.dailyMasteryGoal}%`}</span>
                    : null}
                  {student.dailyTargetDate ? <span className="tag">{student.dailyTargetDate}</span> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <div className="play-grid play-grid--admin-charts top-space">
        <BarChart title="Chapter progression" items={chapterItems.length ? chapterItems : [{ label: "No live data", value: 0, color: "#94a3b8" }]} className="admin-chart-card" />
        <DonutChart title="Risk distribution" segments={riskSegments} totalLabel="Students" />
        <DonutChart title="Daily milestone status" segments={milestoneSegments} totalLabel="Students" />
      </div>
      {data.insightSummary ? (
        <section className="play-panel play-panel--admin top-space">
          <div className="play-panel__head">
            <div>
              <h2>System insight summary</h2>
              <p>Narrative rollup grounded in live telemetry across the school.</p>
            </div>
          </div>
          <p className="support-copy">{data.insightSummary}</p>
          <div className="inline-tags top-space">
            {(data.insightHighlights ?? []).map((item) => <span className="tag" key={item}>{item}</span>)}
          </div>
        </section>
      ) : null}
    </>
  );
}

function AdminSchools({ data }) {
  const { items: teachers, error: teacherError } = useResource("/api/teachers");
  const { items: classrooms, error: classroomError } = useResource("/api/classrooms");
  const { items: students, error: studentError } = useResource("/api/students");
  const classroomRollup = data.classroomRollup ?? [];
  const schoolRecord = data.schools?.[0] ?? null;
  const teacherNameById = new Map(teachers.map((teacher) => [String(teacher._id), teacher.fullName]));
  const liveStudents = students.filter((student) => extractGradeLevel(student.gradeLevel) === "10").length;
  const comingSoonStudents = Math.max(students.length - liveStudents, 0);
  const unsupportedClassrooms = classrooms.filter((classroom) => extractGradeLevel(classroom.gradeLevel) !== "10");
  const teacherCoverage = teachers.map((teacher) => {
    const teacherClassrooms = classrooms.filter((classroom) => String(classroom.teacherId) === String(teacher._id));
    const classroomIds = new Set(teacherClassrooms.map((classroom) => String(classroom._id)));
    const teacherStudents = students.filter((student) => classroomIds.has(String(student.classroomId ?? "")));
    const behindCount = classroomRollup
      .filter((item) => classroomIds.has(String(item.classroomId ?? "")))
      .reduce((sum, item) => sum + (item.behind ?? 0), 0);

    return {
      id: teacher._id,
      name: teacher.fullName,
      email: teacher.email,
      classrooms: teacherClassrooms.length,
      students: teacherStudents.length,
      behind: behindCount
    };
  });
  const learnerWatch = (data.students ?? [])
    .slice()
    .sort((left, right) => {
      const leftOrder = left.riskLevel === "high" ? 0 : left.riskLevel === "medium" ? 1 : 2;
      const rightOrder = right.riskLevel === "high" ? 0 : right.riskLevel === "medium" ? 1 : 2;
      return leftOrder - rightOrder;
    })
    .slice(0, 12);

  return (
    <>
      <StoryHero
        tone="admin"
        eyebrow="School ops"
        title="Teachers, classrooms, and launch readiness in one place"
        subtitle="Manage the live Class 10 rollout while keeping future grades visible as coming soon."
      >
        <div className="inline-tags">
          <span className="tag">{schoolRecord?.name ?? "School workspace"}</span>
          <span className="tag">Class 10 live: {liveStudents}</span>
          <span className="tag">Coming soon: {comingSoonStudents}</span>
        </div>
      </StoryHero>
      <div className="accent-metrics top-space">
        <AccentMetric className="accent-metric--admin" tone="green" label="Teachers" value={String(teachers.length)} />
        <AccentMetric className="accent-metric--admin" tone="blue" label="Classrooms" value={String(classrooms.length)} />
        <AccentMetric className="accent-metric--admin" tone="purple" label="Class 10 live" value={String(liveStudents)} />
        <AccentMetric className="accent-metric--admin" tone="orange" label="Coming soon grades" value={String(comingSoonStudents)} />
      </div>
      {teacherError ? <p className="form-error">{teacherError}</p> : null}
      {classroomError ? <p className="form-error">{classroomError}</p> : null}
      {studentError ? <p className="form-error">{studentError}</p> : null}
      <div className="play-grid play-grid--admin top-space">
        <section className="play-panel play-panel--admin">
          <div className="play-panel__head">
            <div>
              <h2>School readiness</h2>
              <p>What is live now and what still needs setup.</p>
            </div>
          </div>
          <div className="pulse-grid">
            <article className="pulse-card">
              <strong>{schoolRecord?.name ?? "School workspace"}</strong>
              <p>{schoolRecord?.nextStep ?? "Monitor classrooms and teachers against the live chapter progression engine."}</p>
            </article>
            <article className="pulse-card">
              <strong>Grade support</strong>
              <p>Class 10 is live. Other grades stay visible to admin, but the learner path remains in coming-soon mode.</p>
            </article>
            <article className="pulse-card">
              <strong>Teacher coverage</strong>
              <p>{teacherCoverage.filter((teacher) => teacher.classrooms === 0).length} teachers still need at least one classroom assigned.</p>
            </article>
          </div>
        </section>
        <section className="play-panel play-panel--admin">
          <div className="play-panel__head">
            <div>
              <h2>Classroom rollout</h2>
              <p>Class status and milestone health.</p>
            </div>
          </div>
          {!classroomRollup.length ? <p className="support-copy">No classrooms have live path data yet.</p> : null}
          <div className="watch-grid">
            {classroomRollup.map((classroom) => (
              <article className="watch-card" key={`${classroom.classroomId ?? classroom.classroomName}`}>
                <div className="watch-card__head">
                  <strong>{classroom.classroomName}</strong>
                  <span className="tag">{getGradeSupportMeta(classroom.gradeLevel).label}</span>
                </div>
                <p>{teacherNameById.get(String(classrooms.find((item) => String(item._id) === String(classroom.classroomId))?.teacherId ?? "")) ?? "Unassigned teacher"}</p>
                <div className="inline-tags">
                  <span className="tag">{classroom.students} students</span>
                  <span className="tag">{classroom.behind} behind</span>
                  <span className="tag">{classroom.averageMastery}% avg mastery</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
      <div className="top-space">
        <Card title="Teacher coverage" subtitle="Teacher load across classrooms and students.">
          {!teacherCoverage.length ? <p className="support-copy">No teachers added yet.</p> : null}
          <div className="data-table">
            <div className="data-table__head data-table__head--admin"><span>Teacher</span><span>Email</span><span>Classrooms</span><span>Students</span><span>Behind target</span></div>
            {teacherCoverage.map((teacher) => (
              <div className="data-table__row data-table__row--admin" key={teacher.id}>
                <span>{teacher.name}</span>
                <span>{teacher.email}</span>
                <span>{teacher.classrooms}</span>
                <span>{teacher.students}</span>
                <span>{teacher.behind}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
      <div className="top-space">
        <AdminTeacherManager />
      </div>
      <div className="top-space">
        <AdminClassroomManager />
      </div>
      <div className="play-grid play-grid--admin top-space">
        <section className="play-panel play-panel--admin">
          <div className="play-panel__head">
            <div>
              <h2>Learner watchlist</h2>
              <p>Students who are active, behind, or outside the live scope.</p>
            </div>
          </div>
          {!learnerWatch.length ? <p className="support-copy">No learners are available yet.</p> : null}
          <div className="watch-grid">
            {learnerWatch.map((student) => (
              <article className="watch-card" key={student.studentId}>
                <div className="watch-card__head">
                  <strong>{student.name}</strong>
                  <StatusBadge risk={student.riskLabel ?? "Low"} />
                </div>
                <p>{student.classroomName || "Unassigned"} · Grade {student.gradeLevel || "-"}</p>
                <small className="support-copy">Chapter {student.currentChapterNumber ?? "-"} · {student.currentChapterName || "Not started"}</small>
                <div className="inline-tags">
                  {(student.dailyMasteryGoal ?? 0) > (student.dailyMasteryStart ?? 0)
                    ? <span className="tag">{`${student.dailyMasteryStart}% -> ${student.dailyMasteryGoal}%`}</span>
                    : null}
                  {student.dailyTargetDate ? <span className="tag">{student.dailyTargetDate}</span> : null}
                  <span className="tag">{getGradeSupportMeta(student.gradeLevel).label}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="play-panel play-panel--admin">
          <div className="play-panel__head">
            <div>
              <h2>Unsupported grades</h2>
              <p>Visible to admin while student experience stays in coming-soon mode.</p>
            </div>
          </div>
          {!unsupportedClassrooms.length ? <p className="support-copy">All classrooms are currently inside the supported Class 10 launch scope.</p> : null}
          <div className="journey-list">
            {unsupportedClassrooms.map((classroom) => (
              <article className="journey-item" key={classroom._id}>
                <div>
                  <strong>{classroom.name}</strong>
                  <p>Grade {classroom.gradeLevel}</p>
                </div>
                <div className="inline-tags">
                  <span className="tag">{teacherNameById.get(String(classroom.teacherId)) ?? "Assign a teacher"}</span>
                  <span className="tag">Coming soon</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function AdminReports({ data }) {
  const { data: aiStatus } = useApiData(() => fetchJson("/api/ai/status"), []);
  const chapterBins = (data.chapterDistribution ?? []).map((item) => ({
    label: `Ch ${item.chapterNumber || 0}`,
    value: item.value
  }));
  const riskSegments = (data.riskDistribution ?? []).map((item) => ({
    ...item,
    color: item.label === "High" ? "#dc2626" : item.label === "Medium" ? "#f59e0b" : "#16a34a"
  }));
  const milestoneSegments = (data.milestoneDistribution ?? []).map((item) => ({
    ...item,
    color: item.label === "Behind target" ? "#dc2626" : item.label === "Reached today" ? "#16a34a" : "#2563eb"
  }));
  const escalations = (data.students ?? [])
    .filter((student) => student.status === "stuck" || ["medium", "high"].includes(student.riskLevel))
    .slice(0, 10);

  return (
    <>
      <StoryHero
        tone="admin"
        eyebrow="School reports"
        title="Progress, milestone health, and escalation signals"
        subtitle="A cleaner read of what is improving, what is slowing down, and where admin attention is still needed."
      >
        {aiStatus ? (
          <div className="inline-tags">
            <span className="tag">{aiStatus.configured ? "AI configured" : "API key missing"}</span>
            <span className="tag">{aiStatus.enabled ? "Enhanced mode on" : "Enhanced mode off"}</span>
            <span className="tag">{aiStatus.models.variant}</span>
          </div>
        ) : null}
      </StoryHero>
      <div className="accent-metrics top-space">
        {(data.metrics ?? []).map((item, index) => (
          <AccentMetric
            className="accent-metric--admin"
            key={item.label}
            label={item.label}
            value={item.value}
            tone={["blue", "green", "orange", "purple"][index % 4]}
          />
        ))}
      </div>
      {aiStatus ? (
        <section className="play-panel play-panel--admin top-space">
          <div className="play-panel__head">
            <div>
              <h2>AI system status</h2>
              <p>Rewrites, hints, and insight generation depend on this setup.</p>
            </div>
          </div>
          <div className="inline-tags">
            <span className="tag">{aiStatus.configured ? "API key configured" : "API key missing"}</span>
            <span className="tag">{aiStatus.enabled ? "Enhanced mode enabled" : "Enhanced mode disabled"}</span>
            <span className="tag">{aiStatus.models.variant}</span>
          </div>
        </section>
      ) : null}
      <div className="play-grid play-grid--admin-charts top-space">
        <HistogramChart title="Chapter distribution" bins={chapterBins.length ? chapterBins : [{ label: "No data", value: 0 }]} className="admin-chart-card" />
        <DonutChart title="Risk distribution" segments={riskSegments} totalLabel="Students" />
        <DonutChart title="Daily milestone status" segments={milestoneSegments} totalLabel="Students" />
      </div>
      <div className="play-grid play-grid--admin top-space">
        <section className="play-panel play-panel--admin">
          <div className="play-panel__head">
            <div>
              <h2>Operational insight summary</h2>
              <p>Narrative summary grounded in the current school telemetry.</p>
            </div>
          </div>
          <p className="support-copy">{data.insightSummary || "No rollup summary available yet."}</p>
          <div className="inline-tags top-space">
            {(data.insightHighlights ?? []).map((item) => <span className="tag" key={item}>{item}</span>)}
          </div>
        </section>
        <section className="play-panel play-panel--admin">
          <div className="play-panel__head">
            <div>
              <h2>Students behind target</h2>
              <p>Learners who need school-level follow-up.</p>
            </div>
          </div>
          {!escalations.length ? <p className="support-copy">No students currently need admin escalation.</p> : null}
          <div className="watch-grid">
            {escalations.map((student) => (
              <article className="watch-card" key={student.studentId}>
                <div className="watch-card__head">
                  <strong>{student.name}</strong>
                  <StatusBadge risk={student.riskLabel ?? "Low"} />
                </div>
                <p>{student.classroomName || "Unassigned"} · Chapter {student.currentChapterNumber ?? "-"} · {student.currentChapterName || "Not started"}</p>
                <small className="support-copy">{student.riskReason || "Needs closer review."}</small>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function StudentHome({ data }) {
  const homeState = useStudentHomeData();
  const pageData = homeState.data ?? {};
  const masteryItems = pageData.mastery ?? [];
  const averageMastery = Math.round(masteryItems.reduce((sum, item) => sum + item.mastery, 0) / Math.max(masteryItems.length, 1));
  const navigate = useNavigate();
  const assignmentSummary = pageData.assignmentSummary ?? null;
  const activeTask = pageData.todayTask ?? null;
  const latestBatch = pageData.latestBatch ?? null;
  const learningPath = pageData.learningPath ?? {};
  const analytics = pageData.analytics ?? {};
  const [actionError, setActionError] = useState("");
  const [isContinuing, setIsContinuing] = useState(false);
  const ladder = learningPath.chapterLadder ?? [];
  const { currentChapter, upcomingChapter } = getChapterPointers(ladder, learningPath.currentChapterNumber);
  const displayPathStatus = getDisplayPathStatus(learningPath);
  const currentChapterNumber = currentChapter?.chapterNumber ?? assignmentSummary?.chapterNumber ?? activeTask?.chapterNumber ?? learningPath.currentChapterNumber ?? 1;
  const currentChapterName = currentChapter?.name ?? activeTask?.concept?.name ?? learningPath.currentChapterName ?? "Current chapter";
  const currentMastery = Math.round(learningPath.currentMastery ?? averageMastery);
  const dailyMasteryStart = Number(learningPath.dailyMasteryStart ?? assignmentSummary?.dailyMasteryStart ?? currentMastery);
  const dailyMasteryGoal = Number(learningPath.dailyMasteryGoal ?? assignmentSummary?.dailyMasteryGoal ?? 0);
  const dailyTargetDate = learningPath.dailyTargetDate ?? assignmentSummary?.dailyTargetDate ?? "";
  const nextChapterLabel = upcomingChapter ? `Chapter ${upcomingChapter.chapterNumber}` : learningPath.status === "completed" ? "Completed" : "Locked";
  const cleanedRecentResults = (pageData.recentResults ?? [])
    .filter((item) => !String(item.title ?? "").toLowerCase().includes("diagnostic"))
    .slice(0, 3);
  const recentScoreSeries = analytics.recentScoreSeries ?? [];
  const milestoneProgress = [{
    key: "today",
    label: "Today",
    start: dailyMasteryStart,
    current: currentMastery,
    goal: dailyMasteryGoal > dailyMasteryStart ? dailyMasteryGoal : assignmentSummary?.masteryTarget ?? 80
  }];
  const strongestTopic = masteryItems.length
    ? masteryItems.reduce((best, item) => (item.mastery > best.mastery ? item : best), masteryItems[0])
    : null;
  const focusTopic = masteryItems.length
    ? masteryItems.reduce((lowest, item) => (item.mastery < lowest.mastery ? item : lowest), masteryItems[0])
    : null;
  const milestoneCompletedToday = Boolean(learningPath.milestoneCompletedToday || learningPath.dailyTargetStatus === "reached");
  const canContinuePractice = Boolean(learningPath.canContinuePractice);
  const chapterStatusCopy =
    learningPath.status === "completed"
      ? "You have completed the full Class 10 chapter path."
      : milestoneCompletedToday && !activeTask
        ? `Today's milestone is complete for Chapter ${currentChapterNumber}. You can continue practicing to push mastery higher.`
      : `Stay on Chapter ${currentChapterNumber} until mastery reaches ${assignmentSummary?.masteryTarget ?? 80}% and the checkpoint is passed.`;
  const launchLabel = activeTask?.assignmentId ? "Continue assignment" : canContinuePractice ? "Continue practice" : "Open practice";
  const dailyMilestoneCopy =
    dailyMasteryGoal > dailyMasteryStart
      ? `Today's milestone: ${dailyMasteryStart}% -> ${dailyMasteryGoal}%`
      : `Today's milestone: reach ${assignmentSummary?.masteryTarget ?? 80}%`;
  const heroCopy = pageData.studentInsight?.summary || pageData.coachNote || chapterStatusCopy;

  async function handleLaunch() {
    try {
      setActionError("");
      if (activeTask?.assignmentId) {
        navigate(`/student/practice/${activeTask.assignmentId}`);
        return;
      }
      if (canContinuePractice) {
        setIsContinuing(true);
        const payload = await postJson("/api/student/tasks/continue", {});
        if (payload.task?.assignmentId) {
          navigate(`/student/practice/${payload.task.assignmentId}`, {
            state: {
              nextTask: payload.task,
              message: "Extra practice is ready for the same chapter."
            }
          });
          return;
        }
      }
      navigate("/student/practice");
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsContinuing(false);
    }
  }

  return (
    <>
      <StoryHero
        tone="student"
        eyebrow="Daily math mission"
        title={`Chapter ${currentChapterNumber} · ${currentChapterName}`}
        subtitle={heroCopy}
        action={
          <button
            className="button button--primary"
            disabled={isContinuing}
            onClick={handleLaunch}
            type="button"
          >
            {isContinuing ? "Opening..." : launchLabel}
          </button>
        }
      >
        <div className="inline-tags">
          <AssignmentStateBadge status={assignmentSummary?.status ?? displayPathStatus} />
          <span className="tag">{assignmentSummary?.itemsCount ?? activeTask?.items?.length ?? 0} questions</span>
          <span className="tag">Difficulty {assignmentSummary?.targetDifficulty ?? activeTask?.targetDifficulty ?? 1}</span>
          <span className="tag">{dailyMilestoneCopy}</span>
          {dailyTargetDate ? <span className="tag">For {dailyTargetDate}</span> : null}
        </div>
      </StoryHero>
      {homeState.error ? <p className="form-error top-space">{homeState.error}</p> : null}
      {actionError ? <p className="form-error top-space">{actionError}</p> : null}
      {homeState.loading ? <p className="support-copy top-space">Loading student dashboard...</p> : null}
      <div className="accent-metrics accent-metrics--three top-space">
        <AccentMetric tone="blue" label="Current mastery" value={`${currentMastery}%`} meta={`Chapter ${currentChapterNumber}`} />
        <AccentMetric
          tone="green"
          label="Today's goal"
          value={milestoneCompletedToday ? "Done" : `${dailyMasteryGoal > dailyMasteryStart ? dailyMasteryGoal : assignmentSummary?.masteryTarget ?? 80}%`}
          meta={milestoneCompletedToday ? "Milestone completed" : dailyMilestoneCopy}
        />
        <AccentMetric
          tone="orange"
          label="Next unlock"
          value={upcomingChapter ? upcomingChapter.name : nextChapterLabel}
          meta={upcomingChapter ? `Chapter ${upcomingChapter.chapterNumber}` : "Keep mastering this chapter"}
        />
      </div>
      <div className="play-grid play-grid--home top-space">
        <section className="play-panel play-panel--feature">
          <div className="play-panel__head">
            <div>
              <h2>Today's mission</h2>
              <p>One clear step at a time until the chapter unlocks.</p>
            </div>
            <AssignmentStateBadge status={assignmentSummary?.status ?? displayPathStatus} />
          </div>
          <div className="mission-card">
            <div className="mission-card__copy">
              <strong>Stay with {currentChapterName}</strong>
              <p>{chapterStatusCopy}</p>
              <div className="inline-tags">
                <span className="tag">{milestoneCompletedToday ? "Milestone completed" : "Milestone live"}</span>
                <span className="tag">{learningPath.completedChaptersCount ?? 0} chapters cleared</span>
                <span className="tag">{learningPath.totalChapters ?? ladder.length} in path</span>
              </div>
            </div>
            <div className="mission-card__stack">
              <article className="spark-card spark-card--violet">
                <span>Strongest spark</span>
                <strong>{strongestTopic?.concept ?? "Building now"}</strong>
                <small>{strongestTopic ? `${strongestTopic.mastery}% mastery` : "Keep practicing to light this up."}</small>
              </article>
              <article className="spark-card spark-card--orange">
                <span>Focus next</span>
                <strong>{focusTopic?.concept ?? currentChapterName}</strong>
                <small>{focusTopic ? `${focusTopic.mastery}% mastery` : "This chapter will guide the focus."}</small>
              </article>
            </div>
          </div>
        </section>
        <section className="play-panel">
          <div className="play-panel__head">
            <div>
              <h2>Journey map</h2>
              <p>See where you are now and what opens next.</p>
            </div>
            <PathStatusBadge status={displayPathStatus} />
          </div>
          <div className="journey-map">
            <article className="journey-map__card journey-map__card--current">
              <span className="journey-map__eyebrow">Current chapter</span>
              <strong>Chapter {currentChapterNumber} · {currentChapterName}</strong>
              <p>{milestoneCompletedToday ? "Today's milestone is locked in." : "This chapter stays active until mastery and checkpoint are both cleared."}</p>
            </article>
            <article className="journey-map__card">
              <span className="journey-map__eyebrow">Next unlock</span>
              <strong>{upcomingChapter ? `Chapter ${upcomingChapter.chapterNumber} · ${upcomingChapter.name}` : "Final unlock pending"}</strong>
              <p>{upcomingChapter ? "It opens automatically when this chapter is mastered." : "Keep pushing the current chapter to reveal the next step."}</p>
            </article>
          </div>
        </section>
      </div>
      <div className="play-grid play-grid--home-bottom top-space">
        <section className="play-panel">
          <div className="play-panel__head">
            <div>
              <h2>Chapter trail</h2>
              <p>Your Class 10 path, one unlock at a time.</p>
            </div>
          </div>
          <div className="journey-list journey-list--scroll">
            {ladder.map((chapter) => (
              <article className={`journey-item ${chapter.current ? "journey-item--current" : ""}`.trim()} key={chapter.code}>
                <div>
                  <strong>Chapter {chapter.chapterNumber} · {chapter.name}</strong>
                  <p>{chapter.mastery}% mastery</p>
                </div>
                <div className="inline-tags">
                  {chapter.current ? <span className="tag">Current</span> : null}
                  {chapter.completed ? <span className="tag">Done</span> : null}
                  {chapter.locked ? <span className="tag">Locked</span> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
        <section className="play-panel">
          <div className="play-panel__head">
            <div>
              <h2>Progress pulse</h2>
              <p>Batch scores and mastery goals stay separate here.</p>
            </div>
          </div>
          <div className="play-stack">
            <LineChart
              title="Batch score trend"
              points={recentScoreSeries.length ? recentScoreSeries : [{ label: "Now", value: currentMastery }]}
              suffix="%"
            />
            <MilestoneChart title="Milestone progress" items={milestoneProgress} />
            <div className="achievement-stack">
            {(cleanedRecentResults.length ? cleanedRecentResults : (pageData.recentResults ?? []).slice(0, 3)).map((item, index) => (
              <article className="achievement-card" key={item.id ?? item.createdAt ?? `${item.title}-${index}`}>
                <div>
                  <strong>{item.title}</strong>
                  <p>{item.score}</p>
                </div>
                <span>{formatLastActive(item.createdAt ?? item.date ?? "")}</span>
              </article>
            ))}
            {!cleanedRecentResults.length && !(pageData.recentResults ?? []).length ? (
              <article className="achievement-card achievement-card--empty">
                <div>
                  <strong>Your streak starts here</strong>
                  <p>Finish a batch to light up your first result card.</p>
                </div>
              </article>
            ) : null}
            {!activeTask && latestBatch ? (
              <article className="achievement-card achievement-card--soft">
                <div>
                  <strong>Latest batch recap</strong>
                  <p>Chapter {latestBatch.chapterNumber} · {latestBatch.itemsCount} items · Difficulty {latestBatch.targetDifficulty}</p>
                </div>
              </article>
            ) : null}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

function StudentPractice({ data }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [actionError, setActionError] = useState("");
  const [isContinuing, setIsContinuing] = useState(false);
  const assignmentState = useStudentAssignmentData();
  const pageData = assignmentState.data ?? {};
  const todayTask = pageData.task ?? null;
  const learningPath = pageData.learningPath ?? {};
  const ladder = learningPath.chapterLadder ?? [];
  const { currentChapter, upcomingChapter } = getChapterPointers(ladder, learningPath.currentChapterNumber);
  const displayPathStatus = getDisplayPathStatus(learningPath);
  const flashMessage = location.state?.message ?? "";
  const canContinuePractice = Boolean(learningPath.canContinuePractice);
  const milestoneCompletedToday = Boolean(learningPath.milestoneCompletedToday || learningPath.dailyTargetStatus === "reached");

  async function handleContinuePractice() {
    try {
      setActionError("");
      setIsContinuing(true);
      const payload = await postJson("/api/student/tasks/continue", {});
      if (payload.task?.assignmentId) {
        navigate(`/student/practice/${payload.task.assignmentId}`, {
          state: {
            nextTask: payload.task,
            message: "Extra practice is ready for the same chapter."
          }
        });
        return;
      }
      setActionError("No extra practice batch is ready right now.");
    } catch (error) {
      setActionError(error.message);
    } finally {
      setIsContinuing(false);
    }
  }

  return (
    <>
      <StoryHero
        tone="student"
        eyebrow="Practice hub"
        title={todayTask ? `Ready for Chapter ${todayTask.chapterNumber}` : milestoneCompletedToday ? "Milestone completed" : "Math practice"}
        subtitle={
          todayTask
            ? todayTask.narrativeSummary || todayTask.rationale?.[0] || "Your next batch is ready to start."
            : milestoneCompletedToday
              ? "You've hit today's goal. You can stop here or open extra practice to boost mastery even more."
              : "Your next batch will appear here as soon as the chapter path is ready."
        }
      >
        <div className="inline-tags">
          <span className="tag">{currentChapter ? `Current: ${currentChapter.name}` : "Current chapter pending"}</span>
          <span className="tag">{Math.round(learningPath.currentMastery ?? 0)}% mastery</span>
          <span className="tag">{learningPath.dailyTargetStatus === "reached" ? "Today's goal reached" : "Goal in progress"}</span>
        </div>
      </StoryHero>
      {flashMessage ? <p className="form-success">{flashMessage}</p> : null}
      {actionError ? <p className="form-error">{actionError}</p> : null}
      <div className="accent-metrics accent-metrics--three top-space">
        <AccentMetric tone="blue" label="Current chapter" value={currentChapter ? `Chapter ${currentChapter.chapterNumber}` : "Waiting"} meta={currentChapter?.name ?? "No active chapter yet"} />
        <AccentMetric tone="green" label="Live batch" value={todayTask ? `${todayTask.items?.length ?? 0} Qs` : canContinuePractice ? "Extra set" : "None"} meta={todayTask ? `Cycle ${todayTask.cycleIndex ?? 1}` : "One batch at a time"} />
        <AccentMetric tone="orange" label="Next unlock" value={upcomingChapter ? `Chapter ${upcomingChapter.chapterNumber}` : "Final"} meta={upcomingChapter?.name ?? "Keep going"} />
      </div>
      <div className="play-grid play-grid--practice top-space">
        <section className="play-panel play-panel--feature">
          <div className="play-panel__head">
            <div>
              <h2>Active batch</h2>
              <p>Only one live batch stays open at a time.</p>
            </div>
            {todayTask ? <AssignmentStateBadge status={pageData.assignmentSummary?.status ?? displayPathStatus} /> : null}
          </div>
          {assignmentState.loading ? <p className="support-copy">Loading today's task...</p> : null}
          {assignmentState.error ? <p className="form-error">{assignmentState.error}</p> : null}
          {!assignmentState.loading && !todayTask && !canContinuePractice ? <p className="support-copy">No active assignment is ready right now.</p> : null}
          {!assignmentState.loading && !todayTask && canContinuePractice ? (
            <article className="mission-card mission-card--success">
              <div className="mission-card__copy">
                <strong>Today's milestone completed</strong>
                <p>You can stop here or keep practicing to push mastery even higher before tomorrow.</p>
                <div className="inline-tags">
                  <span className="tag">Milestone secured</span>
                  <span className="tag">{Math.round(learningPath.currentMastery ?? 0)}% mastery</span>
                </div>
              </div>
              <div className="mission-card__actions">
                <button className="button button--primary" disabled={isContinuing} onClick={handleContinuePractice} type="button">
                  {isContinuing ? "Opening..." : "Continue practice"}
                </button>
              </div>
            </article>
          ) : null}
          {todayTask ? (
            <article className="mission-card">
              <div className="mission-card__copy">
                <strong>Chapter {todayTask.chapterNumber} · {todayTask.concept.name}</strong>
                <p>{todayTask.narrativeSummary || todayTask.rationale?.[0] || "Your next chapter batch is ready."}</p>
                <div className="inline-tags">
                  <span className="tag">{todayTask.items?.length ?? 0} questions</span>
                  <span className="tag">Cycle {todayTask.cycleIndex ?? 1}</span>
                  <span className="tag">Target {todayTask.masteryTarget ?? 80}%</span>
                  {todayTask.coveredTopics?.length ? <span className="tag">{todayTask.coveredTopics.length} topic threads</span> : null}
                </div>
              </div>
              <div className="mission-card__actions">
                <button className="button button--primary" onClick={() => navigate(`/student/practice/${todayTask.assignmentId}`)} type="button">
                  Open assignment
                </button>
              </div>
            </article>
          ) : null}
        </section>
        <section className="play-panel">
          <div className="play-panel__head">
            <div>
              <h2>Chapter journey</h2>
              <p>Keep the current chapter green, then the next one unlocks.</p>
            </div>
            <PathStatusBadge status={displayPathStatus} />
          </div>
          <div className="journey-map">
            <article className="journey-map__card journey-map__card--current">
              <span className="journey-map__eyebrow">Current</span>
              <strong>{currentChapter ? `Chapter ${currentChapter.chapterNumber} · ${currentChapter.name}` : "Current chapter not started"}</strong>
              <p>{learningPath.status === "completed" ? "You have completed the full Class 10 path." : "Stay on this chapter until mastery target and checkpoint are both cleared."}</p>
              <div className="inline-tags">
                <span className="tag">{Math.round(learningPath.currentMastery ?? 0)}% mastery</span>
                <span className="tag">{learningPath.dailyTargetStatus === "reached" ? "Goal reached" : "Goal in progress"}</span>
              </div>
            </article>
            <article className="journey-map__card">
              <span className="journey-map__eyebrow">Next</span>
              <strong>{upcomingChapter ? `Chapter ${upcomingChapter.chapterNumber} · ${upcomingChapter.name}` : "No new chapter yet"}</strong>
              <p>{upcomingChapter ? "It unlocks automatically after mastery." : "Clear this chapter first to reveal what comes next."}</p>
            </article>
          </div>
          <div className="journey-list journey-list--compact top-space">
            {ladder.slice(0, 5).map((chapter) => (
              <article className={`journey-item ${chapter.current ? "journey-item--current" : ""}`.trim()} key={chapter.code}>
                <div>
                  <strong>Chapter {chapter.chapterNumber} · {chapter.name}</strong>
                  <p>{chapter.mastery}% mastery</p>
                </div>
                <div className="inline-tags">
                  {chapter.current ? <span className="tag">Current</span> : null}
                  {chapter.completed ? <span className="tag">Done</span> : null}
                  {chapter.locked ? <span className="tag">Locked</span> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

function StudentAssignmentOverview({ data }) {
  const navigate = useNavigate();
  const { assignmentId = "" } = useParams();
  const location = useLocation();
  const assignmentState = useStudentAssignmentData(assignmentId);
  const pageData = assignmentState.data ?? {};
  const activeTask = pageData.task && String(pageData.task.assignmentId) === String(assignmentId) ? pageData.task : null;
  const learningPath = pageData.learningPath ?? {};
  const ladder = learningPath.chapterLadder ?? [];
  const { currentChapter, upcomingChapter } = getChapterPointers(ladder, learningPath.currentChapterNumber);
  const displayPathStatus = getDisplayPathStatus(learningPath);
  const currentChapterName = currentChapter?.name ?? activeTask?.concept?.name ?? learningPath.currentChapterName ?? "Current chapter";
  const existingSession = activeTask ? readAssignmentSession(activeTask.assignmentId) : { lastQuestionIndex: 0 };
  const resumeIndex = Math.min(existingSession.lastQuestionIndex ?? 0, Math.max((activeTask?.items?.length ?? 1) - 1, 0));
  const flashMessage = location.state?.message ?? "";
  const previewItems = (activeTask?.items ?? []).slice(0, 3);

  return (
    <section className="focus-frame">
      <StoryHero
        tone="student"
        className="story-hero--focus"
        eyebrow="Assignment overview"
        title={activeTask ? `Chapter ${activeTask.chapterNumber} · ${activeTask.concept.name}` : "Assignment unavailable"}
        subtitle={activeTask?.narrativeSummary || activeTask?.rationale?.[0] || "Review the batch, then jump in."}
        action={
          <div className="focus-actions">
            <button className="button button--secondary" onClick={() => navigate("/student/practice")} type="button">
              Back to practice
            </button>
            {activeTask ? (
              <button
                className="button button--primary"
                onClick={() =>
                  navigate(`/student/practice/${assignmentId}/q/${resumeIndex}`, {
                    state: { nextTask: activeTask }
                  })
                }
                type="button"
              >
                {resumeIndex > 0 ? "Resume assignment" : "Start assignment"}
              </button>
            ) : null}
          </div>
        }
      >
        {activeTask ? (
          <div className="inline-tags">
            <AssignmentStateBadge status={pageData.assignmentSummary?.status ?? "assigned"} />
            <span className="tag">{activeTask.items?.length ?? 0} questions</span>
            <span className="tag">Cycle {activeTask.cycleIndex ?? 1}</span>
            <span className="tag">Difficulty {activeTask.targetDifficulty}</span>
          </div>
        ) : null}
      </StoryHero>
      {flashMessage ? <p className="form-success">{flashMessage}</p> : null}
      {assignmentState.loading ? <p className="support-copy">Loading assignment...</p> : null}
      {assignmentState.error ? <p className="form-error">{assignmentState.error}</p> : null}
      {!assignmentState.loading && !activeTask ? (
        <section className="play-panel top-space">
          <div className="play-panel__head">
            <div>
              <h2>Assignment unavailable</h2>
              <p>This batch is no longer active. Head back to practice for the newest chapter set.</p>
            </div>
          </div>
        </section>
      ) : null}
      {activeTask ? (
        <>
          <div className="accent-metrics accent-metrics--three top-space">
            <AccentMetric tone="blue" label="Batch size" value={String(activeTask.items?.length ?? 0)} meta="Questions in this round" />
            <AccentMetric tone="green" label="Mastery target" value={`${activeTask.masteryTarget ?? 80}%`} meta={`${Math.round(learningPath.currentMastery ?? 0)}% current mastery`} />
            <AccentMetric tone="orange" label="Next unlock" value={upcomingChapter ? `Chapter ${upcomingChapter.chapterNumber}` : "Final"} meta={upcomingChapter?.name ?? "Keep mastering this chapter"} />
          </div>
          <div className="play-grid play-grid--focus-overview top-space">
            <section className="play-panel play-panel--feature">
              <div className="play-panel__head">
                <div>
                  <h2>What you'll work on</h2>
                  <p>This batch is tuned to your current chapter rhythm.</p>
                </div>
                <AssignmentStateBadge status={pageData.assignmentSummary?.status ?? "assigned"} />
              </div>
              <div className="preview-stack">
                {previewItems.map((item) => (
                  <article className="preview-card" key={`${assignmentId}-${item.order}`}>
                    <div className="inline-tags">
                      <span className="tag">{item.stage}</span>
                      <span className="tag">Level {item.difficultyLevel}</span>
                    </div>
                    <strong>{item.prompt}</strong>
                  </article>
                ))}
              </div>
              <div className="focus-note-card">
                <strong>Lesson cue</strong>
                <p>{activeTask.lesson?.body || "Jump straight into questions and let the system adapt from your answers."}</p>
              </div>
            </section>
            <section className="play-panel">
              <div className="play-panel__head">
                <div>
                  <h2>Chapter path context</h2>
                  <p>Where this batch sits in your larger journey.</p>
                </div>
                <PathStatusBadge status={displayPathStatus} />
              </div>
              <div className="journey-map">
                <article className="journey-map__card journey-map__card--current">
                  <span className="journey-map__eyebrow">Current chapter</span>
                  <strong>{currentChapterName}</strong>
                  <p>{learningPath.dailyTargetStatus === "reached" ? "Today's goal is already secured." : "This batch helps push today's mastery milestone forward."}</p>
                </article>
                <article className="journey-map__card">
                  <span className="journey-map__eyebrow">What unlocks next</span>
                  <strong>{upcomingChapter ? `Chapter ${upcomingChapter.chapterNumber} · ${upcomingChapter.name}` : "Keep mastering this chapter"}</strong>
                  <p>{upcomingChapter ? "Unlock happens automatically after mastery plus checkpoint." : "No later chapter can open until this one is cleared."}</p>
                </article>
              </div>
            </section>
          </div>
        </>
      ) : null}
    </section>
  );
}

function StudentQuestionWorkspace({ data }) {
  const navigate = useNavigate();
  const { assignmentId = "", questionIndex = "0" } = useParams();
  const location = useLocation();
  const assignmentState = useStudentAssignmentData(assignmentId);
  const pageData = assignmentState.data ?? {};
  const activeTask = pageData.task && String(pageData.task.assignmentId) === String(assignmentId) ? pageData.task : null;
  const taskItems = activeTask?.items ?? [];
  const safeIndex = Math.min(Math.max(Number.parseInt(questionIndex, 10) || 0, 0), Math.max(taskItems.length - 1, 0));
  const currentQuestion = taskItems[safeIndex] ?? null;
  const currentQuestionId = getTaskItemId(currentQuestion);
  const [sessionState, setSessionState] = useState(() => readAssignmentSession(assignmentId));
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const questionStartedAtRef = useRef(0);
  const learningPath = pageData.learningPath ?? {};
  const ladder = learningPath.chapterLadder ?? [];
  const { currentChapter, upcomingChapter } = getChapterPointers(ladder, learningPath.currentChapterNumber);
  const displayPathStatus = getDisplayPathStatus(learningPath);
  const currentChapterName = currentChapter?.name ?? activeTask?.concept?.name ?? learningPath.currentChapterName ?? `Chapter ${activeTask?.chapterNumber ?? "-"}`;
  const answeredCount = Object.values(sessionState.answers ?? {}).filter((value) => String(value ?? "").trim()).length;
  const progressPercent = Math.round(((safeIndex + 1) / Math.max(taskItems.length, 1)) * 100);

  useEffect(() => {
    setSessionState(readAssignmentSession(assignmentId));
  }, [assignmentId]);

  useEffect(() => {
    if (currentQuestion) {
      questionStartedAtRef.current = Date.now();
      const nextState = {
        ...sessionState,
        lastQuestionIndex: safeIndex
      };
      setSessionState(nextState);
      writeAssignmentSession(assignmentId, nextState);
    }
  }, [assignmentId, currentQuestionId, safeIndex]);

  function updateAnswer(value) {
    const nextState = {
      ...sessionState,
      answers: {
        ...(sessionState.answers ?? {}),
        [currentQuestionId]: value
      },
      lastQuestionIndex: safeIndex
    };
    setSessionState(nextState);
    writeAssignmentSession(assignmentId, nextState);
  }

  function captureCurrentQuestionTime(baseState = sessionState) {
    if (!currentQuestionId || !questionStartedAtRef.current) {
      return baseState;
    }

    const elapsedMs = Math.max(Date.now() - questionStartedAtRef.current, 0);
    const nextState = {
      ...baseState,
      timings: {
        ...(baseState.timings ?? {}),
        [currentQuestionId]: (baseState.timings?.[currentQuestionId] ?? 0) + elapsedMs
      },
      lastQuestionIndex: safeIndex
    };
    setSessionState(nextState);
    writeAssignmentSession(assignmentId, nextState);
    questionStartedAtRef.current = 0;
    return nextState;
  }

  function goToQuestion(nextIndex) {
    captureCurrentQuestionTime();
    navigate(`/student/practice/${assignmentId}/q/${nextIndex}`);
  }

  async function handleSubmitBatch() {
    try {
      setIsSubmitting(true);
      setMessage("");
      if (!activeTask?.assignmentId) {
        throw new Error("This assignment is no longer active.");
      }

      const finalState = captureCurrentQuestionTime();
      const payload = await postJson(`/api/student/tasks/${activeTask.assignmentId}/submit`, {
        answers: taskItems.map((item) => ({
          variantId: getTaskItemId(item),
          submittedAnswer: finalState.answers?.[getTaskItemId(item)] ?? "",
          responseTimeMs: finalState.timings?.[getTaskItemId(item)] ?? 0
        }))
      });

      clearAssignmentSession(assignmentId);
      navigate(
        payload.nextTask
          ? `/student/practice/${payload.nextTask.assignmentId}`
          : "/student/practice",
        {
          replace: true,
          state: {
            nextTask: payload.nextTask ?? null,
            message: payload.chapterUnlocked
              ? `Chapter unlocked. Score: ${payload.scorePercent}%. The next chapter batch is ready.`
              : payload.dailyGoalReached
                ? `Today's milestone completed at ${payload.scorePercent}%. You can continue later or open extra practice now.`
                : `Batch submitted. Score: ${payload.scorePercent}%. A fresh batch is ready for the same chapter.`
          }
        }
      );
    } catch (submitError) {
      setIsSubmitting(false);
      setMessage(submitError.message);
    }
  }

  if (assignmentState.loading) {
    return <section className="focus-frame"><p className="state-banner">Loading assignment workspace...</p></section>;
  }

  if (assignmentState.error) {
    return <section className="focus-frame"><p className="state-banner state-banner--error">{assignmentState.error}</p></section>;
  }

  if (!activeTask || !currentQuestion) {
    return (
      <section className="focus-frame">
        <section className="play-panel">
          <div className="play-panel__head">
            <div>
              <h2>Assignment unavailable</h2>
              <p>This assignment is no longer the active batch. Return to the practice list for the current chapter batch.</p>
            </div>
            <button className="button button--secondary" onClick={() => navigate("/student/practice")} type="button">
              Back to practice
            </button>
          </div>
        </section>
      </section>
    );
  }

  return (
    <section className="focus-frame">
      <StoryHero
        tone="student"
        className="story-hero--focus"
        eyebrow="Focused workspace"
        title={`Chapter ${activeTask.chapterNumber} · Question ${safeIndex + 1}`}
        subtitle={currentQuestion.stage === "checkpoint" ? "This checkpoint helps decide the next chapter unlock." : "Solve this one, save it, and move forward."}
        action={
          <button className="button button--secondary" onClick={() => navigate(`/student/practice/${assignmentId}`)} type="button">
            Exit assignment
          </button>
        }
      >
        <div className="inline-tags">
          <span className="tag">{currentQuestion.stage}</span>
          <span className="tag">Difficulty {currentQuestion.difficultyLevel}</span>
          {currentQuestion.expectedTimeSec ? <span className="tag">Expected {currentQuestion.expectedTimeSec}s</span> : null}
        </div>
      </StoryHero>
      <div className="accent-metrics accent-metrics--three top-space">
        <AccentMetric tone="blue" label="Progress" value={`${progressPercent}%`} meta={`Question ${safeIndex + 1} of ${taskItems.length}`} />
        <AccentMetric tone="green" label="Answered" value={String(answeredCount)} meta="Saved inside this batch" />
        <AccentMetric tone="orange" label="Current mastery" value={`${Math.round(learningPath.currentMastery ?? 0)}%`} meta={upcomingChapter ? `Next: Chapter ${upcomingChapter.chapterNumber}` : "Stay on this chapter"} />
      </div>
      <div className="workspace-stage top-space">
        <aside className="workspace-stage__rail">
          <section className="play-panel">
            <div className="play-panel__head">
              <div>
                <h2>Chapter context</h2>
                <p>Keep the chapter goal in view while you answer.</p>
              </div>
              <PathStatusBadge status={displayPathStatus} />
            </div>
            <div className="journey-map">
              <article className="journey-map__card journey-map__card--current">
                <span className="journey-map__eyebrow">Current</span>
                <strong>{currentChapterName}</strong>
                <p>{Math.round(learningPath.currentMastery ?? 0)}% mastery right now.</p>
              </article>
              <article className="journey-map__card">
                <span className="journey-map__eyebrow">Next</span>
                <strong>{upcomingChapter ? `Chapter ${upcomingChapter.chapterNumber}` : "Keep going here"}</strong>
                <p>{upcomingChapter ? upcomingChapter.name : "Master this chapter to unlock the next one."}</p>
              </article>
            </div>
          </section>
          {currentQuestion.hint ? (
            <section className="play-panel play-panel--hint">
              <div className="play-panel__head">
                <div>
                  <h2>Hint</h2>
                  <p>A small nudge, not the full answer.</p>
                </div>
              </div>
              <p>{currentQuestion.hint}</p>
            </section>
          ) : null}
        </aside>
        <article className="question-stage-card">
          <div className="question-stage-card__head">
            <div>
              <span className="question-stage-card__eyebrow">Solve this step</span>
              <h2>{currentQuestion.prompt}</h2>
            </div>
          </div>
          {currentQuestion.options?.length ? (
            <div className="option-grid">
              {currentQuestion.options.map((option, optionIndex) => (
                <button
                  className={`option-button ${sessionState.answers?.[currentQuestionId] === option ? "is-selected" : ""}`.trim()}
                  key={`${option}-${optionIndex}`}
                  onClick={() => updateAnswer(option)}
                  type="button"
                >
                  <span className="option-button__index">{String.fromCharCode(65 + optionIndex)}</span>
                  <span>{option}</span>
                </button>
              ))}
            </div>
          ) : (
            <label className="field field--focus">
              <span>Your answer</span>
              <input
                value={sessionState.answers?.[currentQuestionId] ?? ""}
                onChange={(event) => updateAnswer(event.target.value)}
                placeholder="Type your answer"
              />
            </label>
          )}
          {message ? <p className="form-error">{message}</p> : null}
          <div className="focus-question-card__actions">
            <button className="button button--ghost" disabled={safeIndex === 0 || isSubmitting} onClick={() => goToQuestion(safeIndex - 1)} type="button">
              Previous
            </button>
            {safeIndex < taskItems.length - 1 ? (
              <button className="button button--primary" disabled={isSubmitting} onClick={() => goToQuestion(safeIndex + 1)} type="button">
                Save and next
              </button>
            ) : (
              <button className="button button--primary" disabled={isSubmitting} onClick={handleSubmitBatch} type="button">
                {isSubmitting ? "Submitting..." : "Submit batch"}
              </button>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}

function StudentProgress({ data }) {
  const progressState = useStudentProgressData();
  const pageData = progressState.data ?? {};
  const learningPath = pageData.learningPath ?? {};
  const analytics = pageData.analytics ?? {};
  const latestBatch = pageData.latestBatch ?? pageData.assignmentHistory?.[0] ?? null;
  const olderBatches = (pageData.assignmentHistory ?? []).filter((item) => String(item.id) !== String(latestBatch?.id)).slice(0, 3);
  const ladder = learningPath.chapterLadder ?? [];
  const { currentChapter, upcomingChapter } = getChapterPointers(ladder, learningPath.currentChapterNumber);
  const displayPathStatus = getDisplayPathStatus(learningPath);
  const displayCurrentChapterValue = currentChapter
    ? `Chapter ${currentChapter.chapterNumber}`
    : displayPathStatus === "completed"
      ? "Completed"
      : Number(learningPath.currentMastery ?? 0) > 0
        ? `Chapter ${learningPath.currentChapterNumber ?? 1}`
        : "Not started";
  const displayCurrentChapterTitle = currentChapter
    ? `Chapter ${currentChapter.chapterNumber} - ${currentChapter.name}`
    : Number(learningPath.currentMastery ?? 0) > 0
      ? `Chapter ${learningPath.currentChapterNumber ?? 1}`
      : "No current chapter";
  const dailyProgressMilestone =
    Number(learningPath.dailyMasteryGoal ?? 0) > Number(learningPath.dailyMasteryStart ?? 0)
      ? `${learningPath.dailyMasteryStart}% -> ${learningPath.dailyMasteryGoal}%`
      : "";
  const recentScoreItems = analytics.recentScoreSeries ?? (pageData.recentResults ?? []).slice(0, 4).map((item, index) => ({
    key: item.id ?? `${item.title}-${index}`,
    label: item.title,
    value: Number.parseInt(String(item.score), 10) || 0
  }));
  const milestoneProgress = analytics.milestoneProgress ?? [{
    key: "today",
    label: "Today",
    start: Number(learningPath.dailyMasteryStart ?? 0),
    current: Math.round(Number(learningPath.currentMastery ?? 0)),
    goal: Number(learningPath.dailyMasteryGoal ?? 0)
  }];

  return (
    <>
      <StoryHero
        tone="student"
        eyebrow="Progress story"
        title={`Your journey through ${displayCurrentChapterValue}`}
        subtitle="See your chapter path, latest batch, and the small wins pushing mastery forward."
      >
        <div className="inline-tags">
          <PathStatusBadge status={displayPathStatus} />
          {dailyProgressMilestone ? <span className="tag">{dailyProgressMilestone}</span> : null}
          {learningPath.dailyTargetDate ? <span className="tag">For {learningPath.dailyTargetDate}</span> : null}
        </div>
      </StoryHero>
      {progressState.error ? <p className="form-error top-space">{progressState.error}</p> : null}
      {progressState.loading ? <p className="support-copy top-space">Loading progress...</p> : null}
      <div className="accent-metrics top-space">
        <AccentMetric tone="blue" label="Current chapter" value={displayCurrentChapterValue} meta={displayCurrentChapterTitle} />
        <AccentMetric tone="green" label="Current mastery" value={`${Math.round(learningPath.currentMastery ?? 0)}%`} meta={learningPath.dailyTargetStatus === "reached" ? "Today's goal reached" : "Today's goal in progress"} />
        <AccentMetric tone="purple" label="Completed chapters" value={String(learningPath.completedChaptersCount ?? 0)} meta={`${learningPath.totalChapters ?? ladder.length} in the full path`} />
        <AccentMetric tone="orange" label="Upcoming chapter" value={upcomingChapter ? `Chapter ${upcomingChapter.chapterNumber}` : "Final"} meta={upcomingChapter?.name ?? "Keep going"} />
      </div>
      <div className="play-grid play-grid--progress top-space">
        <section className="play-panel">
          <div className="play-panel__head">
            <div>
              <h2>Chapter trail</h2>
              <p>Every chapter stays locked until the current one is mastered.</p>
            </div>
          </div>
          <div className="journey-list journey-list--scroll">
            {ladder.map((chapter) => (
              <article className={`journey-item ${chapter.current ? "journey-item--current" : ""}`.trim()} key={chapter.code}>
                <div>
                  <strong>Chapter {chapter.chapterNumber} · {chapter.name}</strong>
                  <p>{chapter.mastery}% mastery</p>
                </div>
                <div className="inline-tags">
                  {chapter.current ? <span className="tag">Current</span> : null}
                  {chapter.completed ? <span className="tag">Done</span> : null}
                  {chapter.locked ? <span className="tag">Locked</span> : null}
                </div>
              </article>
            ))}
          </div>
        </section>
        <div className="play-stack">
          <section className="play-panel play-panel--feature">
            <div className="play-panel__head">
              <div>
                <h2>Current path status</h2>
                <p>Your live chapter state and today's target.</p>
              </div>
              <PathStatusBadge status={displayPathStatus} />
            </div>
            <div className="journey-map">
              <article className="journey-map__card journey-map__card--current">
                <span className="journey-map__eyebrow">Now</span>
                <strong>{displayCurrentChapterTitle}</strong>
                <p>{displayPathStatus === "completed" ? "You have completed the full Class 10 chapter path." : `Daily target is ${learningPath.dailyTargetStatus === "reached" ? "reached" : "still in progress"}.`}</p>
              </article>
              <article className="journey-map__card">
                <span className="journey-map__eyebrow">Next unlock</span>
                <strong>{upcomingChapter ? `Chapter ${upcomingChapter.chapterNumber} · ${upcomingChapter.name}` : "No later chapter yet"}</strong>
                <p>{upcomingChapter ? "It opens once mastery and checkpoint are both cleared." : "Keep working through the current chapter to continue."}</p>
              </article>
            </div>
          </section>
          <section className="play-panel">
            <div className="play-panel__head">
              <div>
                <h2>Score trend</h2>
                <p>Batch score and mastery target are tracked separately.</p>
              </div>
            </div>
            <div className="play-stack">
              <LineChart title="Batch score trend" points={recentScoreItems.length ? recentScoreItems : [{ label: "Now", value: Math.round(Number(learningPath.currentMastery ?? 0)) }]} suffix="%" />
              <MilestoneChart title="Milestone progress" items={milestoneProgress} />
            </div>
          </section>
        </div>
      </div>
      <div className="play-grid play-grid--progress-bottom top-space">
        <section className="play-panel play-panel--feature">
          <div className="play-panel__head">
            <div>
              <h2>Latest batch</h2>
              <p>Your current or most recent chapter batch.</p>
            </div>
          </div>
          {!latestBatch ? <p className="support-copy">No chapter batch has been generated yet.</p> : null}
          {latestBatch ? (
            <div className="achievement-stack">
              <article className="achievement-card achievement-card--soft">
                <div>
                  <strong>{latestBatch.concept}</strong>
                  <p>{latestBatch.assignedForDate ? `Assigned for ${latestBatch.assignedForDate}` : "No assigned date"}</p>
                </div>
                <div className="inline-tags">
                  <AssignmentStateBadge status={latestBatch.status} />
                  <span className="tag">{latestBatch.itemsCount} items</span>
                  <span className="tag">Cycle {latestBatch.cycleIndex}</span>
                  <span className="tag">Diff {latestBatch.targetDifficulty}</span>
                </div>
              </article>
              {olderBatches.map((item) => (
                <article className="achievement-card" key={item.id}>
                  <div>
                    <strong>{item.concept}</strong>
                    <p>{item.itemsCount} items · Cycle {item.cycleIndex}</p>
                  </div>
                  <AssignmentStateBadge status={item.status} />
                </article>
              ))}
            </div>
          ) : null}
        </section>
        <HistogramChart
          title="Mastery spread"
          bins={[
            { label: "0-39", value: (pageData.mastery ?? []).filter((item) => item.mastery < 40).length },
            { label: "40-59", value: (pageData.mastery ?? []).filter((item) => item.mastery >= 40 && item.mastery < 60).length },
            { label: "60-79", value: (pageData.mastery ?? []).filter((item) => item.mastery >= 60 && item.mastery < 80).length },
            { label: "80+", value: (pageData.mastery ?? []).filter((item) => item.mastery >= 80).length }
          ]}
          className="student-progress-chart"
        />
      </div>
    </>
  );
}

function useResource(endpoint) {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const payload = await fetchJson(endpoint);
      setItems(
        payload.teachers ??
        payload.students ??
        payload.classrooms ??
        payload.questions ??
        payload.concepts ??
        []
      );
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  useEffect(() => {
    load();
  }, [endpoint]);

  return { items, error, reload: load };
}

function useApiData(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  function refresh() {
    setRefreshKey((current) => current + 1);
  }

  useEffect(() => {
    let active = true;

    async function run() {
      try {
        setError("");
        setLoading(true);
        const payload = await loader();
        if (active) {
          setData(payload);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError.message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [...deps, refreshKey]);

  return { data, error, loading, setData, refresh };
}

function useStudentHomeData() {
  return useApiData(() => fetchJson("/api/student/home"), []);
}

function useStudentProgressData() {
  return useApiData(() => fetchJson("/api/student/progress"), []);
}

function useStudentAssignmentData(taskAssignmentId = "") {
  return useApiData(
    () => fetchJson(taskAssignmentId ? `/api/student/assignment/${encodeURIComponent(taskAssignmentId)}` : "/api/student/assignment/current"),
    [taskAssignmentId]
  );
}

function useTeacherDashboardData(classroomId = "") {
  return useApiData(
    () => fetchJson(classroomId ? `/api/teacher/dashboard?classroomId=${encodeURIComponent(classroomId)}` : "/api/teacher/dashboard"),
    [classroomId]
  );
}

function useTeacherAssignmentsData(classroomId = "") {
  return useApiData(
    () => (classroomId ? fetchJson(`/api/teacher/assignments?classroomId=${encodeURIComponent(classroomId)}`) : Promise.resolve({ classrooms: [], summaryCards: [], students: [] })),
    [classroomId]
  );
}

function useTeacherAssignmentWorkspaceData(classroomId = "", studentId = "") {
  return useApiData(
    () =>
      classroomId && studentId
        ? fetchJson(`/api/teacher/assignments/${encodeURIComponent(classroomId)}/${encodeURIComponent(studentId)}`)
        : Promise.resolve({ classrooms: [], student: null, latestPlan: null, insight: null, summaryCards: [] }),
    [classroomId, studentId]
  );
}

function useTeacherReportsData(classroomId = "") {
  return useApiData(
    () => fetchJson(classroomId ? `/api/teacher/reports?classroomId=${encodeURIComponent(classroomId)}` : "/api/teacher/reports"),
    [classroomId]
  );
}

function AdminTeacherManager() {
  const { items, error, reload } = useResource("/api/teachers");
  const { items: classrooms } = useResource("/api/classrooms");
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [message, setMessage] = useState("");
  const classroomsByTeacher = classrooms.reduce((map, classroom) => {
    const key = String(classroom.teacherId ?? "");
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map());

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setMessage("");
      await postJson("/api/teachers", form);
      setForm({ fullName: "", email: "", password: "" });
      setMessage("Teacher added successfully.");
      reload();
    } catch (submitError) {
      setMessage(submitError.message);
    }
  }

  return (
    <div className="split-grid ops-manager-grid">
      <Card title="Add teacher" subtitle="Create teacher portal access for this school." className="ops-card ops-card--form">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field"><span>Full name</span><input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
          <label className="field"><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label className="field"><span>Password</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          {message ? <p className={message.includes("success") ? "form-success" : "form-error"}>{message}</p> : null}
          <button className="button button--primary" type="submit">Create teacher</button>
        </form>
      </Card>
      <Card title="Teacher access" subtitle="Teacher accounts already connected to this school." className="ops-card">
        {error ? <p className="form-error">{error}</p> : null}
        <div className="data-table">
          <div className="data-table__head data-table__head--admin"><span>Name</span><span>Email</span><span>Classrooms</span><span>Portal</span></div>
          {items.map((teacher) => (
            <div className="data-table__row data-table__row--admin" key={teacher._id}>
              <span>{teacher.fullName}</span>
              <span>{teacher.email}</span>
              <span>{classroomsByTeacher.get(String(teacher._id)) ?? 0}</span>
              <span>{teacher.status ?? "Active"}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function AdminClassroomManager() {
  const { items: teachers } = useResource("/api/teachers");
  const { items: classrooms, error: classroomError, reload } = useResource("/api/classrooms");
  const [form, setForm] = useState({ name: "", gradeLevel: "10", teacherId: "" });
  const [message, setMessage] = useState("");
  const teacherNameById = new Map(teachers.map((teacher) => [String(teacher._id), teacher.fullName]));

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setMessage("");
      await postJson("/api/classrooms", form);
      setForm({ name: "", gradeLevel: "10", teacherId: "" });
      setMessage("Classroom created successfully.");
      reload();
    } catch (submitError) {
      setMessage(submitError.message);
    }
  }

  return (
    <div className="split-grid ops-manager-grid">
      <Card title="Create classroom" subtitle="Assign new classrooms to teachers from the admin portal." className="ops-card ops-card--form">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field"><span>Classroom name</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
          <label className="field">
            <span>Grade level</span>
            <select value={form.gradeLevel} onChange={(event) => setForm({ ...form, gradeLevel: event.target.value })}>
              <option value="10">10</option>
              <option value="9">9</option>
              <option value="8">8</option>
              <option value="7">7</option>
              <option value="6">6</option>
            </select>
          </label>
          <label className="field">
            <span>Teacher</span>
            <select value={form.teacherId} onChange={(event) => setForm({ ...form, teacherId: event.target.value })}>
              <option value="">Select teacher</option>
              {teachers.map((teacher) => (
                <option key={teacher._id} value={teacher._id}>{teacher.fullName}</option>
              ))}
            </select>
          </label>
          {message ? <p className={message.includes("success") ? "form-success" : "form-error"}>{message}</p> : null}
          {classroomError ? <p className="form-error">{classroomError}</p> : null}
          <button className="button button--primary" type="submit">Create classroom</button>
        </form>
      </Card>
      <Card title="Classroom access" subtitle="Live classrooms and their assigned teacher owner." className="ops-card">
        <div className="data-table">
          <div className="data-table__head data-table__head--admin"><span>Classroom</span><span>Grade</span><span>Teacher</span><span>Support</span></div>
          {classrooms.map((classroom) => {
            const supportMeta = getGradeSupportMeta(classroom.gradeLevel);
            return (
              <div className="data-table__row data-table__row--admin" key={classroom._id}>
                <span>{classroom.name}</span>
                <span>{classroom.gradeLevel}</span>
                <span>{teacherNameById.get(String(classroom.teacherId)) ?? "Unassigned"}</span>
                <span><span className="tag">{supportMeta.label}</span></span>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

function TeacherStudentManager() {
  const { items, error, reload } = useResource("/api/students");
  const { items: classrooms, error: classroomError, reload: reloadClassrooms } = useResource("/api/classrooms");
  const [classroomForm, setClassroomForm] = useState({ name: "", gradeLevel: "10" });
  const [form, setForm] = useState({ fullName: "", email: "", password: "", gradeLevel: "", classroom: "", classroomId: "" });
  const [message, setMessage] = useState("");
  const [classroomMessage, setClassroomMessage] = useState("");
  const canCreateClassroom = classroomForm.name.trim() && classroomForm.gradeLevel.trim();
  const canCreateStudent = form.fullName.trim() && form.email.trim() && form.password.trim() && form.classroomId;

  async function handleCreateClassroom(event) {
    event.preventDefault();

    try {
      setClassroomMessage("");
      await postJson("/api/classrooms", classroomForm);
      setClassroomForm({ name: "", gradeLevel: "10" });
      setClassroomMessage("Classroom created successfully.");
      reloadClassrooms();
    } catch (submitError) {
      setClassroomMessage(submitError.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setMessage("");
      await postJson("/api/students", form);
      setForm({ fullName: "", email: "", password: "", gradeLevel: "", classroom: "", classroomId: "" });
      setMessage("Student added successfully.");
      reload();
    } catch (submitError) {
      setMessage(submitError.message);
    }
  }

  return (
    <div className="split-grid">
      <Card title="Create classroom" subtitle="Teachers create classrooms before enrolling students.">
        <form className="form-grid" onSubmit={handleCreateClassroom}>
          <label className="field"><span>Classroom name</span><input value={classroomForm.name} onChange={(event) => setClassroomForm({ ...classroomForm, name: event.target.value })} /></label>
          <label className="field">
            <span>Grade level</span>
            <select value={classroomForm.gradeLevel} onChange={(event) => setClassroomForm({ ...classroomForm, gradeLevel: event.target.value })}>
              <option value="10">10</option>
              <option value="9">9</option>
              <option value="8">8</option>
              <option value="7">7</option>
              <option value="6">6</option>
            </select>
          </label>
          {classroomMessage ? <p className={classroomMessage.includes("success") ? "form-success" : "form-error"}>{classroomMessage}</p> : null}
          {classroomError ? <p className="form-error">{classroomError}</p> : null}
          <button className="button button--primary" disabled={!canCreateClassroom} type="submit">Create classroom</button>
        </form>
        <div className="inline-meta">
          {classrooms.map((classroom) => (
            <span className="tag" key={classroom._id}>
              {classroom.name} / Grade {classroom.gradeLevel}
            </span>
          ))}
        </div>
      </Card>
      <Card title="Add student" subtitle="Enroll students into the teacher workspace.">
        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="field"><span>Full name</span><input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} /></label>
          <label className="field"><span>Email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
          <label className="field"><span>Password</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
          <label className="field">
            <span>Grade level</span>
            <select value={form.gradeLevel} onChange={(event) => setForm({ ...form, gradeLevel: event.target.value })}>
              <option value="">Use classroom grade</option>
              <option value="10">10</option>
              <option value="9">9</option>
              <option value="8">8</option>
              <option value="7">7</option>
              <option value="6">6</option>
            </select>
          </label>
          <label className="field">
            <span>Classroom</span>
            <select value={form.classroomId} onChange={(event) => {
              const selected = classrooms.find((item) => String(item._id) === String(event.target.value));
              setForm({
                ...form,
                classroomId: event.target.value,
                classroom: selected?.name ?? "",
                gradeLevel: form.gradeLevel || selected?.gradeLevel || ""
              });
            }}>
              <option value="">Select classroom</option>
              {classrooms.map((classroom) => (
                <option key={classroom._id} value={classroom._id}>
                  {classroom.name} / Grade {classroom.gradeLevel}
                </option>
              ))}
            </select>
          </label>
          <p className="support-copy">Grade defaults from the selected classroom if you leave it unchanged.</p>
          {message ? <p className={message.includes("success") ? "form-success" : "form-error"}>{message}</p> : null}
          <button className="button button--primary" disabled={!canCreateStudent} type="submit">Create student</button>
        </form>
      </Card>
      <Card title="Students" subtitle="Live student roster for this school.">
        {error ? <p className="form-error">{error}</p> : null}
        <div className="data-table">
          <div className="data-table__head data-table__head--admin"><span>Name</span><span>Email</span><span>Grade</span><span>Classroom</span><span>Status</span></div>
          {items.map((student) => (
            <div className="data-table__row data-table__row--admin" key={student._id}>
              <span>{student.fullName}</span><span>{student.email}</span><span>{student.gradeLevel || "-"}</span><span>{student.classroom || "-"}</span><span>{student.status}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function QuestionBankManager() {
  const { items: classrooms } = useResource("/api/classrooms");
  const { items: concepts, error: conceptError } = useResource("/api/catalog/concepts");
  const [gradeFilter, setGradeFilter] = useState("10");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState("");
  const [packMessage, setPackMessage] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [reviewNotes, setReviewNotes] = useState("");
  const [generatedPack, setGeneratedPack] = useState(null);
  const [createForm, setCreateForm] = useState({
    conceptId: "",
    prompt: "",
    questionType: "mcq",
    optionsText: "",
    correctAnswer: "",
    explanation: "",
    difficultyLevel: "2",
    expectedTimeSec: "90",
    topic: "",
    teacherNotes: ""
  });
  const [packForm, setPackForm] = useState({
    classroomId: "",
    conceptId: "",
    packType: "practice",
    questionCount: "8"
  });

  const { data: questionPayload, loading: questionLoading, error: questionError } = useApiData(() => {
    const params = new URLSearchParams();
    if (gradeFilter) params.set("gradeLevel", gradeFilter);
    if (reviewFilter !== "all") params.set("reviewStatus", reviewFilter);
    if (search.trim()) params.set("q", search.trim());
    return fetchJson(`/api/catalog/questions?${params.toString()}`);
  }, [gradeFilter, reviewFilter, search, refreshKey]);

  const questions = questionPayload?.questions ?? [];
  const gradeConcepts = concepts.filter((concept) => !gradeFilter || concept.gradeLevel === gradeFilter);
  const selectedQuestion = questions.find((question) => question._id === selectedQuestionId) ?? questions[0] ?? null;
  const approvedCount = questions.filter((question) => question.reviewStatus === "approved").length;
  const pendingCount = questions.filter((question) => question.reviewStatus === "draft" || question.reviewStatus === "in_review").length;
  const aiReadyCount = questions.filter((question) => question.approvedForGeneration).length;
  const coveredConcepts = new Set(questions.flatMap((question) => question.conceptIds.map((concept) => concept.code))).size;

  useEffect(() => {
    if (!selectedQuestion && questions.length > 0) {
      setSelectedQuestionId(questions[0]._id);
      return;
    }

    if (selectedQuestionId && !questions.some((question) => question._id === selectedQuestionId)) {
      setSelectedQuestionId(questions[0]?._id ?? "");
    }
  }, [questions, selectedQuestion, selectedQuestionId]);

  useEffect(() => {
    setReviewNotes(selectedQuestion?.teacherNotes ?? "");
  }, [selectedQuestion?.teacherNotes, selectedQuestionId]);

  useEffect(() => {
    if (!createForm.conceptId && gradeConcepts[0]?._id) {
      setCreateForm((current) => ({ ...current, conceptId: gradeConcepts[0]._id, topic: gradeConcepts[0].name }));
    }
  }, [createForm.conceptId, gradeConcepts]);

  useEffect(() => {
    if (!packForm.conceptId && gradeConcepts[0]?._id) {
      setPackForm((current) => ({ ...current, conceptId: gradeConcepts[0]._id }));
    }
  }, [gradeConcepts, packForm.conceptId]);

  async function handleCreateQuestion(event) {
    event.preventDefault();

    try {
      setMessage("");
      const payload = await postJson("/api/catalog/questions", {
        conceptIds: [createForm.conceptId],
        prompt: createForm.prompt,
        questionType: createForm.questionType,
        options:
          createForm.questionType === "mcq"
            ? createForm.optionsText.split("|").map((item) => item.trim()).filter(Boolean)
            : [],
        correctAnswer: createForm.correctAnswer,
        explanation: createForm.explanation,
        difficultyLevel: Number(createForm.difficultyLevel),
        expectedTimeSec: Number(createForm.expectedTimeSec),
        topic: createForm.topic,
        teacherNotes: createForm.teacherNotes
      });
      setMessage("Question added and sent to review.");
      setCreateForm((current) => ({
        ...current,
        prompt: "",
        optionsText: "",
        correctAnswer: "",
        explanation: "",
        teacherNotes: ""
      }));
      setSelectedQuestionId(payload.question._id);
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setMessage(submitError.message);
    }
  }

  async function handleReview(reviewStatus, approvedForGeneration) {
    if (!selectedQuestion) return;

    try {
      setMessage("");
      const payload = await postJson(`/api/catalog/questions/${selectedQuestion._id}/review`, {
        reviewStatus,
        approvedForGeneration,
        teacherNotes: reviewNotes
      });
      setSelectedQuestionId(payload.question._id);
      setMessage(`Question marked as ${reviewStatus.replace("_", " ")}.`);
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setMessage(submitError.message);
    }
  }

  async function handlePackPreview(event) {
    event.preventDefault();

    try {
      setPackMessage("");
      const payload = await postJson("/api/teacher/ai-packs/preview", {
        classroomId: packForm.classroomId || undefined,
        gradeLevel: gradeFilter,
        conceptId: packForm.conceptId || undefined,
        packType: packForm.packType,
        questionCount: Number(packForm.questionCount)
      });
      setGeneratedPack(payload.pack);
      setPackMessage("AI-ready draft generated from reviewed questions.");
    } catch (submitError) {
      setPackMessage(submitError.message);
      setGeneratedPack(null);
    }
  }

  return (
    <div className="stack-grid">
      <div className="metric-row">
        <MetricCard label="Class 10 inventory" value={String(questions.length)} />
        <MetricCard label="Pending review" value={String(pendingCount)} />
        <MetricCard label="Approved for AI" value={String(aiReadyCount)} />
        <MetricCard label="Concept coverage" value={String(coveredConcepts)} />
      </div>
      {message ? <p className={message.includes("Question") || message.includes("marked") ? "form-success" : "form-error"}>{message}</p> : null}
      <div className="split-grid">
        <Card title="Add question" subtitle="Use this as the working intake form for your 100-question class 10 bank.">
          <form className="form-grid" onSubmit={handleCreateQuestion}>
            <label className="field">
              <span>Concept</span>
              <select value={createForm.conceptId} onChange={(event) => {
                const selectedConcept = gradeConcepts.find((concept) => concept._id === event.target.value);
                setCreateForm({
                  ...createForm,
                  conceptId: event.target.value,
                  topic: selectedConcept?.name ?? createForm.topic
                });
              }}>
                <option value="">Select class 10 concept</option>
                {gradeConcepts.map((concept) => (
                  <option key={concept._id} value={concept._id}>{concept.name}</option>
                ))}
              </select>
            </label>
            <label className="field"><span>Question prompt</span><textarea rows="4" value={createForm.prompt} onChange={(event) => setCreateForm({ ...createForm, prompt: event.target.value })} /></label>
            <div className="split-grid split-grid--compact">
              <label className="field">
                <span>Question type</span>
                <select value={createForm.questionType} onChange={(event) => setCreateForm({ ...createForm, questionType: event.target.value })}>
                  <option value="mcq">MCQ</option>
                  <option value="numeric">Numeric</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="fill_blank">Fill In The Blank</option>
                  <option value="true_false">True / False</option>
                  <option value="case_study">Case Study</option>
                </select>
              </label>
              <label className="field"><span>Difficulty</span><select value={createForm.difficultyLevel} onChange={(event) => setCreateForm({ ...createForm, difficultyLevel: event.target.value })}>
                <option value="1">1 - Starter</option>
                <option value="2">2 - Core</option>
                <option value="3">3 - Secure</option>
                <option value="4">4 - Stretch</option>
                <option value="5">5 - Challenge</option>
              </select></label>
            </div>
            {createForm.questionType === "mcq" ? (
              <label className="field"><span>Options</span><input value={createForm.optionsText} onChange={(event) => setCreateForm({ ...createForm, optionsText: event.target.value })} placeholder="Option A | Option B | Option C | Option D" /></label>
            ) : null}
            <label className="field"><span>Correct answer</span><input value={createForm.correctAnswer} onChange={(event) => setCreateForm({ ...createForm, correctAnswer: event.target.value })} /></label>
            <label className="field"><span>Explanation</span><textarea rows="3" value={createForm.explanation} onChange={(event) => setCreateForm({ ...createForm, explanation: event.target.value })} /></label>
            <div className="split-grid split-grid--compact">
              <label className="field"><span>Topic label</span><input value={createForm.topic} onChange={(event) => setCreateForm({ ...createForm, topic: event.target.value })} /></label>
              <label className="field"><span>Expected time (sec)</span><input value={createForm.expectedTimeSec} onChange={(event) => setCreateForm({ ...createForm, expectedTimeSec: event.target.value })} /></label>
            </div>
            <label className="field"><span>Teacher note</span><textarea rows="3" value={createForm.teacherNotes} onChange={(event) => setCreateForm({ ...createForm, teacherNotes: event.target.value })} /></label>
            {conceptError ? <p className="form-error">{conceptError}</p> : null}
            <button className="button button--primary" type="submit">Add to review queue</button>
          </form>
        </Card>
        <Card title="AI homework studio" subtitle="Generate a draft only from teacher-approved class 10 questions.">
          <form className="form-grid" onSubmit={handlePackPreview}>
            <label className="field">
              <span>Classroom</span>
              <select value={packForm.classroomId} onChange={(event) => setPackForm({ ...packForm, classroomId: event.target.value })}>
                <option value="">Optional classroom context</option>
                {classrooms.map((classroom) => (
                  <option key={classroom._id} value={classroom._id}>
                    {classroom.name} / Grade {classroom.gradeLevel}
                  </option>
                ))}
              </select>
            </label>
            <div className="split-grid split-grid--compact">
              <label className="field">
                <span>Pack type</span>
                <select value={packForm.packType} onChange={(event) => setPackForm({ ...packForm, packType: event.target.value })}>
                  <option value="practice">Practice</option>
                  <option value="homework">Homework</option>
                </select>
              </label>
              <label className="field">
                <span>Question count</span>
                <select value={packForm.questionCount} onChange={(event) => setPackForm({ ...packForm, questionCount: event.target.value })}>
                  <option value="6">6</option>
                  <option value="8">8</option>
                  <option value="10">10</option>
                  <option value="12">12</option>
                </select>
              </label>
            </div>
            <label className="field">
              <span>Concept focus</span>
              <select value={packForm.conceptId} onChange={(event) => setPackForm({ ...packForm, conceptId: event.target.value })}>
                <option value="">All approved class 10 concepts</option>
                {gradeConcepts.map((concept) => (
                  <option key={concept._id} value={concept._id}>{concept.name}</option>
                ))}
              </select>
            </label>
            {packMessage ? <p className={packMessage.includes("generated") ? "form-success" : "form-error"}>{packMessage}</p> : null}
            <button className="button button--primary" type="submit">Generate draft pack</button>
          </form>
          {generatedPack ? (
            <div className="builder-preview top-space">
              <div className="builder-preview__head">
                <strong>{generatedPack.title}</strong>
                <QuestionStatusBadge status={generatedPack.readiness === "ready" ? "approved" : "changes_requested"} />
              </div>
              <p>{generatedPack.rationale}</p>
              <div className="inline-tags top-space">
                <span className="tag">{generatedPack.questionCount} questions</span>
                <span className="tag">{generatedPack.packType}</span>
                {generatedPack.coverage.map((item) => <span className="tag" key={item}>{item}</span>)}
              </div>
              <ul className="simple-list top-space">
                {generatedPack.questions.map((question) => (
                  <li key={question._id}>
                    <strong>{question.prompt}</strong>
                    <p>{question.conceptIds.map((concept) => concept.name).join(", ")}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Card>
      </div>
      <div className="dashboard-grid top-space">
        <Card
          title="Question inventory"
          subtitle="Filter the bank before it becomes part of assignment generation."
          action={
            <div className="toolbar-row">
              <select className="select select--compact" value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)}>
                <option value="10">Grade 10</option>
                <option value="8">Grade 8</option>
                <option value="7">Grade 7</option>
                <option value="6">Grade 6</option>
              </select>
              <select className="select select--compact" value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value)}>
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="in_review">In review</option>
                <option value="approved">Approved</option>
                <option value="changes_requested">Changes requested</option>
              </select>
            </div>
          }
        >
          <label className="field">
            <span>Search bank</span>
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search question prompts" />
          </label>
          {questionLoading ? <p className="support-copy top-space">Loading question inventory...</p> : null}
          {questionError ? <p className="form-error top-space">{questionError}</p> : null}
          <div className="data-table top-space">
            <div className="data-table__head data-table__head--question-bank">
              <span>Prompt</span>
              <span>Concept</span>
              <span>Diff</span>
              <span>Review</span>
              <span>AI</span>
              <span>Source</span>
              <span>Action</span>
            </div>
            {questions.map((question) => (
              <div className="data-table__row data-table__row--question-bank" key={question._id}>
                <span>{question.prompt}</span>
                <span>{question.conceptIds.map((concept) => concept.name).join(", ")}</span>
                <span>{question.difficultyLevel}</span>
                <span><QuestionStatusBadge status={question.reviewStatus} /></span>
                <span><GeneratorBadge ready={question.approvedForGeneration} /></span>
                <span>{question.questionSource}</span>
                <button className="button button--secondary" onClick={() => setSelectedQuestionId(question._id)} type="button">Review</button>
              </div>
            ))}
          </div>
        </Card>
        <Card title="Review panel" subtitle={selectedQuestion ? "Teacher review decides what the AI generator is allowed to use." : "Select a question to review."}>
          {!selectedQuestion ? (
            <p className="support-copy">No question selected yet.</p>
          ) : (
            <div className="stack-grid">
              <div className="review-shell">
                <strong>{selectedQuestion.prompt}</strong>
                <p>{selectedQuestion.explanation}</p>
                <div className="inline-tags">
                  {selectedQuestion.conceptIds.map((concept) => <span className="tag" key={concept._id}>{concept.name}</span>)}
                  <span className="tag">Difficulty {selectedQuestion.difficultyLevel}</span>
                  <span className="tag">{selectedQuestion.questionType}</span>
                </div>
              </div>
              <label className="field">
                <span>Review notes</span>
                <textarea rows="5" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} />
              </label>
              <div className="action-row">
                <button className="button button--primary" onClick={() => handleReview("approved", true)} type="button">Approve for AI</button>
                <button className="button button--secondary" onClick={() => handleReview("in_review", false)} type="button">Keep in review</button>
                <button className="button button--secondary" onClick={() => handleReview("changes_requested", false)} type="button">Request changes</button>
              </div>
              <div className="support-copy">
                AI generation currently uses only school questions that are both <strong>approved</strong> and marked <strong>AI ready</strong>.
              </div>
            </div>
          )}
        </Card>
      </div>
      <Card title="Readiness notes" subtitle="What this workspace is now ready for.">
        <ul className="simple-list">
          <li>Class 10 questions can be added one by one with concept mapping and review state.</li>
          <li>Teacher review explicitly controls whether a question is eligible for AI generation.</li>
          <li>Practice/homework draft packs are generated only from approved school questions.</li>
        </ul>
      </Card>
    </div>
  );
}

function TeacherPracticeReviewManager({ data }) {
  const { items: loadedClassrooms, error: classroomError } = useResource("/api/classrooms");
  const availableClasses = (loadedClassrooms.length ? loadedClassrooms : data.classrooms ?? []).map((item) => ({
    id: item._id ?? item.id,
    label: `${item.name} (${item.gradeLevel})`
  }));
  const [selectedClass, setSelectedClass] = useState(availableClasses[0]?.id || "");
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [referenceSearch, setReferenceSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [message, setMessage] = useState("");

  const { data: previewPayload, loading: previewLoading, error: previewError } = useApiData(
    () => (selectedClass ? fetchJson(`/api/teacher/tasks/recommendations?classroomId=${encodeURIComponent(selectedClass)}`) : Promise.resolve({ plans: [] })),
    [selectedClass, refreshKey]
  );
  const { data: insightPayload } = useApiData(
    () => (selectedClass ? fetchJson(`/api/teacher/insights/students?classroomId=${encodeURIComponent(selectedClass)}`) : Promise.resolve({ students: [] })),
    [selectedClass, refreshKey]
  );
  const { data: referenceLibraryPayload, loading: referenceLoading, error: referenceError } = useApiData(() => {
    const params = new URLSearchParams({ gradeLevel: "10", limit: referenceSearch.trim() ? "80" : "24" });
    if (referenceSearch.trim()) params.set("q", referenceSearch.trim());
    return fetchJson(`/api/catalog/reference-questions?${params.toString()}`);
  }, [referenceSearch]);
  const { data: selectedReferencePayload } = useApiData(
    () => (selectedTemplateId ? fetchJson(`/api/catalog/reference-questions?templateId=${encodeURIComponent(selectedTemplateId)}`) : Promise.resolve({ referenceQuestions: [] })),
    [selectedTemplateId]
  );

  useEffect(() => {
    if (!selectedClass && availableClasses[0]?.id) setSelectedClass(availableClasses[0].id);
  }, [availableClasses, selectedClass]);

  const previewPlans = previewPayload?.plans ?? [];
  const insightByStudent = new Map((insightPayload?.students ?? []).map((item) => [String(item.studentId), item]));
  const studentNameMap = new Map([
    ...(data.roster ?? []).map((student) => [String(student.studentId ?? student.id ?? student._id ?? student.name), student.name]),
    ...(data.flaggedStudents ?? []).map((student) => [String(student.studentId), student.name]),
    ...(insightPayload?.students ?? []).map((student) => [String(student.studentId), student.name])
  ]);

  useEffect(() => {
    if (!selectedStudentId && previewPlans[0]?.studentId) {
      setSelectedStudentId(String(previewPlans[0].studentId));
      return;
    }
    if (selectedStudentId && !previewPlans.some((plan) => String(plan.studentId) === String(selectedStudentId))) {
      setSelectedStudentId(previewPlans[0] ? String(previewPlans[0].studentId) : "");
    }
  }, [previewPlans, selectedStudentId]);

  const activePlan = previewPlans.find((plan) => String(plan.studentId) === String(selectedStudentId)) ?? previewPlans[0] ?? null;
  const referenceIdsInPlan = new Set((activePlan?.items ?? []).map((item) => String(item.sourceReference?.templateQuestionId ?? "")).filter(Boolean));
  const referenceLibrary = referenceLibraryPayload?.referenceQuestions ?? [];
  const selectedReference = selectedReferencePayload?.referenceQuestions?.[0] ?? referenceLibrary.find((item) => String(item._id) === String(selectedTemplateId)) ?? null;

  useEffect(() => {
    const nextTemplateId = activePlan?.items?.find((item) => item.sourceReference?.templateQuestionId)?.sourceReference?.templateQuestionId ?? "";
    if (!selectedTemplateId && nextTemplateId) {
      setSelectedTemplateId(String(nextTemplateId));
      return;
    }
    if (selectedTemplateId && nextTemplateId && !referenceIdsInPlan.has(String(selectedTemplateId))) {
      setSelectedTemplateId(String(nextTemplateId));
    }
  }, [activePlan, referenceIdsInPlan, selectedTemplateId]);

  const candidateStudentIds = Array.from(new Set([
    ...previewPlans.map((plan) => String(plan.studentId)),
    ...(insightPayload?.students ?? []).map((student) => String(student.studentId))
  ])).filter(Boolean);
  const averageItems = previewPlans.length ? Math.round(previewPlans.reduce((sum, plan) => sum + (plan.items?.length ?? 0), 0) / previewPlans.length) : 0;
  const referencedItems = previewPlans.reduce((sum, plan) => sum + (plan.items ?? []).filter((item) => item.sourceReference?.templateQuestionId).length, 0);

  async function handleRefreshPlans() {
    try {
      setMessage("");
      if (!selectedClass) throw new Error("Select a classroom first.");
      if (candidateStudentIds.length === 0) throw new Error("No students are ready for review in this classroom yet.");
      await postJson("/api/teacher/tasks/precompute", { classroomId: selectedClass, studentIds: candidateStudentIds, refresh: true });
      setMessage("Generated practice was refreshed for this classroom.");
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setMessage(submitError.message);
    }
  }

  async function handleAssign(studentId) {
    try {
      setMessage("");
      await postJson("/api/teacher/tasks/assign", { classroomId: selectedClass, studentIds: [studentId] });
      setMessage(`Today's generated practice was assigned to ${studentNameMap.get(String(studentId)) ?? "the student"}.`);
      setRefreshKey((current) => current + 1);
    } catch (submitError) {
      setMessage(submitError.message);
    }
  }

  return (
    <div className="stack-grid">
      <div className="metric-row">
        <MetricCard label="Students with plans" value={String(previewPlans.length)} />
        <MetricCard label="Avg items per plan" value={String(averageItems)} />
        <MetricCard label="Reference-linked items" value={String(referencedItems)} />
        <MetricCard label="Library questions loaded" value={String(referenceLibrary.length)} />
      </div>
      {message ? <p className={message.includes("assigned") || message.includes("refreshed") ? "form-success" : "form-error"}>{message}</p> : null}
      {classroomError ? <p className="form-error">{classroomError}</p> : null}
      {previewError ? <p className="form-error">{previewError}</p> : null}
      <div className="split-grid">
        <Card title="Generated practice queue" subtitle="Review student plans before assigning them." action={<div className="toolbar-row"><select className="select select--compact" value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>{availableClasses.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select><button className="button button--secondary" onClick={handleRefreshPlans} type="button">Refresh plans</button></div>}>
          {previewLoading ? <p className="support-copy">Loading generated practice plans...</p> : null}
          {!previewLoading && previewPlans.length === 0 ? <p className="support-copy">No generated plans yet. Refresh plans after assignment submissions or class updates.</p> : null}
          <div className="compact-list">
            {previewPlans.map((plan) => {
              const studentId = String(plan.studentId);
              const studentInsight = insightByStudent.get(studentId);
              return (
                <article className={`compact-list__item compact-list__item--review ${String(selectedStudentId) === studentId ? "compact-list__item--active" : ""}`} key={studentId}>
                  <button className="review-select" onClick={() => setSelectedStudentId(studentId)} type="button">
                    <strong>{studentNameMap.get(studentId) ?? "Student"}</strong>
                    <div><p>{plan.conceptName}</p><span>{studentInsight?.summary ?? plan.rationale?.[0] ?? "Generated from weak-concept signals."}</span></div>
                  </button>
                  <div className="review-actions"><div className="inline-tags">{(plan.rationaleTags ?? []).map((tag) => <span className="tag" key={`${studentId}-${tag}`}>{tag}</span>)}</div><button className="button button--primary" onClick={() => handleAssign(studentId)} type="button">Assign today</button></div>
                </article>
              );
            })}
          </div>
        </Card>
        <Card title="Plan review" subtitle={activePlan ? "Inspect the generated questions and their source lineage." : "Select a student plan to review."}>
          {!activePlan ? <p className="support-copy">Choose a generated plan from the left to inspect it.</p> : <div className="stack-grid"><div className="review-shell"><div className="builder-preview__head"><strong>{studentNameMap.get(String(activePlan.studentId)) ?? "Student"} / {activePlan.conceptName}</strong><div className="inline-tags"><span className="tag">Difficulty {activePlan.targetDifficulty}</span><span className="tag">{activePlan.paceBand}</span><span className="tag">{activePlan.confidenceBand}</span></div></div>{activePlan.narrativeSummary ? <p>{activePlan.narrativeSummary}</p> : null}{activePlan.lesson?.body ? <p className="support-copy">{activePlan.lesson.body}</p> : null}</div><div className="data-table"><div className="data-table__head data-table__head--practice-review"><span>Generated item</span><span>Stage</span><span>Difficulty</span><span>Reference</span></div>{(activePlan.items ?? []).map((item) => { const templateId = String(item.sourceReference?.templateQuestionId ?? ""); const linkedReference = referenceLibrary.find((referenceItem) => String(referenceItem._id) === templateId); return <div className="data-table__row data-table__row--practice-review" key={`${activePlan._id}-${item.order}`}><span><strong>{item.prompt}</strong><small className="support-copy">{item.questionType.replace("_", " ")} / {item.generationMethod}</small></span><span>{item.stage}</span><span>Level {item.difficultyLevel}</span><span>{templateId ? <><button className="button button--secondary" onClick={() => setSelectedTemplateId(templateId)} type="button">View source</button><small className="support-copy">{linkedReference?.chapterName ?? item.sourceReference?.chapterCode ?? "Reference template"}{linkedReference?.topic ? ` / ${linkedReference.topic}` : item.sourceReference?.topic ? ` / ${item.sourceReference.topic}` : ""}</small></> : <small className="support-copy">No reference template linked</small>}</span></div>; })}</div></div>}
        </Card>
      </div>
      <div className="split-grid">
        <Card title="Reference question" subtitle="This is the canonical source item used as the retrieval base for the generated variant.">
          {selectedReference ? <div className="review-shell"><strong>{selectedReference.prompt}</strong><p>{selectedReference.explanation}</p><div className="inline-tags"><span className="tag">{selectedReference.chapterName}</span><span className="tag">{selectedReference.topic}</span><span className="tag">{selectedReference.questionType.replace("_", " ")}</span><span className="tag">Difficulty {selectedReference.difficultyLevel}</span><span className="tag">Q{selectedReference.questionIndex}</span></div>{selectedReference.options?.length ? <ul className="simple-list">{selectedReference.options.map((option) => <li key={option}>{option}</li>)}</ul> : null}<p className="support-copy">Answer: {selectedReference.correctAnswer}</p></div> : <p className="support-copy">Select “View source” on a generated question to inspect its reference item.</p>}
        </Card>
        <Card title="Reference library" subtitle="Browse the class 10 chapter library the adaptive engine is pulling from.">
          <label className="field"><span>Search chapter library</span><input value={referenceSearch} onChange={(event) => setReferenceSearch(event.target.value)} placeholder="Search by prompt, topic, or chapter" /></label>
          {referenceLoading ? <p className="support-copy top-space">Loading reference questions...</p> : null}
          {referenceError ? <p className="form-error top-space">{referenceError}</p> : null}
          <div className="compact-list top-space">
            {referenceLibrary.map((referenceItem) => <article className={`compact-list__item compact-list__item--review ${String(selectedTemplateId) === String(referenceItem._id) ? "compact-list__item--active" : ""}`} key={referenceItem._id}><button className="review-select" onClick={() => setSelectedTemplateId(String(referenceItem._id))} type="button"><strong>{referenceItem.prompt}</strong><div><p>{referenceItem.chapterName}</p><span>{referenceItem.topic} / {referenceItem.questionType.replace("_", " ")}</span></div></button><div className="review-actions"><div className="inline-tags"><span className="tag">Q{referenceItem.questionIndex}</span><span className="tag">Diff {referenceItem.difficultyLevel}</span>{referenceIdsInPlan.has(String(referenceItem._id)) ? <span className="tag">Used in selected plan</span> : null}</div></div></article>)}
          </div>
        </Card>
      </div>
      <Card title="Teacher workflow" subtitle="What this teacher workspace is optimized for now.">
        <ul className="simple-list">
          <li>Teachers review generated practice and assign it. They do not author question-bank entries from this portal.</li>
          <li>Every generated question can be traced back to a reference item in the Class 10 chapter library.</li>
          <li>Assignments are the main tracking loop now, so the engine adapts from assignment performance and current mastery signals.</li>
        </ul>
      </Card>
    </div>
  );
}

function useTeacherClassrooms(data) {
  const { items: loadedClassrooms, error: classroomError } = useResource("/api/classrooms");
  const availableClasses = useMemo(
    () =>
      (loadedClassrooms.length ? loadedClassrooms : data.classrooms ?? [])
        .map((item) => ({
          id: String(item._id ?? item.id ?? ""),
          label: `${item.name} (${item.gradeLevel})`
        }))
        .filter((item) => item.id),
    [data.classrooms, loadedClassrooms]
  );
  const [selectedClass, setSelectedClass] = useState(availableClasses[0]?.id || "");

  useEffect(() => {
    if (!selectedClass && availableClasses[0]?.id) {
      setSelectedClass(availableClasses[0].id);
      return;
    }
    if (selectedClass && !availableClasses.some((item) => item.id === selectedClass)) {
      setSelectedClass(availableClasses[0]?.id ?? "");
    }
  }, [availableClasses, selectedClass]);

  return { availableClasses, selectedClass, setSelectedClass, classroomError };
}

function useTeacherSignals(selectedClass, refreshKey) {
  const recommendationsState = useApiData(
    () =>
      selectedClass
        ? fetchJson(`/api/teacher/tasks/recommendations?classroomId=${encodeURIComponent(selectedClass)}`)
        : Promise.resolve({ plans: [] }),
    [selectedClass, refreshKey]
  );
  const insightsState = useApiData(
    () =>
      selectedClass
        ? fetchJson(`/api/teacher/insights/students?classroomId=${encodeURIComponent(selectedClass)}`)
        : Promise.resolve({ students: [], metrics: [] }),
    [selectedClass, refreshKey]
  );
  return { recommendationsState, insightsState };
}

function deriveTeacherReviewRisk(student, flaggedStudent) {
  if (flaggedStudent?.risk) {
    return flaggedStudent.risk;
  }

  if (student?.status === "Stable") {
    return "Low";
  }

  if (student?.status === "Monitor") {
    return "Medium";
  }

  return "High";
}

function getTeacherReviewPlanStatus(previewPlan, insight) {
  const assignmentState = insight?.latestAssignmentStatus ?? (previewPlan?.status || "none");

  if (!previewPlan) {
    return { label: "Needs generation", tone: "pending", assignmentState: "none" };
  }

  if (assignmentState === "completed") {
    return { label: "Completed", tone: "complete", assignmentState };
  }

  if (assignmentState === "assigned") {
    return { label: "Assigned", tone: "assigned", assignmentState };
  }

  if (assignmentState === "started" || assignmentState === "in_progress") {
    return { label: "In progress", tone: "assigned", assignmentState };
  }

  return { label: "Ready for review", tone: "ready", assignmentState: "planned" };
}

function formatTeacherReviewAssignmentState(assignmentState) {
  switch (assignmentState) {
    case "assigned":
      return "Assigned and waiting";
    case "started":
      return "Student has started";
    case "completed":
      return "Completed";
    case "planned":
      return "Ready to assign";
    default:
      return "Not generated yet";
  }
}

function buildTeacherReviewRows({ data, selectedClass, previewPlans, insightStudents }) {
  const filteredRoster = (data.roster ?? []).filter(
    (student) => !selectedClass || String(student.classroomId) === String(selectedClass)
  );
  const filteredFlaggedStudents = (data.flaggedStudents ?? []).filter(
    (student) => !selectedClass || String(student.classroomId) === String(selectedClass)
  );
  const previewByStudent = new Map(previewPlans.map((plan) => [String(plan.studentId), plan]));
  const insightByStudent = new Map(insightStudents.map((item) => [String(item.studentId), item]));
  const rosterByStudent = new Map(
    filteredRoster.map((student) => [String(student.studentId ?? student.id ?? student._id ?? student.name), student])
  );
  const flaggedByStudent = new Map(filteredFlaggedStudents.map((student) => [String(student.studentId), student]));

  const reviewStudentIds = Array.from(
    new Set([
      ...rosterByStudent.keys(),
      ...flaggedByStudent.keys(),
      ...previewByStudent.keys(),
      ...insightByStudent.keys()
    ])
  ).filter(Boolean);

  const riskOrder = { High: 0, Medium: 1, Low: 2 };

  return reviewStudentIds
    .map((studentId) => {
      const rosterStudent = rosterByStudent.get(studentId);
      const flaggedStudent = flaggedByStudent.get(studentId);
      const previewPlan = previewByStudent.get(studentId) ?? null;
      const insight = insightByStudent.get(studentId) ?? null;
      const weakConcepts =
        flaggedStudent?.weakConcepts?.length
          ? flaggedStudent.weakConcepts
          : insight?.weakestConcepts?.length
            ? insight.weakestConcepts
            : [];
      const planStatus = getTeacherReviewPlanStatus(previewPlan, insight);

      return {
        studentId,
        name: rosterStudent?.name ?? flaggedStudent?.name ?? insight?.name ?? "Student",
        risk: deriveTeacherReviewRisk(rosterStudent, flaggedStudent),
        weakConcepts,
        focusConcept: previewPlan?.conceptName ?? weakConcepts[0] ?? "Plan not generated yet",
        summary:
          insight?.summary ??
          previewPlan?.narrativeSummary ??
          previewPlan?.rationale?.[0] ??
          "Generate assignments first, then review this student in the workspace.",
        planStatus,
        previewPlan,
        insight
      };
    })
    .sort((left, right) => {
      const leftReady = left.previewPlan ? 0 : 1;
      const rightReady = right.previewPlan ? 0 : 1;
      if (leftReady !== rightReady) {
        return leftReady - rightReady;
      }

      const riskDelta = (riskOrder[left.risk] ?? 3) - (riskOrder[right.risk] ?? 3);
      if (riskDelta !== 0) {
        return riskDelta;
      }

      return left.name.localeCompare(right.name);
    });
}

function TeacherReviewAssignments({ data }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { availableClasses, selectedClass, setSelectedClass, classroomError } = useTeacherClassrooms(data);
  const [message, setMessage] = useState("");
  const assignmentsState = useTeacherAssignmentsData(selectedClass);
  const preferredClassroomId = new URLSearchParams(location.search).get("classroomId") ?? "";

  useEffect(() => {
    if (
      preferredClassroomId &&
      preferredClassroomId !== selectedClass &&
      availableClasses.some((item) => item.id === preferredClassroomId)
    ) {
      setSelectedClass(preferredClassroomId);
    }
  }, [availableClasses, preferredClassroomId, selectedClass, setSelectedClass]);

  const pathStudents = assignmentsState.data?.students ?? [];
  const summaryCards = assignmentsState.data?.summaryCards ?? [];
  const selectedClassLabel = availableClasses.find((item) => item.id === selectedClass)?.label ?? "Selected class";

  async function handleAssign(studentIds, successMessage) {
    try {
      setMessage("");
      if (!selectedClass) throw new Error("Select a classroom first.");
      if (studentIds.length === 0) throw new Error("No students found in this class.");
      await postJson("/api/teacher/tasks/assign", {
        classroomId: selectedClass,
        studentIds
      });
      setMessage(successMessage);
      assignmentsState.refresh();
    } catch (submitError) {
      setMessage(submitError.message);
    }
  }

  return (
    <>
      <PortalHeader
        title="Assignments"
        subtitle="Assign or resume the chapter path for each learner. The system keeps serving batches until mastery is reached."
        actions={
          <div className="toolbar-row">
            <select className="select" value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
              {availableClasses.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <button
              className="button button--primary"
              disabled={!selectedClass || pathStudents.length === 0}
              onClick={() => handleAssign(pathStudents.map((student) => student.studentId), "Class path assigned successfully.")}
              type="button"
            >
              Assign class path
            </button>
          </div>
        }
      />
      <div className="metric-row">
        {summaryCards.map((item) => <MetricCard key={item.label} label={item.label} value={item.value} />)}
      </div>
      {classroomError ? <p className="form-error">{classroomError}</p> : null}
      {assignmentsState.error ? <p className="form-error">{assignmentsState.error}</p> : null}
      {message ? <p className={/assigned|successfully|resumed/i.test(message) ? "form-success" : "form-error"}>{message}</p> : null}
      <Card
        title={`Students in ${selectedClassLabel}`}
        subtitle="Use one class-wise list. Open a learner only when you want to inspect the latest generated batch."
      >
        {assignmentsState.loading ? <p className="support-copy">Loading class path status...</p> : null}
        {!assignmentsState.loading && pathStudents.length === 0 ? (
          <p className="support-copy">No students are available in this class yet. Add students, then assign the class path.</p>
        ) : null}
        <div className="data-table">
          <div className="data-table__head data-table__head--review-list">
            <span>Student</span>
            <span>Current chapter</span>
            <span>Mastery</span>
            <span>Risk</span>
            <span>Actions</span>
          </div>
          {pathStudents.map((student) => {
            const assignLabel = student.status === "not_started" ? "Assign path" : student.status === "completed" ? "Completed" : "Resume path";
            const assignDisabled = student.status === "completed";
            return (
              <div className="data-table__row data-table__row--review-list" key={student.studentId}>
                <span className="review-list__student">
                  <strong>{student.name}</strong>
                  <small className="support-copy">{student.summary}</small>
                  <small className="support-copy">
                    Last active: {formatLastActive(student.lastPracticedAt ?? student.latestAssignmentDate ?? "")}
                  </small>
                </span>
                <span className="review-list__focus">
                  <strong>Chapter {student.currentChapterNumber ?? "-"} - {student.currentChapterName || "Not started"}</strong>
                  <small className="support-copy">
                    {student.completedChaptersCount ?? 0} chapters completed
                  </small>
                </span>
                <span className="review-list__status">
                  <strong>{student.currentMastery ?? 0}%</strong>
                  <small className="support-copy">
                    {(student.dailyMasteryGoal ?? 0) > (student.dailyMasteryStart ?? 0)
                      ? `Today: ${student.dailyMasteryStart}% -> ${student.dailyMasteryGoal}%${student.dailyTargetDate ? ` / ${student.dailyTargetDate}` : ""}`
                      : (student.dailyTargetStatus ?? "in_progress").replace(/_/g, " ")}
                  </small>
                </span>
                <span className="review-list__status">
                  <StatusBadge risk={student.riskLabel ?? "Low"} />
                  <small className="support-copy">{student.riskReason ?? (student.latestAssignmentStatus ?? "none").replace(/_/g, " ")}</small>
                </span>
                <span className="button-group">
                  <button
                    className="button button--secondary"
                    disabled={!selectedClass}
                    onClick={() => navigate(`/teacher/assignments/${selectedClass}/${student.studentId}`)}
                    type="button"
                  >
                    View batch
                  </button>
                  <button
                    className="button button--primary"
                    disabled={assignDisabled}
                    onClick={() => handleAssign([student.studentId], `${assignLabel} completed for ${student.name}.`)}
                    type="button"
                  >
                    {assignLabel}
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      </Card>
    </>
  );
}

function TeacherAssignmentWorkspace({ data }) {
  const navigate = useNavigate();
  const { classroomId = "", studentId = "" } = useParams();
  const [message, setMessage] = useState("");
  const workspaceState = useTeacherAssignmentWorkspaceData(classroomId, studentId);
  const availableClasses = useMemo(
    () =>
      ((workspaceState.data?.classrooms ?? data.classrooms ?? []))
        .map((item) => ({
          id: String(item._id ?? item.id ?? ""),
          label: `${item.name} (${item.gradeLevel})`
        }))
        .filter((item) => item.id),
    [data.classrooms, workspaceState.data]
  );
  const selectedClassLabel = availableClasses.find((item) => item.id === classroomId)?.label ?? "Selected class";
  const selectedStudent = workspaceState.data?.student ?? null;
  const activePlan = workspaceState.data?.latestPlan ?? null;
  const activeInsight = workspaceState.data?.insight ?? null;
  const assignLabel =
    selectedStudent?.status === "completed" ? "Completed" : selectedStudent?.status === "not_started" ? "Assign path" : "Resume path";
  const assignDisabled = selectedStudent?.status === "completed";

  async function handleAssign() {
    try {
      setMessage("");
      if (!classroomId || !studentId) throw new Error("Select a valid class and student.");
      await postJson("/api/teacher/tasks/assign", {
        classroomId,
        studentIds: [studentId]
      });
      setMessage("Today's task was assigned successfully.");
      workspaceState.refresh();
    } catch (submitError) {
      setMessage(submitError.message);
    }
  }

  return (
    <>
      <PortalHeader
        title="Assignment Workspace"
        subtitle="Read-only view of the latest generated batch for one learner."
        actions={
          <div className="toolbar-row">
            <button
              className="button button--secondary"
              onClick={() => navigate(`/teacher/assignments?classroomId=${encodeURIComponent(classroomId)}`)}
              type="button"
            >
              Back to class list
            </button>
            <span className="tag">{selectedClassLabel}</span>
          </div>
        }
      />
      {workspaceState.error ? <p className="form-error">{workspaceState.error}</p> : null}
      {message ? <p className={message.includes("successfully") ? "form-success" : "form-error"}>{message}</p> : null}
      {workspaceState.loading ? <p className="support-copy">Loading workspace...</p> : null}
      {!activePlan ? (
        <Card title="No current batch found" subtitle="Start or resume the student path and the system will prepare the next batch automatically.">
          <div className="button-group">
            <button
              className="button button--primary"
              disabled={assignDisabled}
              onClick={handleAssign}
              type="button"
            >
              {assignLabel}
            </button>
            <button
              className="button button--secondary"
              onClick={() => navigate(`/teacher/assignments?classroomId=${encodeURIComponent(classroomId)}`)}
              type="button"
            >
              Back to assignments
            </button>
          </div>
        </Card>
      ) : (
        <section className="workspace-shell">
          <div className="workspace-shell__header">
            <div className="workspace-shell__copy">
              <h2>{selectedStudent?.name ?? "Student"} / Chapter {activePlan.chapterNumber} - {activePlan.conceptName}</h2>
              <p>{activeInsight?.summary ?? activePlan.narrativeSummary ?? activePlan.rationale?.[0] ?? "Adaptive sequence generated from current chapter signals."}</p>
            </div>
            <div className="workspace-shell__actions">
              <div className="inline-tags">
                <span className="tag">{selectedStudent?.status ? formatPathStatusLabel(selectedStudent.status) : "Working"}</span>
                {selectedStudent?.riskLabel ? <span className="tag">{selectedStudent.riskLabel} risk</span> : null}
                <span className="tag">{selectedStudent?.currentMastery ?? 0}% mastery</span>
                  {(selectedStudent?.dailyMasteryGoal ?? 0) > (selectedStudent?.dailyMasteryStart ?? 0)
                    ? <span className="tag">{`${selectedStudent?.dailyMasteryStart}% -> ${selectedStudent?.dailyMasteryGoal}%`}</span>
                    : null}
                <span className="tag">Difficulty {activePlan.targetDifficulty}</span>
                {activePlan.paceBand ? <span className="tag">{activePlan.paceBand}</span> : null}
                {activePlan.confidenceBand ? <span className="tag">{activePlan.confidenceBand}</span> : null}
                <span className="tag">{activePlan.items?.length ?? 0} items</span>
              </div>
              <button className="button button--primary" disabled={assignDisabled} onClick={handleAssign} type="button">
                {assignLabel}
              </button>
            </div>
          </div>
          {activePlan.lesson?.body ? <div className="workspace-note">{activePlan.lesson.body}</div> : null}
          <div className="question-stack">
            {(activePlan.items ?? []).map((item, index) => (
              <article className={`question-card ${item.stage === "checkpoint" ? "question-card--checkpoint" : ""}`} key={`${activePlan._id}-${item.order}`}>
                <div className="question-card__header">
                  <strong>Question {index + 1}</strong>
                  <div className="inline-tags">
                    <span className="tag">{item.stage}</span>
                    <span className="tag">Level {item.difficultyLevel}</span>
                    <span className="tag">{(item.questionType ?? "item").replace("_", " ")}</span>
                  </div>
                </div>
                <p className="question-card__prompt">{item.prompt}</p>
                {item.options?.length ? (
                  <ol className="question-card__options">
                    {item.options.map((option, optionIndex) => (
                      <li key={`${activePlan._id}-${item.order}-${optionIndex}`}>{option}</li>
                    ))}
                  </ol>
                ) : null}
                <div className="question-card__meta">
                  <span>Expected time: {item.expectedTimeSec ?? 60}s</span>
                  <span>Generator: {(item.generationMethod ?? "template_copy").replaceAll("_", " ")}</span>
                </div>
                {(item.sourceReference?.chapterCode || item.sourceReference?.topic) ? (
                  <div className="question-card__source">
                    Reference: {item.sourceReference?.chapterCode || "Chapter source"}
                    {item.sourceReference?.topic ? ` / ${item.sourceReference.topic}` : ""}
                  </div>
                ) : null}
                {item.hint || item.explanation ? (
                  <div className="question-card__details">
                    {item.hint ? (
                      <div className="question-card__detail-block">
                        <strong>Hint</strong>
                        <p>{item.hint}</p>
                      </div>
                    ) : null}
                    {item.explanation ? (
                      <div className="question-card__detail-block">
                        <strong>Why this works</strong>
                        <p>{item.explanation}</p>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function TeacherAnalysis({ data }) {
  const { availableClasses, selectedClass, setSelectedClass, classroomError } = useTeacherClassrooms(data);
  const { recommendationsState, insightsState } = useTeacherSignals(selectedClass, 0);
  const { data: reportPayload, loading: reportLoading, error: reportError } = useTeacherReportsData(selectedClass);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const students = insightsState.data?.students ?? [];
  useEffect(() => {
    if (!selectedStudentId && students[0]?.studentId) {
      setSelectedStudentId(String(students[0].studentId));
      return;
    }
    if (selectedStudentId && !students.some((student) => String(student.studentId) === String(selectedStudentId))) {
      setSelectedStudentId(students[0] ? String(students[0].studentId) : "");
    }
  }, [selectedStudentId, students]);

  const selectedStudent = students.find((student) => String(student.studentId) === String(selectedStudentId)) ?? null;
  const studentGrowth = (reportPayload?.studentGrowth ?? []).find((item) => item.name === selectedStudent?.name) ?? null;
  const classMetrics = insightsState.data?.metrics ?? [];
  const classConcepts = reportPayload?.interventionBreakdown ?? [];
  const plansReady = recommendationsState.data?.plans?.length ?? 0;

  return (
    <>
      <PortalHeader
        title="Class and Student Analysis"
        subtitle="See class-level status and deep insight for one student."
        actions={
          <div className="toolbar-row">
            <select className="select" value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)}>
              {availableClasses.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
            <select className="select" value={selectedStudentId} onChange={(event) => setSelectedStudentId(event.target.value)}>
              <option value="">Select student</option>
              {students.map((student) => (
                <option key={student.studentId} value={student.studentId}>{student.name}</option>
              ))}
            </select>
          </div>
        }
      />
      {classroomError ? <p className="form-error">{classroomError}</p> : null}
      {insightsState.error ? <p className="form-error">Could not load analysis insights.</p> : null}
      {reportError ? <p className="form-error">Could not load reporting metrics.</p> : null}
      <div className="metric-row">
        <MetricCard label="Plans ready" value={String(plansReady)} />
        <MetricCard label={classMetrics[0]?.label ?? "Students analyzed"} value={classMetrics[0]?.value ?? "0"} />
        <MetricCard label={classMetrics[1]?.label ?? "Overloaded"} value={classMetrics[1]?.value ?? "0"} />
        <MetricCard label={classMetrics[2]?.label ?? "Under-challenged"} value={classMetrics[2]?.value ?? "0"} />
      </div>
      <div className="split-grid top-space">
        <Card title="Class analysis" subtitle={reportLoading ? "Loading class trends..." : "Current class-level concept and risk signals."}>
          <ul className="simple-list">
            {classConcepts.map((concept, index) => (
              <li key={`${concept.concept ?? concept.name ?? "concept"}-${index}`}>
                {(concept.concept ?? concept.name)}: {concept.flagged ?? concept.studentsFlagged ?? 0}
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Student analysis" subtitle={selectedStudent ? "Selected student insight snapshot." : "Select one student to inspect details."}>
          {!selectedStudent ? (
            <p className="support-copy">Choose a student to view individual analysis.</p>
          ) : (
            <div className="stack-grid">
              <strong>{selectedStudent.name}</strong>
              <p>{selectedStudent.summary}</p>
              <div className="inline-tags">
                {(selectedStudent.tags ?? []).map((tag) => <span className="tag" key={`${selectedStudent.studentId}-${tag}`}>{tag}</span>)}
              </div>
              <ul className="simple-list">
                <li>Weak concepts: {(selectedStudent.weakestConcepts ?? []).join(", ") || "None"}</li>
                <li>Latest assignment: {selectedStudent.latestAssignmentStatus ?? "none"}</li>
                <li>Growth: {studentGrowth ? `${studentGrowth.improvement}%` : "Not available yet"}</li>
              </ul>
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

function RegisterSchoolPage() {
  const navigate = useNavigate();
  const { registerSchool } = useAuth();
  const [form, setForm] = useState({ schoolName: "", adminName: "", email: "", password: "" });
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setError("");
      const destination = await registerSchool(form);
      navigate(destination, { replace: true });
    } catch (submitError) {
      setError(submitError.message);
    }
  }

  return (
    <main className="login-screen login-screen--admin">
      <form className="login-card login-card--wide" onSubmit={handleSubmit}>
        <div className="login-card__head">
          <span className="login-card__eyebrow">School onboarding</span>
          <h1>Register school</h1>
          <p>Create a real school workspace and its first admin account.</p>
        </div>
        <label className="field"><span>School name</span><input value={form.schoolName} onChange={(event) => setForm({ ...form, schoolName: event.target.value })} /></label>
        <label className="field"><span>Admin name</span><input value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} /></label>
        <label className="field"><span>Admin email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label className="field"><span>Password</span><input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        {error ? <p className="form-error">{error}</p> : null}
        <button className="button button--primary button--full" type="submit">Create school</button>
      </form>
    </main>
  );
}

function TeacherPortal() {
  return (
    <PortalDataLoader role="teacher">
      {(data) => (
        <Routes>
          <Route element={<DashboardLayout role="teacher"><Outlet /></DashboardLayout>}>
            <Route path="dashboard" element={<TeacherDashboard data={data} />} />
            <Route path="generate" element={<Navigate replace to="/teacher/assignments" />} />
            <Route path="review" element={<Navigate replace to="/teacher/assignments" />} />
            <Route path="reports" element={<TeacherReports data={data} />} />
            <Route path="analysis" element={<TeacherAnalysis data={data} />} />
            <Route path="classroom" element={<TeacherClassroom data={data} />} />
            <Route path="assignments" element={<TeacherReviewAssignments data={data} />} />
            <Route path="practice-review" element={<Navigate replace to="/teacher/assignments" />} />
            <Route path="question-bank" element={<Navigate replace to="/teacher/assignments" />} />
            <Route path="*" element={<Navigate replace to="/teacher/dashboard" />} />
          </Route>
          <Route path="review/:classroomId/:studentId" element={<FocusLayout role="teacher"><TeacherAssignmentWorkspace data={data} /></FocusLayout>} />
          <Route path="assignments/:classroomId/:studentId" element={<FocusLayout role="teacher"><TeacherAssignmentWorkspace data={data} /></FocusLayout>} />
        </Routes>
      )}
    </PortalDataLoader>
  );
}

function AdminPortal() {
  return (
    <DashboardLayout role="admin">
      <PortalDataLoader role="admin">
        {(data) => (
          <Routes>
            <Route path="dashboard" element={<AdminDashboard data={data} />} />
            <Route path="schools" element={<AdminSchools data={data} />} />
            <Route path="reports" element={<AdminReports data={data} />} />
            <Route path="*" element={<Navigate replace to="/admin/dashboard" />} />
          </Routes>
        )}
      </PortalDataLoader>
    </DashboardLayout>
  );
}

function StudentPortal() {
  const { currentUser } = useAuth();
  const studentGradeLevel = extractGradeLevel(currentUser?.user?.gradeLevel ?? currentUser?.user?.classroom);
  const isSupportedStudentGrade = !studentGradeLevel || studentGradeLevel === "10";

  return (
    <PortalDataLoader role="student">
      {(data) => (
        <Routes>
          <Route element={<DashboardLayout role="student"><Outlet /></DashboardLayout>}>
            <Route path="home" element={isSupportedStudentGrade ? <StudentHome data={data} /> : <StudentGradeComingSoon gradeLevel={studentGradeLevel} />} />
            <Route path="practice" element={isSupportedStudentGrade ? <StudentPractice data={data} /> : <StudentGradeComingSoon gradeLevel={studentGradeLevel} />} />
            <Route path="progress" element={isSupportedStudentGrade ? <StudentProgress data={data} /> : <StudentGradeComingSoon gradeLevel={studentGradeLevel} />} />
            <Route path="*" element={<Navigate replace to="/student/home" />} />
          </Route>
          <Route
            path="practice/:assignmentId"
            element={
              isSupportedStudentGrade
                ? <FocusLayout role="student"><StudentAssignmentOverview data={data} /></FocusLayout>
                : <Navigate replace to="/student/home" />
            }
          />
          <Route
            path="practice/:assignmentId/q/:questionIndex"
            element={
              isSupportedStudentGrade
                ? <FocusLayout role="student"><StudentQuestionWorkspace data={data} /></FocusLayout>
                : <Navigate replace to="/student/home" />
            }
          />
        </Routes>
      )}
    </PortalDataLoader>
  );
}

function ParentPortal() {
  return (
    <DashboardLayout role="parent">
      <PortalDataLoader role="parent">
        {(data) => (
          <Routes>
            <Route path="home" element={<ParentHome data={data} />} />
            <Route path="*" element={<Navigate replace to="/parent/home" />} />
          </Routes>
        )}
      </PortalDataLoader>
    </DashboardLayout>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate replace to="/login/teacher" />} />
      <Route path="/register-school" element={<RegisterSchoolPage />} />
      <Route path="/login/:role" element={<LoginPage />} />
      <Route element={<ProtectedRoute role="admin" />}><Route path="/admin/*" element={<AdminPortal />} /></Route>
      <Route element={<ProtectedRoute role="teacher" />}><Route path="/teacher/*" element={<TeacherPortal />} /></Route>
      <Route element={<ProtectedRoute role="student" />}><Route path="/student/*" element={<StudentPortal />} /></Route>
      <Route element={<ProtectedRoute role="parent" />}><Route path="/parent/*" element={<ParentPortal />} /></Route>
      <Route path="*" element={<Navigate replace to="/login/teacher" />} />
    </Routes>
  );
}

export default function AppRouter() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
