import { useState } from "preact/hooks";
import type { JSX } from "preact";
import type { NavCounts } from "../../core/selectors";
import type { Cycle, NavItemKey, Project, Task } from "../../core/types";
import { t, type Locale } from "../../services/i18n";
import {
  AnytimeIcon,
  CompletedIcon,
  CycleIcon,
  InboxIcon,
  PlusIcon,
  SomedayIcon,
  TodayIcon,
  UpcomingIcon,
  WaitingIcon,
} from "../icons/Icons";

interface SidebarProps {
  locale: Locale;
  activeNav: string;
  onSelectNav: (nav: string) => void;
  tasks: Record<string, Task>;
  counts: NavCounts;
  projects: Record<string, Project>;
  cycles: Record<string, Cycle>;
  onOpenQuickAdd: () => void;
  onOpenNewProject: () => void;
  onOpenNewCycle: () => void;
  onMoveTaskToBucket?: (taskId: string, bucket: string) => void;
  onMoveTaskToProject?: (taskId: string, projectId: string) => void;
}

export function Sidebar({
  locale,
  activeNav,
  onSelectNav,
  tasks,
  counts,
  projects,
  cycles,
  onOpenQuickAdd,
  onOpenNewProject,
  onOpenNewCycle,
  onMoveTaskToBucket,
  onMoveTaskToProject,
}: SidebarProps): JSX.Element {
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const activateOnKey = (e: KeyboardEvent, action: () => void) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      action();
    }
  };
  const allTasks = Object.values(tasks);

  const navItems: Array<{ key: NavItemKey; title: string; icon: JSX.Element; count: number }> = [
    { key: "inbox", title: t("inbox", locale), icon: <InboxIcon size={14} />, count: counts.inbox },
    { key: "today", title: t("today", locale), icon: <TodayIcon size={14} />, count: counts.today },
    { key: "upcoming", title: t("upcoming", locale), icon: <UpcomingIcon size={14} />, count: counts.upcoming },
    { key: "anytime", title: t("anytime", locale), icon: <AnytimeIcon size={14} />, count: counts.anytime },
    { key: "someday", title: t("someday", locale), icon: <SomedayIcon size={14} />, count: counts.someday },
    { key: "waiting", title: t("waiting", locale), icon: <WaitingIcon size={14} />, count: counts.waiting },
  ];

  return (
    <aside className="tempo-sidebar-card">
      <div className="tempo-sidebar-group-title">{t("tasks", locale)}</div>
      {navItems.map((item) => (
        <div
          key={item.key}
          className={`tempo-nav-item ${activeNav === item.key ? "is-active" : ""} ${
            dragOverKey === item.key ? "is-drag-over" : ""
          }`}
          onClick={() => onSelectNav(item.key)}
          onKeyDown={(e) => activateOnKey(e, () => onSelectNav(item.key))}
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            if (dragOverKey !== item.key) setDragOverKey(item.key);
          }}
          onDragLeave={() => {
            if (dragOverKey === item.key) setDragOverKey(null);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverKey(null);
            const taskId =
              e.dataTransfer?.getData("application/x-tempo-task-id") ||
              e.dataTransfer?.getData("text/plain");
            if (taskId && onMoveTaskToBucket) {
              onMoveTaskToBucket(taskId, item.key);
            }
          }}
          role="button"
          tabIndex={0}
        >
          <span className="tempo-nav-icon">{item.icon}</span>
          <span className="tempo-nav-title">{item.title}</span>
          {item.count > 0 && <span className="tempo-nav-badge">{item.count}</span>}
        </div>
      ))}

      <div className="tempo-sidebar-group-header" style={{ marginTop: 14 }}>
        <span className="tempo-sidebar-group-title">{t("projects", locale)}</span>
        <button
          type="button"
          className="tempo-sidebar-add-btn"
          onClick={onOpenNewProject}
          title={t("newProject", locale)}
        >
          <PlusIcon size={12} />
        </button>
      </div>
      {Object.values(projects).map((proj) => {
        const projTasks = allTasks.filter((t) => t.projectId === proj.id && !t.parentTaskId);
        const doneTasks = projTasks.filter((t) => t.status === "done").length;
        const pct = projTasks.length > 0 ? Math.round((doneTasks / projTasks.length) * 100) : 0;
        const projKey = `proj:${proj.id}`;

        return (
          <div
            key={proj.id}
            className={`tempo-nav-item tempo-project-nav-item ${activeNav === projKey ? "is-active" : ""} ${
              dragOverKey === projKey ? "is-drag-over" : ""
            }`}
            onClick={() => onSelectNav(projKey)}
            onKeyDown={(e) => activateOnKey(e, () => onSelectNav(projKey))}
            onDragOver={(e) => {
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
              if (dragOverKey !== projKey) setDragOverKey(projKey);
            }}
            onDragLeave={() => {
              if (dragOverKey === projKey) setDragOverKey(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverKey(null);
              const taskId =
                e.dataTransfer?.getData("application/x-tempo-task-id") ||
                e.dataTransfer?.getData("text/plain");
              if (taskId && onMoveTaskToProject) {
                onMoveTaskToProject(taskId, proj.id);
              }
            }}
            role="button"
            tabIndex={0}
          >
            <span
              className="tempo-project-dot"
              style={{ backgroundColor: proj.color || "var(--interactive-accent)" }}
            />
            <span className="tempo-nav-title">{proj.title}</span>
            <span className="tempo-nav-badge" style={{ fontSize: 10 }}>
              {pct}%
            </span>
          </div>
        );
      })}

      <div className="tempo-sidebar-group-header" style={{ marginTop: 14 }}>
        <span className="tempo-sidebar-group-title">{t("cycles", locale)}</span>
        <button
          type="button"
          className="tempo-sidebar-add-btn"
          onClick={onOpenNewCycle}
          title={t("newCycle", locale)}
        >
          <PlusIcon size={12} />
        </button>
      </div>
      {Object.values(cycles).map((cycle) => (
        <div
          key={cycle.id}
          className={`tempo-nav-item ${activeNav === `cycle:${cycle.id}` ? "is-active" : ""} ${dragOverKey === `cycle:${cycle.id}` ? "is-drag-over" : ""}`}
          onClick={() => onSelectNav(`cycle:${cycle.id}`)}
          onKeyDown={(e) => activateOnKey(e, () => onSelectNav(`cycle:${cycle.id}`))}
          onDragOver={(e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
            setDragOverKey(`cycle:${cycle.id}`);
          }}
          onDragLeave={() => setDragOverKey(null)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOverKey(null);
            const taskId = e.dataTransfer?.getData("application/x-tempo-task-id");
            if (taskId && onMoveTaskToBucket) onMoveTaskToBucket(taskId, `cycle:${cycle.id}`);
          }}
          role="button"
          tabIndex={0}
        >
          <span className="tempo-nav-icon">
            <CycleIcon size={14} />
          </span>
          <span className="tempo-nav-title">{cycle.title}</span>
          {cycle.status === "current" && (
            <span className="tempo-nav-badge" style={{ fontSize: 9, fontWeight: 600 }}>
              NOW
            </span>
          )}
        </div>
      ))}

      <div className="tempo-sidebar-group-title" style={{ marginTop: 12 }}>
        {t("archive", locale)}
      </div>
      <div
        className={`tempo-nav-item ${activeNav === "completed" ? "is-active" : ""} ${
          dragOverKey === "completed" ? "is-drag-over" : ""
        }`}
        onClick={() => onSelectNav("completed")}
        onKeyDown={(e) => activateOnKey(e, () => onSelectNav("completed"))}
        onDragOver={(e) => {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
          if (dragOverKey !== "completed") setDragOverKey("completed");
        }}
        onDragLeave={() => {
          if (dragOverKey === "completed") setDragOverKey(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDragOverKey(null);
          const taskId =
            e.dataTransfer?.getData("application/x-tempo-task-id") ||
            e.dataTransfer?.getData("text/plain");
          if (taskId && onMoveTaskToBucket) {
            onMoveTaskToBucket(taskId, "completed");
          }
        }}
        role="button"
        tabIndex={0}
      >
        <span className="tempo-nav-icon">
          <CompletedIcon size={14} />
        </span>
        <span className="tempo-nav-title">{t("completedLog", locale)}</span>
      </div>
    </aside>
  );
}
