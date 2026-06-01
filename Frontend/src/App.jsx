import { useEffect, useMemo, useRef, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import "./App.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const STORAGE_THEME_KEY = "todos-theme";
const STORAGE_CACHE_KEY = "todos-cache";

const PRIORITIES = [
  { id: "low", label: "Low", color: "#10b981" },
  { id: "medium", label: "Medium", color: "#f59e0b" },
  { id: "high", label: "High", color: "#ef4444" },
];

const SORT_OPTIONS = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "priority", label: "Priority" },
  { id: "due", label: "Due date" },
];

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function readCache() {
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCache(todos) {
  try {
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(todos));
  } catch {
    /* ignore */
  }
}

function toDateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatDueDate(value) {
  if (!value) return null;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dueDay = new Date(due);
  dueDay.setHours(0, 0, 0, 0);

  if (dueDay.getTime() === today.getTime()) {
    return { label: "Today", tone: "today" };
  }
  if (dueDay.getTime() === tomorrow.getTime()) {
    return { label: "Tomorrow", tone: "soon" };
  }
  if (dueDay < today) {
    return { label: `Overdue · ${due.toLocaleDateString()}`, tone: "overdue" };
  }
  return { label: due.toLocaleDateString(), tone: "future" };
}

function priorityMeta(id) {
  return PRIORITIES.find((p) => p.id === id) || PRIORITIES[1];
}

function sortTodos(list, sortBy) {
  const copy = [...list];
  if (sortBy === "oldest") {
    copy.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  } else if (sortBy === "priority") {
    copy.sort(
      (a, b) =>
        (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1)
    );
  } else if (sortBy === "due") {
    copy.sort((a, b) => {
      const av = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
      const bv = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
      return av - bv;
    });
  } else {
    copy.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  return copy;
}

function ConfettiBurst() {
  const pieces = useMemo(() => {
    const hash = (n) => {
      const x = Math.sin(n * 9301 + 49297) * 233280;
      return x - Math.floor(x);
    };
    return Array.from({ length: 36 }, (_, i) => ({
      id: i,
      left: hash(i * 3 + 1) * 100,
      delay: hash(i * 3 + 2) * 0.2,
      rotate: hash(i * 3 + 3) * 360,
      color: [
        "#7c3aed",
        "#ec4899",
        "#f59e0b",
        "#10b981",
        "#3b82f6",
        "#ef4444",
      ][i % 6],
    }));
  }, []);
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={{
            left: `${p.left}%`,
            background: p.color,
            animationDelay: `${p.delay}s`,
            transform: `rotate(${p.rotate}deg)`,
          }}
        />
      ))}
    </div>
  );
}

function ProgressRing({ percent }) {
  const size = 88;
  const stroke = 9;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <div className="progress-ring" role="img" aria-label={`${percent}% complete`}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--ring-track)"
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#progressGradient)"
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="progress-ring-fill"
        />
        <defs>
          <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
      </svg>
      <div className="progress-ring-text">
        <span className="progress-ring-value">{percent}%</span>
        <span className="progress-ring-label">Done</span>
      </div>
    </div>
  );
}

