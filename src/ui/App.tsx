import type { JSX } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import type { Plugin, WorkspaceLeaf } from "obsidian";
import { Notice } from "obsidian";
import {
  buildChildrenMap,
  getAnytimeTasks,
  getCompletedTasks,
  getInboxTasks,
  getKpiStats,
  getNavCounts,
  getSomedayTasks,
  getTodayTasks,
  getUpcomingTasks,
  getVisualOrderTasks,
  getWaitingTasks,
} from "../core/selectors";
import { TempoStore } from "../core/store";
import type { Cycle, Project, Task, TaskPriority, TaskStatus, TodoDatabase } from "../core/types";
import { getTodayString } from "../services/date-service";
import { t, tf, type Locale } from "../services/i18n";
import { CycleModal } from "./commands/CycleModal";
import { MobileNavModal } from "./commands/MobileNavModal";
import { ProjectModal } from "./commands/ProjectModal";
import { SettingsModal } from "./commands/SettingsModal";
import { TaskCreateModal } from "./commands/TaskCreateModal";
import { GenericListView } from "./tasks/GenericListView";
import { Header } from "./layout/Header";
import { Inspector } from "./layout/Inspector";
import { KpiRow } from "./layout/KpiRow";
import { Sidebar } from "./layout/Sidebar";
import { TodayView } from "./today/TodayView";

interface AppProps {
  plugin: Plugin;
  leaf?: WorkspaceLeaf;
}

