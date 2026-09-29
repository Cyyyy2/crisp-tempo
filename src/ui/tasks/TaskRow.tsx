import type { JSX } from "preact";
import type { Project, Task, TaskStatus } from "../../core/types";
import { formatDateDisplay, getTodayString, isOverdue } from "../../services/date-service";
import { t, type Locale, type TranslationKey } from "../../services/i18n";
import { PriorityIcon, StatusIcon } from "../icons/Icons";

const STATUS_LABEL_KEYS: Record<TaskStatus, TranslationKey> = {
  todo: "statusTodo",
  in_progress: "statusInProgress",
  waiting: "statusWaiting",
  done: "statusDone",
  canceled: "statusCanceled",
};

interface TaskRowProps {
  task: Task;
  locale: Locale;
  project?: Project;
  subtasks?: Task[];
  isSelected: boolean;
  onSelect: () => void;
  onToggleStatus: () => void;
}

export function TaskRow({
  task,
  locale,
  project,
  subtasks = [],
  isSelected,
  onSelect,
  onToggleStatus,
}: TaskRowProps): JSX.Element {
  const isDone = task.status === "done";
  const today = getTodayString();
  const isTaskToday = task.focusDate === today || task.dueDate === today || task.startDate === today;
  const overdue = !isDone && isOverdue(task.dueDate);
  const statusLabel = t(STATUS_LABEL_KEYS[task.status] ?? "statusTodo", locale);

  // Subtask progress
  const doneSubtasks = subtasks.filter((s) => s.status === "done").length;
  const hasSubtasks = subtasks.length > 0;

  return (
    <div
      className={`tempo-task-row ${isSelected ? "is-selected" : ""} ${isDone ? "is-done" : ""}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      role="button"
      aria-label={task.title}
      tabIndex={0}
      draggable={true}
      onDragStart={(e: DragEvent) => {
        if (!e.dataTransfer) return;
        e.dataTransfer.setData("application/x-tempo-task-id", task.id);
        e.dataTransfer.setData("text/plain", task.id);
        e.dataTransfer.effectAllowed = "move";
        (e.currentTarget as HTMLElement).classList.add("is-dragging");
      }}
      onDragEnd={(e: DragEvent) => {
        (e.currentTarget as HTMLElement).classList.remove("is-dragging");
      }}
    >
      {/* 1. Status Toggle */}
      <div
        className="tempo-status-btn"
        onClick={(e) => {
          e.stopPropagation();
          onToggleStatus();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            e.stopPropagation();
            onToggleStatus();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`${t("status", locale)}: ${task.title}`}
        title={statusLabel}
      >
        <StatusIcon status={task.status} size={15} />
      </div>

      {/* 2. Linear-style Priority */}
      <PriorityIcon priority={task.priority} size={14} />

      {/* 3. Title */}
      <div className="tempo-task-title" title={task.title}>
        {task.title}
      </div>

      {/* 4. Subtask Indicator */}
      {hasSubtasks && (
        <span
          className="tempo-project-tag"
          style={{ fontSize: 10, padding: "1px 5px" }}
          title={`${doneSubtasks}/${subtasks.length} ${t("subtasks", locale)}`}
        >
          {doneSubtasks}/{subtasks.length}
        </span>
      )}

      {/* 5. Meta: Project Tag */}
      {project && (
        <div className="tempo-project-tag" title={`${t("project", locale)}: ${project.title}`}>
          <span
            className="tempo-project-dot"
            style={{ backgroundColor: project.color || "var(--interactive-accent)" }}
          />
          <span>{project.title}</span>
        </div>
      )}

      {/* 6. Meta: Date Tag */}
      {task.dueDate && (
        <div
          className={`tempo-date-tag ${overdue ? "is-overdue" : isTaskToday ? "is-today" : ""}`}
          title={`${t("dueDate", locale)}: ${task.dueDate}`}
        >
          {overdue ? `${t("overdue", locale)} ` : ""}
          {formatDateDisplay(task.dueDate, locale)}
        </div>
      )}
    </div>
  );
}
