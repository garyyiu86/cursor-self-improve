import type { BicepWeeklyPlan, TrainingExercise, TrainingWorkoutDay } from "../data/trainingPlans";

const STORAGE_PREFIX = "eva-training-progress:";

function progressKey(planId: string, dayId: string, index: number): string {
  return `${planId}:${dayId}:${index}`;
}

function storageKey(planId: string): string {
  return `${STORAGE_PREFIX}${planId}`;
}

function loadDoneKeys(planId: string): Set<string> {
  try {
    const raw = sessionStorage.getItem(storageKey(planId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((k) => typeof k === "string") : []);
  } catch {
    return new Set();
  }
}

function saveDoneKeys(planId: string, keys: Set<string>): void {
  try {
    sessionStorage.setItem(storageKey(planId), JSON.stringify([...keys]));
  } catch {
    // ignore quota / private browsing
  }
}

function clearDoneKeys(planId: string): void {
  try {
    sessionStorage.removeItem(storageKey(planId));
  } catch {
    // ignore
  }
}

function allExerciseKeys(plan: BicepWeeklyPlan): string[] {
  const keys: string[] = [];
  for (const day of plan.workoutDays) {
    day.exercises.forEach((_, idx) => {
      keys.push(progressKey(plan.id, day.id, idx));
    });
  }
  return keys;
}

function dayExerciseKeys(planId: string, day: TrainingWorkoutDay): string[] {
  return day.exercises.map((_, idx) => progressKey(planId, day.id, idx));
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function createProgressSection(
  plan: BicepWeeklyPlan,
  doneKeys: Set<string>,
): {
  element: HTMLElement;
  refresh: () => void;
} {
  const keys = allExerciseKeys(plan);
  const progress = el("div", "tpc-progress");
  progress.setAttribute("role", "progressbar");

  const label = el("div", "tpc-progress-label");
  const track = el("div", "tpc-progress-track");
  const fill = el("div", "tpc-progress-fill");
  track.appendChild(fill);
  progress.appendChild(label);
  progress.appendChild(track);

  const refresh = () => {
    const done = keys.filter((k) => doneKeys.has(k)).length;
    const total = keys.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    const complete = total > 0 && done === total;
    label.textContent = complete ? `🎉 ${done} / ${total} 全部完成！` : `${done} / ${total} 完成`;
    fill.style.width = `${pct}%`;
    progress.classList.toggle("tpc-progress--complete", complete);
    progress.setAttribute("aria-valuenow", String(done));
    progress.setAttribute("aria-valuemin", "0");
    progress.setAttribute("aria-valuemax", String(total));
    progress.setAttribute("aria-label", `訓練進度 ${done} / ${total}`);
  };

  refresh();
  return { element: progress, refresh };
}

function updateDayBadge(
  badge: HTMLElement,
  doneKeys: Set<string>,
  planId: string,
  day: TrainingWorkoutDay,
): void {
  const keys = dayExerciseKeys(planId, day);
  const done = keys.filter((k) => doneKeys.has(k)).length;
  const total = keys.length;
  const complete = total > 0 && done === total;

  badge.classList.remove("tpc-day-badge--partial", "tpc-day-badge--complete");
  badge.classList.add(complete ? "tpc-day-badge--complete" : "tpc-day-badge--partial");
  badge.textContent = complete ? "✅ 完成" : `${done}/${total} 完成`;
  badge.setAttribute("aria-label", complete ? "本日訓練已全部完成" : `本日完成 ${done} / ${total}`);
}

function setExerciseDone(
  tr: HTMLTableRowElement,
  checkbox: HTMLInputElement,
  planId: string,
  key: string,
  doneKeys: Set<string>,
  done: boolean,
  onToggle: () => void,
): void {
  checkbox.checked = done;
  if (done) doneKeys.add(key);
  else doneKeys.delete(key);
  saveDoneKeys(planId, doneKeys);
  tr.classList.toggle("tpc-ex-done", done);
  tr.setAttribute("aria-checked", done ? "true" : "false");
  onToggle();
}

function renderExerciseRow(
  planId: string,
  dayId: string,
  index: number,
  exercise: TrainingExercise,
  doneKeys: Set<string>,
  onToggle: () => void,
): HTMLTableRowElement {
  const tr = document.createElement("tr");
  tr.className = "tpc-ex-row";
  tr.setAttribute("role", "checkbox");
  tr.tabIndex = 0;
  const key = progressKey(planId, dayId, index);
  const done = doneKeys.has(key);
  if (done) tr.classList.add("tpc-ex-done");
  tr.setAttribute("aria-checked", done ? "true" : "false");
  tr.setAttribute("aria-label", `完成：${exercise.name}`);

  const checkTd = el("td", "tpc-ex-check");
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.className = "tpc-checkbox";
  checkbox.checked = done;
  checkbox.setAttribute("aria-label", `完成：${exercise.name}`);
  checkbox.addEventListener("click", (e) => e.stopPropagation());
  checkbox.addEventListener("change", () => {
    setExerciseDone(tr, checkbox, planId, key, doneKeys, checkbox.checked, onToggle);
  });
  checkTd.appendChild(checkbox);
  tr.appendChild(checkTd);

  const toggleRow = () => {
    setExerciseDone(tr, checkbox, planId, key, doneKeys, !checkbox.checked, onToggle);
  };
  tr.addEventListener("click", toggleRow);
  tr.addEventListener("keydown", (e) => {
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggleRow();
    }
  });

  const nameTd = el("td", "tpc-ex-name");
  nameTd.appendChild(el("span", "tpc-ex-name-text", exercise.name));
  if (exercise.tip) {
    nameTd.appendChild(el("span", "tpc-ex-tip-inline", exercise.tip));
  }
  tr.appendChild(nameTd);

  tr.appendChild(el("td", "tpc-ex-sets", String(exercise.sets)));
  tr.appendChild(el("td", "tpc-ex-reps", exercise.reps));

  return tr;
}

function renderWorkoutDay(
  planId: string,
  day: TrainingWorkoutDay,
  doneKeys: Set<string>,
  onToggle: () => void,
): { element: HTMLElement; refresh: () => void } {
  const section = el("section", "tpc-day");

  const heading = el("h4", "tpc-day-heading");
  heading.appendChild(
    el(
      "span",
      "tpc-day-heading-text",
      `${day.emoji} Day ${day.id.slice(-1)} · 星期${day.weekday} — ${day.title}`,
    ),
  );
  const badge = el("span", "tpc-day-badge");
  heading.appendChild(badge);
  section.appendChild(heading);

  const refresh = () => updateDayBadge(badge, doneKeys, planId, day);
  refresh();

  const meta = el("div", "tpc-day-meta", `⏱ ${day.duration}`);
  section.appendChild(meta);

  const tableWrap = el("div", "tpc-table-wrap");
  const table = el("table", "tpc-table");

  const thead = el("thead");
  const headRow = el("tr");
  for (const label of ["", "動作", "組數", "次數"]) {
    headRow.appendChild(el("th", undefined, label));
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = el("tbody");
  day.exercises.forEach((exercise, index) => {
    tbody.appendChild(renderExerciseRow(planId, day.id, index, exercise, doneKeys, onToggle));
  });
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  section.appendChild(tableWrap);

  return { element: section, refresh };
}

/** Render a structured training plan card into `parent` (returns the card root). */
export function mountTrainingPlanCard(parent: HTMLElement, plan: BicepWeeklyPlan): HTMLElement {
  const doneKeys = loadDoneKeys(plan.id);
  const card = el("article", "training-plan-card");
  card.dataset.planId = plan.id;

  const dayRefreshers: (() => void)[] = [];
  const refreshAll = () => {
    refreshProgress();
    for (const refreshDay of dayRefreshers) refreshDay();
  };

  const { element: progressEl, refresh: refreshProgress } = createProgressSection(plan, doneKeys);
  card.appendChild(progressEl);

  const header = el("header", "tpc-header");
  header.appendChild(el("h3", "tpc-title", plan.title));
  header.appendChild(el("p", "tpc-subtitle", plan.subtitle));
  card.appendChild(header);

  for (const day of plan.workoutDays) {
    const { element, refresh } = renderWorkoutDay(plan.id, day, doneKeys, refreshAll);
    dayRefreshers.push(refresh);
    card.appendChild(element);
  }

  const reminders = el("section", "tpc-reminders");
  reminders.appendChild(el("h4", "tpc-reminders-heading", "重點提醒"));
  const ul = el("ul", "tpc-reminders-list");
  for (const item of plan.reminders) {
    ul.appendChild(el("li", undefined, item));
  }
  reminders.appendChild(ul);
  card.appendChild(reminders);

  const resetWrap = el("div", "tpc-reset-wrap");
  const resetBtn = el("button", "tpc-reset-btn", "重置進度");
  resetBtn.type = "button";
  resetBtn.setAttribute("aria-label", "清除本週所有訓練進度");
  resetBtn.addEventListener("click", () => {
    doneKeys.clear();
    clearDoneKeys(plan.id);
    for (const checkbox of card.querySelectorAll<HTMLInputElement>(".tpc-checkbox")) {
      checkbox.checked = false;
    }
    for (const row of card.querySelectorAll<HTMLTableRowElement>("tbody tr.tpc-ex-row")) {
      row.classList.remove("tpc-ex-done");
      row.setAttribute("aria-checked", "false");
    }
    refreshAll();
  });
  resetWrap.appendChild(resetBtn);
  card.appendChild(resetWrap);

  const footer = el("footer", "tpc-footer", `LUMINA motto：${plan.motto} ✊`);
  card.appendChild(footer);

  parent.appendChild(card);
  return card;
}