export function App({ plugin, leaf }: AppProps): JSX.Element {
  const store = TempoStore.get(plugin);
  const rootRef = useRef<HTMLDivElement>(null);

  // Subscribe to central store. A single snapshot shape keeps the initial state and the
  // subscription callback from drifting apart.
  const snapshot = () => ({
    status: store.status,
    loadError: store.loadError,
    loadProblems: store.loadProblems,
    saveStatus: store.saveStatus,
    saveError: store.saveError,
    data: store.data,
  });

  const [storeState, setStoreState] = useState(snapshot);

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      setStoreState(snapshot());
    });

    void store.load().catch(() => {});

    return () => {
      unsubscribe();
    };
  }, [store]);

  // Listen for Quick Add command
  useEffect(() => {
    const unsubQuickAdd = store.onQuickAdd(() => {
      setIsTaskCreateOpen(true);
    }, leaf);
    return unsubQuickAdd;
  }, [store, leaf]);

  // UI Navigation & View state. Default to task-1 so inspector is populated.
  const [activeNav, setActiveNav] = useState<string>("today");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>("task-1");
  const [isTaskCreateOpen, setIsTaskCreateOpen] = useState(false);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isCycleModalOpen, setIsCycleModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [moveMessage, setMoveMessage] = useState<string | null>(null);
  const [confirmSalvage, setConfirmSalvage] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // Moving to another view drops the previous selection. Without this the inspector keeps
  // showing a task that is no longer part of the list on screen, and arrow keys start from
  // an index that does not exist in the new list.
  const prevNavRef = useRef(activeNav);
  useEffect(() => {
    if (prevNavRef.current !== activeNav) {
      prevNavRef.current = activeNav;
      setSelectedTaskId(null);
      setMoveMessage(null);
      setConfirmSalvage(false);
    }
  }, [activeNav]);

  // Scroll root to top on mobile when opening inspector
  useEffect(() => {
    if (selectedTaskId && rootRef.current) {
      rootRef.current.scrollTop = 0;
    }
  }, [selectedTaskId]);

  // Refresh at the next local midnight and when the window resumes.
  const [today, setToday] = useState(() => getTodayString());
  useEffect(() => {
    const doc = rootRef.current?.ownerDocument ?? document;
    const ownerWindow = doc.defaultView ?? window;
    let timer: ReturnType<typeof setTimeout>;
    const checkDate = () => {
      const fresh = getTodayString();
      setToday((prev) => (prev === fresh ? prev : fresh));
    };
    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      timer = setTimeout(() => {
        checkDate();
        schedule();
      }, Math.max(1000, nextMidnight.getTime() - now.getTime() + 50));
    };
    const onResume = () => {
      checkDate();
      clearTimeout(timer);
      schedule();
    };
    schedule();
    ownerWindow.addEventListener("focus", onResume);
    doc.addEventListener("visibilitychange", onResume);
    return () => {
      clearTimeout(timer);
      ownerWindow.removeEventListener("focus", onResume);
      doc.removeEventListener("visibilitychange", onResume);
    };
  }, []);

  // Derived view state. Memoised on the database and the navigation target, so switching
  // views does not rescan the task set and the keydown effect below only re-subscribes when
  // the visible list actually changes.
  const database = storeState.data?.database ?? null;
  const derived = useMemo(() => {
    if (!database) return null;
    const allTasks = database.tasks;
    const taskList = Object.values(allTasks);
    let visibleTasks: Task[] = [];

    if (activeNav === "today") visibleTasks = getTodayTasks(allTasks, today);
    else if (activeNav === "inbox") visibleTasks = getInboxTasks(allTasks);
    else if (activeNav === "upcoming") visibleTasks = getUpcomingTasks(allTasks, today);
    else if (activeNav === "anytime") visibleTasks = getAnytimeTasks(allTasks, today);
    else if (activeNav === "someday") visibleTasks = getSomedayTasks(allTasks);
    else if (activeNav === "waiting") visibleTasks = getWaitingTasks(allTasks);
    else if (activeNav === "completed") visibleTasks = getCompletedTasks(allTasks);
    else if (activeNav.startsWith("proj:")) {
      const projectId = activeNav.slice(5);
      visibleTasks = taskList.filter((t) => !t.parentTaskId && t.projectId === projectId);
    } else if (activeNav.startsWith("cycle:")) {
      const cycleId = activeNav.slice(6);
      visibleTasks = taskList.filter((t) => !t.parentTaskId && t.cycleId === cycleId);
    }

    return {
      taskList,
      visibleTasks,
      childrenMap: buildChildrenMap(allTasks),
      counts: getNavCounts(allTasks, today),
      kpi: getKpiStats(allTasks, today),
    };
  }, [database, activeNav, today]);

  const selectedTaskSubtasks = useMemo(
    () => (selectedTaskId ? derived?.childrenMap.get(selectedTaskId) ?? [] : []),
    [derived, selectedTaskId],
  );

  // Error guard. Nothing is written from this state: the user gets the reason, a list of
  // rejected entries, and three ways forward that all preserve the original file.
  if (storeState.status === "error") {
    const errorLocale: Locale = storeState.data?.locale ?? store.loadLocale ?? "zh";
    const problems = storeState.loadProblems;

    const handleExport = async () => {
      try {
        const path = await store.exportRawData();
        new Notice(tf("exportDone", errorLocale, { path }));
      } catch (err) {
        new Notice(tf("exportFailed", errorLocale, { detail: String(err) }));
      }
    };

    const handleSalvage = async () => {
      setIsRecovering(true);
      try {
        await store.loadDroppingInvalidEntries();
        setConfirmSalvage(false);
      } catch (err) {
        console.error("Crisp Tempo: recovery failed", err);
      } finally {
        setIsRecovering(false);
      }
    };

    return (
      <div className="tempo-root" ref={rootRef}>
        <div className="tempo-error-card">
          <h3 className="tempo-error-title">{t("loadErrorTitle", errorLocale)}</h3>
          <p className="tempo-error-desc">{t("loadErrorDesc", errorLocale)}</p>
          {storeState.loadError && <p className="tempo-error-detail">{storeState.loadError}</p>}

          {problems.length > 0 && (
            <div className="tempo-error-problems">
              <div className="tempo-error-problems-title">
                {tf("loadProblemsTitle", errorLocale, { n: problems.length })}
              </div>
              <ul className="tempo-error-problems-list">
                {problems.slice(0, 8).map((problem) => (
                  <li key={problem.entry}>
                    <code>{problem.entry}</code>
                    <span>{problem.reason}</span>
                  </li>
                ))}
                {problems.length > 8 && <li className="tempo-error-more">…</li>}
              </ul>
              <p className="tempo-error-hint">{t("salvageHint", errorLocale)}</p>
            </div>
          )}

          <div className="tempo-error-actions">
            <button
              type="button"
              className="tempo-btn-primary"
              onClick={() => void store.load(true).catch(() => {})}
            >
              {t("retryLoad", errorLocale)}
            </button>
            <button type="button" className="tempo-action-btn" onClick={() => void handleExport()}>
              {t("exportRawData", errorLocale)}
            </button>
            {problems.length > 0 &&
              (confirmSalvage ? (
                <button
                  type="button"
                  className="tempo-action-btn is-danger"
                  disabled={isRecovering}
                  onClick={() => void handleSalvage()}
                >
                  {t("salvageConfirm", errorLocale)}
                </button>
              ) : (
                <button
                  type="button"
                  className="tempo-action-btn is-danger"
                  onClick={() => setConfirmSalvage(true)}
                >
                  {tf("salvageAction", errorLocale, { n: problems.length })}
                </button>
              ))}
          </div>
        </div>
      </div>
    );
  }

  // Loading guard: no writes and no stale UI until the database is ready.
  if (storeState.status === "loading" || !storeState.data || !derived) {
    const loadingLocale: Locale = storeState.data?.locale ?? store.loadLocale ?? "zh";
    return (
      <div className="tempo-root" ref={rootRef}>
        <div className="tempo-loading-container">
          <div className="tempo-spinner" />
          <span className="tempo-loading-text">{t("loading", loadingLocale)}</span>
        </div>
      </div>
    );
  }

  const { database: db, locale, defaultDest = "inbox" } = storeState.data;
  const allTasks = db.tasks;
  const { taskList, visibleTasks, childrenMap, counts, kpi } = derived;
  const selectedTask = selectedTaskId ? allTasks[selectedTaskId] ?? null : null;

  // Toggle complete / active status
  const handleToggleStatus = (taskId: string) => {
    store.updateDatabase((prev) => {
      const t = prev.tasks[taskId];
      if (!t) return prev;
      const isDone = t.status === "done";
      const nextStatus: TaskStatus = isDone ? "todo" : "done";
      return {
        ...prev,
        tasks: {
          ...prev.tasks,
          [taskId]: {
            ...t,
            status: nextStatus,
            completedAt: isDone ? undefined : Date.now(),
            updatedAt: Date.now(),
          },
        },
      };
    });
  };

  // Update task attributes
  const handleUpdateTask = (updates: Partial<Task>) => {
    if (!selectedTaskId) return;
    store.updateDatabase((prev) => {
      const t = prev.tasks[selectedTaskId];
      if (!t) return prev;
      return {
        ...prev,
        tasks: {
          ...prev.tasks,
          [selectedTaskId]: {
            ...t,
            ...updates,
            updatedAt: Date.now(),
          },
        },
      };
    });
  };

  // Delete task and its subtasks
  const handleDeleteTask = (taskId: string) => {
    store.updateDatabase((prev) => {
      const nextTasks = { ...prev.tasks };
      delete nextTasks[taskId];
      for (const [id, t] of Object.entries(nextTasks)) {
        if (t.parentTaskId === taskId) {
          delete nextTasks[id];
        }
      }
      return {
        ...prev,
        tasks: nextTasks,
      };
    });
    setSelectedTaskId(null);
  };

  // Add task from TaskCreateModal
  const handleAddTask = (params: {
    title: string;
    description?: string;
    triage: "inbox" | "processed";
    availability?: "anytime" | "someday";
    priority?: TaskPriority;
    focusDate?: string;
    dueDate?: string;
    projectId?: string;
    cycleId?: string;
  }) => {
    const newId = `task-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newTask: Task = {
      id: newId,
      title: params.title,
      description: params.description,
      status: "todo",
      triage: params.triage,
      availability: params.availability || "anytime",
      priority: params.priority || "none",
      projectId: params.projectId,
      cycleId: params.cycleId,
      focusDate: params.focusDate,
      dueDate: params.dueDate,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: `z${Date.now()}`,
    };

    store.updateDatabase((prev) => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [newId]: newTask,
      },
    }));

    setSelectedTaskId(newId);
  };

  // Add subtask explicitly under parent task ID
  const handleAddSubtask = (title: string, explicitParentId?: string) => {
    const parentId = explicitParentId || selectedTaskId;
    if (!parentId) return;

    const subId = `task-sub-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const newSubtask: Task = {
      id: subId,
      title,
      status: "todo",
      triage: "processed",
      availability: "anytime",
      priority: "none",
      parentTaskId: parentId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: `z${Date.now()}`,
    };

    store.updateDatabase((prev) => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [subId]: newSubtask,
      },
    }));
  };

  // Create Project
  const handleCreateProject = (params: {
    title: string;
    color: string;
    description?: string;
  }) => {
    const newProjId = `proj-${Date.now()}`;
    const newProj: Project = {
      id: newProjId,
      title: params.title,
      color: params.color,
      description: params.description,
      status: "active",
      priority: "medium",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      order: `z${Date.now()}`,
    };

    store.updateDatabase((prev) => ({
      ...prev,
      projects: {
        ...prev.projects,
        [newProjId]: newProj,
      },
    }));

    setActiveNav(`proj:${newProjId}`);
  };

  // Create Cycle (ensuring single active 'current' cycle)
  const handleCreateCycle = (params: {
    title: string;
    startDate: string;
    endDate: string;
    status: "current" | "upcoming";
  }) => {
    const newCycleId = `cycle-${Date.now()}`;
    const newCycle: Cycle = {
      id: newCycleId,
      title: params.title,
      startDate: params.startDate,
      endDate: params.endDate,
      status: params.status,
    };

    store.updateDatabase((prev) => {
      const nextCycles = { ...prev.cycles };
      if (params.status === "current") {
        for (const [id, c] of Object.entries(nextCycles)) {
          if (c.status === "current") {
            nextCycles[id] = { ...c, status: "previous" };
          }
        }
      }
      nextCycles[newCycleId] = newCycle;
      return {
        ...prev,
        cycles: nextCycles,
      };
    });

    setActiveNav(`cycle:${newCycleId}`);
  };

  // Reset data to initial mock (safe with undo snapshot)
  const handleResetData = async (): Promise<boolean> => {
    store.resetToMock();
    await store.flush();
    return store.saveStatus === "saved";
  };

  // Change locale
  const handleChangeLocale = (newLocale: Locale) => {
    store.setLocale(newLocale);
  };

  // Change default destination
  const handleChangeDefaultDest = (newDest: "inbox" | "today") => {
    store.setDefaultDest(newDest);
  };

  // Undo (⌘Z or button)
  const handleUndo = () => {
    store.undo();
  };

  // Moving between buckets changes scheduling without discarding the due date.
  const handleMoveTaskToBucket = (taskId: string, bucket: string) => {
    const task = store.data?.database.tasks[taskId];
    if (!task) return;
    const knownBucket = ["inbox", "today", "upcoming", "anytime", "someday", "waiting", "completed"].includes(bucket);
    if (!knownBucket && !bucket.startsWith("proj:") && !bucket.startsWith("cycle:")) return;
    if (bucket === "upcoming" && !(task.startDate && task.startDate > today) &&
        !(task.dueDate && task.dueDate > today)) {
      setMoveMessage(t("moveToUpcomingNeedsDate", locale));
      return;
    }
    setMoveMessage(null);
    store.updateDatabase((prev) => {
      const current = prev.tasks[taskId];
      if (!current) return prev;
      let updatedTask: Task = { ...current, updatedAt: Date.now() };
      if (bucket.startsWith("proj:")) {
        const projectId = bucket.slice(5);
        if (!prev.projects[projectId]) return prev;
        updatedTask.projectId = projectId;
      } else if (bucket.startsWith("cycle:")) {
        const cycleId = bucket.slice(6);
        if (!prev.cycles[cycleId]) return prev;
        updatedTask.cycleId = cycleId;
      } else {
        if (current.status === "done" || current.status === "canceled") {
          updatedTask = { ...updatedTask, status: "todo", completedAt: undefined, canceledAt: undefined };
        }
        if (bucket === "inbox") {
          updatedTask = { ...updatedTask, triage: "inbox", focusDate: undefined };
        } else if (bucket === "today") {
          updatedTask = { ...updatedTask, triage: "processed", focusDate: today, availability: "anytime" };
        } else if (bucket === "upcoming") {
          updatedTask = {
            ...updatedTask, triage: "processed", availability: "anytime", focusDate: undefined,
            startDate: current.startDate && current.startDate > today ? current.startDate : undefined,
          };
        } else if (bucket === "anytime") {
          updatedTask = {
            ...updatedTask, triage: "processed", availability: "anytime",
            focusDate: undefined, startDate: undefined,
          };
        } else if (bucket === "someday") {
          updatedTask = { ...updatedTask, triage: "processed", availability: "someday", focusDate: undefined };
        } else if (bucket === "waiting") {
          updatedTask = {
            ...updatedTask, triage: "processed", status: "waiting", focusDate: undefined,
            completedAt: undefined, canceledAt: undefined,
          };
        } else if (bucket === "completed") {
          updatedTask = {
            ...updatedTask, triage: "processed", availability: "anytime", status: "done",
            completedAt: Date.now(), canceledAt: undefined,
          };
        }
      }
      return { ...prev, tasks: { ...prev.tasks, [taskId]: updatedTask } };
    });
  };

  const handleMoveTaskToProject = (taskId: string, projectId: string) => {
    store.updateDatabase((prev) => {
      const task = prev.tasks[taskId];
      if (!task) return prev;
      return {
        ...prev,
        tasks: {
          ...prev.tasks,
          [taskId]: {
            ...task,
            projectId,
            updatedAt: Date.now(),
          },
        },
      };
    });
  };

  // Keyboard navigation & quick add handler with strict scope guard
  useEffect(() => {
    const rootEl = rootRef.current;
    const ownerDocument = rootEl?.ownerDocument;
    const ownerWindow = ownerDocument?.defaultView;
    if (!rootEl || !ownerDocument || !ownerWindow) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.isComposing) return;
      // Modals own the keyboard while open.
      if (
        isTaskCreateOpen ||
        isProjectModalOpen ||
        isCycleModalOpen ||
        isSettingsOpen ||
        isMobileNavOpen
      ) {
        return;
      }

      // 2. Check active element
      const activeEl = ownerDocument.activeElement;
      const isInput =
        ["INPUT", "TEXTAREA", "SELECT"].includes(activeEl?.tagName ?? "") ||
        activeEl?.getAttribute("contenteditable") === "true";

      // 3. Container and focus containment check
      // Only the active Tempo leaf receives shortcuts, including in popout windows.
      if (leaf && plugin.app.workspace.activeLeaf !== leaf) return;
      if (!rootEl.isConnected || rootEl.getClientRects().length === 0 ||
          rootEl.offsetWidth === 0 || rootEl.offsetHeight === 0) return;

      // Focus in another pane belongs to that pane.
      if (activeEl && activeEl !== ownerDocument.body && !rootEl.contains(activeEl)) {
        return;
      }

      // Quick Add (Cmd+Shift+Space or 'c' when not typing in any input)
      if (
        (e.metaKey && e.shiftKey && e.code === "Space") ||
        (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.key === "c")
      ) {
        e.preventDefault();
        setIsTaskCreateOpen(true);
        return;
      }

      // Undo (Cmd+Z or Ctrl+Z)
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && !e.shiftKey && !isInput) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // If typing in input / select, do not intercept remaining keys
      if (isInput) return;

      // Esc: deselect
      if (e.key === "Escape") {
        if (selectedTaskId) {
          e.preventDefault();
          setSelectedTaskId(null);
        }
        return;
      }

      // Arrow navigation: ordered strictly according to on-screen visual presentation!
      if (!e.metaKey && !e.ctrlKey && !e.altKey &&
          (e.key === "ArrowDown" || e.key === "ArrowUp")) {
        e.preventDefault();
        const ordered = getVisualOrderTasks(visibleTasks, activeNav);
        if (ordered.length === 0) return;

        const currentIndex = ordered.findIndex((t) => t.id === selectedTaskId);
        if (e.key === "ArrowDown") {
          const nextIndex = currentIndex < ordered.length - 1 ? currentIndex + 1 : 0;
          if (ordered[nextIndex]) setSelectedTaskId(ordered[nextIndex].id);
        } else {
          const prevIndex = currentIndex > 0 ? currentIndex - 1 : ordered.length - 1;
          if (ordered[prevIndex]) setSelectedTaskId(ordered[prevIndex].id);
        }
        return;
      }

      // 'x' toggles complete on selected task
      if (e.key === "x" && selectedTaskId &&
          !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        handleToggleStatus(selectedTaskId);
        return;
      }
    };

    ownerWindow.addEventListener("keydown", handleKeyDown);
    return () => ownerWindow.removeEventListener("keydown", handleKeyDown);
  }, [
    isTaskCreateOpen,
    isProjectModalOpen,
    isCycleModalOpen,
    isSettingsOpen,
    isMobileNavOpen,
    visibleTasks,
    activeNav,
    selectedTaskId,
    store,
    leaf,
    plugin,
  ]);

  return (
    <div className={`tempo-root ${selectedTask ? "has-selected-task" : ""}`} ref={rootRef}>
      <div className="tempo-wrapper">
        {/* 1. Crisp Suite Header */}
        <Header
          locale={locale}
          activeNav={activeNav}
          tasks={db.tasks}
          counts={counts}
          projects={db.projects}
          cycles={db.cycles}
          onSelectNav={(nav) => setActiveNav(nav)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onUndo={handleUndo}
          onOpenQuickAdd={() => setIsTaskCreateOpen(true)}
          onOpenProjects={() => setIsMobileNavOpen(true)}
          onMoveTaskToBucket={handleMoveTaskToBucket}
        />

        {(storeState.saveStatus === "saving" || storeState.saveStatus === "error") && (
          <div
            className={`tempo-save-feedback ${storeState.saveStatus === "error" ? "is-error" : ""}`}
            role={storeState.saveStatus === "error" ? "alert" : "status"}
            aria-live="polite"
          >
            <span>{storeState.saveStatus === "error" ? t("saveFailed", locale) : t("saving", locale)}</span>
            {storeState.saveStatus === "error" && (
              <button type="button" className="tempo-action-btn" onClick={() => void store.flush()}>
                {t("retrySave", locale)}
              </button>
            )}
          </div>
        )}

        {moveMessage && (
          <div className="tempo-save-feedback is-error" role="alert">
            <span>{moveMessage}</span>
            <button type="button" className="tempo-action-btn" onClick={() => setMoveMessage(null)}>
              {t("close", locale)}
            </button>
          </div>
        )}

        {/* 2. Crisp Pulse Style KPI Row */}
        <KpiRow
          stats={kpi}
          locale={locale}
          activeNav={activeNav}
          onSelectNav={(nav) => setActiveNav(nav)}
        />

        {/* 3. Workbench (Cards Layout) */}
        <div className="tempo-workbench">
          {/* Left Sidebar Card (Desktop) */}
          <Sidebar
            locale={locale}
            activeNav={activeNav}
            onSelectNav={(nav) => setActiveNav(nav)}
            tasks={db.tasks}
            counts={counts}
            projects={db.projects}
            cycles={db.cycles}
            onOpenQuickAdd={() => setIsTaskCreateOpen(true)}
            onOpenNewProject={() => setIsProjectModalOpen(true)}
            onOpenNewCycle={() => setIsCycleModalOpen(true)}
            onMoveTaskToBucket={handleMoveTaskToBucket}
            onMoveTaskToProject={handleMoveTaskToProject}
          />

          {/* Center Main Card */}
          {activeNav === "today" ? (
            <TodayView
              today={today}
              tasks={visibleTasks}
              locale={locale}
              childrenMap={childrenMap}
              projects={db.projects}
              selectedTaskId={selectedTaskId}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onToggleStatus={handleToggleStatus}
              onOpenQuickAdd={() => setIsTaskCreateOpen(true)}
            />
          ) : (
            <GenericListView
              title={
                activeNav.startsWith("proj:")
                  ? db.projects[activeNav.replace("proj:", "")]?.title || t("project", locale)
                  : activeNav.startsWith("cycle:")
                  ? db.cycles[activeNav.replace("cycle:", "")]?.title || t("cycles", locale)
                  : t(activeNav as any, locale) || activeNav.toUpperCase()
              }
              subtitle={
                activeNav === "inbox"
                  ? t("inboxSubtitle", locale)
                  : activeNav === "upcoming"
                  ? t("upcomingSubtitle", locale)
                  : activeNav === "anytime"
                  ? t("anytimeSubtitle", locale)
                  : activeNav === "someday"
                  ? t("somedaySubtitle", locale)
                  : activeNav === "waiting"
                  ? t("waitingSubtitle", locale)
                  : activeNav === "completed"
                  ? t("completedLog", locale)
                  : activeNav.startsWith("proj:")
                  ? db.projects[activeNav.replace("proj:", "")]?.description || ""
                  : activeNav.startsWith("cycle:")
                  ? `${db.cycles[activeNav.replace("cycle:", "")]?.startDate || ""} ~ ${
                      db.cycles[activeNav.replace("cycle:", "")]?.endDate || ""
                    }`
                  : ""
              }
              locale={locale}
              tasks={visibleTasks}
              childrenMap={childrenMap}
              projects={db.projects}
              project={
                activeNav.startsWith("proj:")
                  ? db.projects[activeNav.replace("proj:", "")]
                  : undefined
              }
              selectedTaskId={selectedTaskId}
              onSelectTask={(id) => setSelectedTaskId(id)}
              onToggleStatus={handleToggleStatus}
              onOpenQuickAdd={() => setIsTaskCreateOpen(true)}
              onBackToToday={() => setActiveNav("today")}
            />
          )}

          {/* Right Inspector Card (Responsive) */}
          {selectedTask && (
            <Inspector
              task={selectedTask}
              locale={locale}
              projects={db.projects}
              cycles={db.cycles}
              subtasks={selectedTaskSubtasks}
              onClose={() => setSelectedTaskId(null)}
              onUpdateTask={handleUpdateTask}
              onDeleteTask={() => handleDeleteTask(selectedTask.id)}
              onAddSubtask={handleAddSubtask}
              onToggleSubtask={handleToggleStatus}
            />
          )}
        </div>

        {/* 4. Independent Floating Modals - Unmounted on close to cleanly reset drafts */}
        {isTaskCreateOpen && (
          <TaskCreateModal
            isOpen={true}
            locale={locale}
            projects={db.projects}
            defaultDest={defaultDest}
            defaultProjectId={activeNav.startsWith("proj:") ? activeNav.replace("proj:", "") : undefined}
            defaultCycleId={activeNav.startsWith("cycle:") ? activeNav.replace("cycle:", "") : undefined}
            onClose={() => setIsTaskCreateOpen(false)}
            onAddTask={handleAddTask}
          />
        )}

        {isProjectModalOpen && (
          <ProjectModal
            isOpen={true}
            locale={locale}
            onClose={() => setIsProjectModalOpen(false)}
            onCreateProject={handleCreateProject}
          />
        )}

        {isCycleModalOpen && (
          <CycleModal
            isOpen={true}
            locale={locale}
            nextCycleNumber={Object.keys(db.cycles).length + 1}
            currentCycleEnd={Object.values(db.cycles)
              .filter((cycle) => cycle.status === "current")
              .reduce((latest, cycle) => cycle.endDate > latest ? cycle.endDate : latest, "")}
            onClose={() => setIsCycleModalOpen(false)}
            onCreateCycle={handleCreateCycle}
          />
        )}

        {isSettingsOpen && (
          <SettingsModal
            isOpen={true}
            locale={locale}
            version={plugin?.manifest?.version || "0.1.0"}
            defaultDest={defaultDest}
            taskCount={taskList.length}
            projectCount={Object.keys(db.projects).length}
            cycleCount={Object.keys(db.cycles).length}
            onClose={() => setIsSettingsOpen(false)}
            onChangeLocale={handleChangeLocale}
            onChangeDefaultDest={handleChangeDefaultDest}
            onChangeExportFolder={(folder) => store.setExportFolder(folder)}
            onResetData={handleResetData}
            onExportData={(folder) => store.exportRawData(folder)}
            exportFolder={storeState.data?.exportFolder}
            licenseKey={storeState.data?.licenseKey}
            licenseStatus={storeState.data?.licenseStatus}
            licensePayload={storeState.data?.licensePayload}
            onActivateLicense={(key) => store.activateLicense(key)}
            onClearLicense={() => store.clearLicense()}
          />
        )}

        {isMobileNavOpen && (
          <MobileNavModal
            isOpen={true}
            locale={locale}
            activeNav={activeNav}
            projects={db.projects}
            cycles={db.cycles}
            tasks={db.tasks}
            onClose={() => setIsMobileNavOpen(false)}
            onSelectNav={(nav) => {
              setActiveNav(nav);
              setIsMobileNavOpen(false);
            }}
            onOpenNewProject={() => {
              setIsMobileNavOpen(false);
              setIsProjectModalOpen(true);
            }}
            onOpenNewCycle={() => {
              setIsMobileNavOpen(false);
              setIsCycleModalOpen(true);
            }}
          />
        )}
      </div>
    </div>
  );
}