export default function Todo() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState("");
  const [todos, setTodos] = useState(() => readCache());
  const [loading, setLoading] = useState(true);
  const [apiOnline, setApiOnline] = useState(true);
  const [editId, setEditId] = useState(-1);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("medium");
  const [editDueDate, setEditDueDate] = useState("");
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [search, setSearch] = useState("");
  const [removingId, setRemovingId] = useState(null);
  const [theme, setTheme] = useState(getInitialTheme);
  const [showCelebration, setShowCelebration] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const titleRef = useRef(null);
  const searchRef = useRef(null);

  useEffect(() => {
    applyTheme(theme);
    window.localStorage.setItem(STORAGE_THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    writeCache(todos);
  }, [todos]);

  useEffect(() => {
    const onKey = (e) => {
      const isMeta = e.metaKey || e.ctrlKey;
      if (isMeta && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      } else if (isMeta && e.key.toLowerCase() === "n") {
        e.preventDefault();
        titleRef.current?.focus();
      } else if (e.key === "Escape") {
        if (editId !== -1) handleEditCancel();
        if (searchFocused) searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editId, searchFocused]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));

  const getItems = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL + "/todos");
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();
      setTodos(data);
      setApiOnline(true);
    } catch {
      setApiOnline(false);
      toast.error("Server unreachable — showing cached tasks");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getItems();
  }, []);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast.error("Please fill in both fields");
      return;
    }
    const payload = {
      title: title.trim(),
      description: description.trim(),
      priority,
      dueDate: dueDate || null,
    };
    try {
      const res = await fetch(API_URL + "/todos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const newTodo = await res.json();
      setTodos((prev) => [newTodo, ...prev]);
      setApiOnline(true);
      toast.success("Task added!");
    } catch {
      const localTodo = {
        _id: `local-${Date.now()}`,
        ...payload,
        completed: false,
        createdAt: new Date().toISOString(),
        __local: true,
      };
      setTodos((prev) => [localTodo, ...prev]);
      setApiOnline(false);
      toast("Saved locally (offline)", { icon: "💾" });
    }
    setTitle("");
    setDescription("");
    setPriority("medium");
    setDueDate("");
  };

  const handleEdit = (item) => {
    setEditId(item._id);
    setEditTitle(item.title);
    setEditDescription(item.description);
    setEditPriority(item.priority || "medium");
    setEditDueDate(toDateInputValue(item.dueDate));
  };

  const handleUpdate = async () => {
    if (!editTitle.trim() || !editDescription.trim()) {
      toast.error("Fields cannot be empty");
      return;
    }
    const payload = {
      title: editTitle.trim(),
      description: editDescription.trim(),
      priority: editPriority,
      dueDate: editDueDate || null,
    };
    try {
      const res = await fetch(API_URL + "/todos/" + editId, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTodos((prev) => prev.map((t) => (t._id === editId ? updated : t)));
      setApiOnline(true);
      toast.success("Task updated!");
    } catch {
      setTodos((prev) =>
        prev.map((t) =>
          t._id === editId ? { ...t, ...payload } : t
        )
      );
      setApiOnline(false);
      toast("Updated locally (offline)", { icon: "💾" });
    }
    setEditId(-1);
    setEditTitle("");
    setEditDescription("");
    setEditPriority("medium");
    setEditDueDate("");
  };

  const handleEditCancel = () => {
    setEditId(-1);
    setEditTitle("");
    setEditDescription("");
    setEditPriority("medium");
    setEditDueDate("");
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this task?")) return;
    setRemovingId(id);
    setTimeout(async () => {
      try {
        await fetch(API_URL + "/todos/" + id, { method: "DELETE" });
        setApiOnline(true);
      } catch {
        setApiOnline(false);
      }
      setTodos((prev) => prev.filter((item) => item._id !== id));
      setRemovingId(null);
      toast.success("Task deleted");
    }, 250);
  };

  const handleToggleComplete = async (item) => {
    const next = !item.completed;
    setTodos((prev) =>
      prev.map((t) => (t._id === item._id ? { ...t, completed: next } : t))
    );
    try {
      const res = await fetch(API_URL + "/todos/" + item._id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: next }),
      });
      if (!res.ok) throw new Error();
      const updated = await res.json();
      setTodos((prev) => prev.map((t) => (t._id === item._id ? updated : t)));
      setApiOnline(true);
    } catch {
      setApiOnline(false);
    }
  };

  const handleClearCompleted = async () => {
    const completed = todos.filter((t) => t.completed);
    if (completed.length === 0) return;
    if (!window.confirm(`Delete ${completed.length} completed task(s)?`)) return;
    setTodos((prev) => prev.filter((t) => !t.completed));
    toast.success("Completed tasks cleared");
    await Promise.allSettled(
      completed.map((t) =>
        t.__local
          ? Promise.resolve()
          : fetch(API_URL + "/todos/" + t._id, { method: "DELETE" }).catch(
              () => null
            )
      )
    );
  };

  const stats = useMemo(() => {
    const total = todos.length;
    const completed = todos.filter((t) => t.completed).length;
    return {
      total,
      completed,
      active: total - completed,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100),
    };
  }, [todos]);

  useEffect(() => {
    if (
      stats.total > 0 &&
      stats.completed === stats.total &&
      !showCelebration
    ) {
      setShowCelebration(true);
      toast.success("All tasks completed! 🎉");
      const t = setTimeout(() => setShowCelebration(false), 3500);
      return () => clearTimeout(t);
    }
    if (stats.completed < stats.total) {
      setShowCelebration(false);
    }
  }, [stats, showCelebration]);

  const visibleTodos = useMemo(() => {
    let list = todos;
    if (filter === "active") list = list.filter((t) => !t.completed);
    if (filter === "completed") list = list.filter((t) => t.completed);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q)
      );
    }
    return sortTodos(list, sortBy);
  }, [todos, filter, search, sortBy]);

  return (
    <div className="app-shell">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 2500,
          style: {
            background:
              theme === "dark"
                ? "rgba(30, 20, 60, 0.95)"
                : "rgba(255, 255, 255, 0.95)",
            color: theme === "dark" ? "#f5f3ff" : "#1e1b4b",
            border:
              theme === "dark"
                ? "1px solid rgba(168, 85, 247, 0.3)"
                : "1px solid rgba(124, 58, 237, 0.2)",
            borderRadius: "12px",
            padding: "12px 18px",
            backdropFilter: "blur(10px)",
            fontWeight: 500,
          },
        }}
      />

      {showCelebration && <ConfettiBurst />}

      <div className="container">
        <div className="app-header">
          <h1>
            Todo App <span className="emoji">✨</span>
          </h1>
          <p>Stay organized, get things done</p>

          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            )}
          </button>
        </div>

        {!apiOnline && (
          <div className="offline-banner">
            <span>●</span> Offline mode — changes saved locally
          </div>
        )}

        <div className="dashboard">
          <div className="stats-bar">
            <div className="stat-card">
              <div className="stat-value">{stats.total}</div>
              <div className="stat-label">Total</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.active}</div>
              <div className="stat-label">Active</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{stats.completed}</div>
              <div className="stat-label">Done</div>
            </div>
          </div>
          <div className="progress-card">
            <ProgressRing percent={stats.percent} />
          </div>
        </div>

        <div className="input-card">
          <div className="input-card-header">
            <span className="icon">📝</span>
            <h3>Add New Task</h3>
          </div>
          <div className="input-group">
            <input
              ref={titleRef}
              type="text"
              placeholder="What needs to be done?  (Ctrl+N)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              type="text"
              placeholder="Add a description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="input-row">
              <div className="select-wrap">
                <label>Priority</label>
                <div className="priority-pills">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`priority-pill ${priority === p.id ? "active" : ""}`}
                      onClick={() => setPriority(p.id)}
                      style={{ "--pill-color": p.color }}
                    >
                      <span className="dot" />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="select-wrap">
                <label htmlFor="due-date">Due date</label>
                <input
                  id="due-date"
                  type="date"
                  className="date-input"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                />
              </div>
            </div>
            <button
              className="submit-btn"
              onClick={handleSubmit}
              disabled={!title.trim() || !description.trim()}
            >
              <span>Add Task</span>
              <span>+</span>
            </button>
          </div>
        </div>

        <div className="search-row">
          <div className="search-input-wrap">
            <svg
              className="search-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              ref={searchRef}
              type="text"
              className="search-input"
              placeholder="Search tasks...  (Ctrl+K)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            {search && (
              <button
                className="search-clear"
                onClick={() => setSearch("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
          <div className="select-wrap sort-wrap">
            <select
              className="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort tasks"
            >
              {SORT_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="filters" role="tablist">
          {[
            { id: "all", label: "All" },
            { id: "active", label: "Active" },
            { id: "completed", label: "Completed" },
          ].map((f) => {
            const count =
              f.id === "all"
                ? stats.total
                : f.id === "active"
                ? stats.active
                : stats.completed;
            return (
              <button
                key={f.id}
                className={`filter-btn ${filter === f.id ? "active" : ""}`}
                onClick={() => setFilter(f.id)}
                role="tab"
                aria-selected={filter === f.id}
              >
                <span>{f.label}</span>
                <span className="count">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="todos-section-header">
          <h3>
            <span>📋</span>
            <span>
              {filter === "all"
                ? "All Tasks"
                : filter === "active"
                ? "Active Tasks"
                : "Completed Tasks"}
              {search.trim() && ` matching "${search.trim()}"`}
            </span>
          </h3>
          {stats.completed > 0 && (
            <button className="clear-all" onClick={handleClearCompleted}>
              Clear completed
            </button>
          )}
        </div>

        {loading ? (
          <div className="todo-list">
            {[1, 2, 3].map((i) => (
              <div key={i} className="todo-skeleton" />
            ))}
          </div>
        ) : visibleTodos.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">
              {search.trim()
                ? "🔍"
                : filter === "completed"
                ? "🎯"
                : "🌱"}
            </span>
            <p>
              {search.trim()
                ? `No tasks match "${search.trim()}"`
                : filter === "completed"
                ? "No completed tasks yet. Keep going!"
                : filter === "active"
                ? "All clear! Enjoy the moment."
                : "No tasks yet. Add your first task above!"}
            </p>
          </div>
        ) : (
          <div className="todo-list">
            {visibleTodos.map((item) => {
              const due = formatDueDate(item.dueDate);
              const prio = priorityMeta(item.priority);
              const isEditing = editId === item._id;
              return (
                <div
                  key={item._id}
                  className={`todo-item ${item.completed ? "completed" : ""} ${
                    removingId === item._id ? "removing" : ""
                  }`}
                >
                  {isEditing ? (
                    <>
                      <div className="edit-form">
                        <input
                          type="text"
                          placeholder="Title"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                        />
                        <input
                          type="text"
                          placeholder="Description"
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                        />
                        <div className="edit-extras">
                          <div className="priority-pills small">
                            {PRIORITIES.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                className={`priority-pill ${
                                  editPriority === p.id ? "active" : ""
                                }`}
                                onClick={() => setEditPriority(p.id)}
                                style={{ "--pill-color": p.color }}
                              >
                                <span className="dot" />
                                {p.label}
                              </button>
                            ))}
                          </div>
                          <input
                            type="date"
                            className="date-input"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                          />
                        </div>
                      </div>
                      <div className="todo-actions">
                        <button className="update-btn" onClick={handleUpdate}>
                          Save
                        </button>
                        <button
                          className="cancel-btn"
                          onClick={handleEditCancel}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <input
                        type="checkbox"
                        className="todo-checkbox"
                        checked={!!item.completed}
                        onChange={() => handleToggleComplete(item)}
                        aria-label="Mark as complete"
                      />
                      <div className="todo-content">
                        <div className="todo-title-row">
                          <span className="title">{item.title}</span>
                          <span
                            className="priority-badge"
                            style={{ "--badge-color": prio.color }}
                          >
                            <span className="dot" />
                            {prio.label}
                          </span>
                        </div>
                        {item.description && (
                          <span className="description">{item.description}</span>
                        )}
                        {due && (
                          <span className={`due-badge due-${due.tone}`}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <rect
                                x="3"
                                y="4"
                                width="18"
                                height="18"
                                rx="2"
                                ry="2"
                              />
                              <line x1="16" y1="2" x2="16" y2="6" />
                              <line x1="8" y1="2" x2="8" y2="6" />
                              <line x1="3" y1="10" x2="21" y2="10" />
                            </svg>
                            {due.label}
                          </span>
                        )}
                      </div>
                      <div className="todo-actions">
                        <button
                          className="edit-btn"
                          onClick={() => handleEdit(item)}
                          aria-label="Edit task"
                        >
                          Edit
                        </button>
                        <button
                          className="delete-btn"
                          onClick={() => handleDelete(item._id)}
                          aria-label="Delete task"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
