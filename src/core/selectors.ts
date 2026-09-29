import type { Task, TodoDatabase } from "./types";
import { getTodayString } from "../services/date-service";

export interface NavCounts {
  inbox: number;
  today: number;
  upcoming: number;
  anytime: number;
  someday: number;
  waiting: number;
  completed: number;
}

export interface KpiStats {
  todayRemaining: number;
  inProgress: number;
  inbox: number;
  todayDone: number;
}

/**
 * Checks if a unix timestamp falls on the specified calendar day (YYYY-MM-DD).
 */
export function isSameDay(timestamp: number, dateStr: string): boolean {
  const d = new Date(timestamp);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` === dateStr;
}

/**
 * Filters top-level tasks (excludes subtasks).
 */
export function getTopLevelTasks(tasks: Record<string, Task> | Task[]): Task[] {
  const list = Array.isArray(tasks) ? tasks : Object.values(tasks);
  return list.filter((t) => !t.parentTaskId);
}

/**
 * Groups subtasks by their parent once per render.
 * Callers used to scan the whole task list for every rendered row, which is O(n²).
 */
export function buildChildrenMap(tasks: Record<string, Task> | Task[]): Map<string, Task[]> {
  const list = Array.isArray(tasks) ? tasks : Object.values(tasks);
  const map = new Map<string, Task[]>();
  for (const task of list) {
    if (!task.parentTaskId) continue;
    const bucket = map.get(task.parentTaskId);
    if (bucket) bucket.push(task);
    else map.set(task.parentTaskId, [task]);
  }
  return map;
}

/**
 * A task is actionable today when it was focused for today, already started, or is due.
 * Shared by the Today list, the Today nav badge and the "today remaining" KPI so all three
 * always agree.
 */
export function isScheduledForToday(task: Task, today = getTodayString()): boolean {
  return (
    task.focusDate === today ||
    (!!task.startDate && task.startDate <= today) ||
    (!!task.dueDate && task.dueDate <= today)
  );
}

/**
 * A finished task belongs to today when it was completed today. Entries saved before
 * completedAt was stamped fall back to their scheduling dates, and the "completed today"
 * KPI uses this same rule so the list and the KPI cannot disagree.
 */
export function isCompletedToday(task: Task, today = getTodayString()): boolean {
  if (task.status !== "done") return false;
  if (typeof task.completedAt === "number") return isSameDay(task.completedAt, today);
  return task.focusDate === today || task.dueDate === today;
}

/**
 * Tasks for Today view:
 * 1. Active (todo/in_progress/waiting) tasks triaged and scheduled for today.
 * 2. Done tasks completed on the local calendar day of today.
 * 3. Excludes canceled tasks and someday tasks.
 *
 * Waiting tasks that are scheduled for today appear here as their own group; the same task
 * is also listed under the Waiting bucket, which is a status view rather than a time bucket.
 */
export function getTodayTasks(tasks: Record<string, Task> | Task[], today = getTodayString()): Task[] {
  return getTopLevelTasks(tasks).filter((t) => {
    if (t.availability === "someday") return false;
    if (t.triage !== "processed") return false;

    if (t.status === "done") return isCompletedToday(t, today);
    if (t.status === "canceled") return false;

    return isScheduledForToday(t, today);
  });
}

/**
 * Tasks for Inbox view: items captured but not triaged yet.
 * Items that are already finished or canceled have been handled, so they leave the inbox
 * and remain reachable through the Completed archive.
 */
export function getInboxTasks(tasks: Record<string, Task> | Task[]): Task[] {
  return getTopLevelTasks(tasks).filter(
    (t) => t.triage === "inbox" && t.status !== "done" && t.status !== "canceled"
  );
}

/**
 * Tasks for Upcoming view:
 * Processed active tasks starting or due in the future.
 *
 * This intentionally overlaps with Today: a task that already started but is due later
 * stays on Today and also shows up under its future date, matching how a scheduled list
 * behaves in Things 3. The two buckets are therefore not a partition of the task set.
 */
export function getUpcomingTasks(tasks: Record<string, Task> | Task[], today = getTodayString()): Task[] {
  return getTopLevelTasks(tasks).filter(
    (t) =>
      t.triage === "processed" &&
      t.status !== "done" &&
      t.status !== "canceled" &&
      ((!!t.startDate && t.startDate > today) || (!!t.dueDate && t.dueDate > today))
  );
}

/**
 * Tasks for Anytime view:
 * Processed active anytime tasks whose start date has arrived (or is not set).
 */
export function getAnytimeTasks(tasks: Record<string, Task> | Task[], today = getTodayString()): Task[] {
  return getTopLevelTasks(tasks).filter(
    (t) =>
      t.triage === "processed" &&
      t.availability === "anytime" &&
      t.status !== "done" &&
      t.status !== "canceled" &&
      (!t.startDate || t.startDate <= today)
  );
}

/**
 * Tasks for Someday view.
 */
export function getSomedayTasks(tasks: Record<string, Task> | Task[]): Task[] {
  return getTopLevelTasks(tasks).filter(
    (t) =>
      t.availability === "someday" &&
      t.status !== "done" &&
      t.status !== "canceled"
  );
}

/**
 * Tasks for Waiting view.
 */
export function getWaitingTasks(tasks: Record<string, Task> | Task[]): Task[] {
  return getTopLevelTasks(tasks).filter(
    (t) => t.status === "waiting"
  );
}

/**
 * Tasks for Completed log view.
 */
export function getCompletedTasks(tasks: Record<string, Task> | Task[]): Task[] {
  return getTopLevelTasks(tasks)
    .filter((t) => t.status === "done")
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
}

/**
 * Computes exact unified navigation counts matching lists.
 * Counts mirror the lists one-for-one, including the deliberate Today/Upcoming and
 * Today/Waiting overlaps described on those selectors.
 */
export function getNavCounts(tasks: Record<string, Task> | Task[], today = getTodayString()): NavCounts {
  const topTasks = getTopLevelTasks(tasks);

  const inbox = topTasks.filter(
    (t) => t.triage === "inbox" && t.status !== "done" && t.status !== "canceled"
  ).length;

  const todayCount = topTasks.filter(
    (t) =>
      t.triage === "processed" &&
      t.availability !== "someday" &&
      t.status !== "done" &&
      t.status !== "canceled" &&
      isScheduledForToday(t, today)
  ).length;

  const upcoming = topTasks.filter(
    (t) =>
      t.triage === "processed" &&
      t.status !== "done" &&
      t.status !== "canceled" &&
      ((!!t.startDate && t.startDate > today) || (!!t.dueDate && t.dueDate > today))
  ).length;

  const anytime = topTasks.filter(
    (t) =>
      t.triage === "processed" &&
      t.availability === "anytime" &&
      t.status !== "done" &&
      t.status !== "canceled" &&
      (!t.startDate || t.startDate <= today)
  ).length;

  const someday = topTasks.filter(
    (t) => t.availability === "someday" && t.status !== "done" && t.status !== "canceled"
  ).length;

  const waiting = topTasks.filter(
    (t) => t.status === "waiting"
  ).length;

  const completed = topTasks.filter((t) => t.status === "done").length;

  return { inbox, today: todayCount, upcoming, anytime, someday, waiting, completed };
}

/**
 * Computes KPI indicators matching the actual database state.
 * Every value is derived from the same predicates the lists use, so a card can never
 * contradict the view it links to.
 */
export function getKpiStats(tasks: Record<string, Task> | Task[], today = getTodayString()): KpiStats {
  const topTasks = getTopLevelTasks(tasks);

  const todayRemaining = topTasks.filter(
    (t) =>
      t.triage === "processed" &&
      t.availability !== "someday" &&
      t.status !== "done" &&
      t.status !== "canceled" &&
      isScheduledForToday(t, today)
  ).length;

  const inProgress = topTasks.filter((t) => t.status === "in_progress").length;
  const inbox = topTasks.filter(
    (t) => t.triage === "inbox" && t.status !== "done" && t.status !== "canceled"
  ).length;

  const todayDone = topTasks.filter((t) => isCompletedToday(t, today)).length;

  return { todayRemaining, inProgress, inbox, todayDone };
}

/**
 * Returns tasks ordered as they visually appear on screen for a given view.
 * Essential for correct keyboard navigation (ArrowUp/ArrowDown).
 */
export function getVisualOrderTasks(tasks: Task[], activeNav: string): Task[] {
  if (activeNav === "today") {
    const inProgress = tasks.filter((t) => t.status === "in_progress");
    const todo = tasks.filter((t) => t.status === "todo");
    const waiting = tasks.filter((t) => t.status === "waiting");
    const done = tasks.filter((t) => t.status === "done");
    const canceled = tasks.filter((t) => t.status === "canceled");
    return [...inProgress, ...todo, ...waiting, ...done, ...canceled];
  }

  // Other views preserve order or sorted by priority/dueDate
  return [...tasks];
}
