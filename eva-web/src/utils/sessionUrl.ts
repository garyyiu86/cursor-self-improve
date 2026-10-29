export interface SessionPlayUrlParams {
  planId?: string;
  dayId?: string;
  muscleGroup?: string;
  difficulty?: string;
  dayIndex?: number;
}

export function buildSessionPlayUrl(params: SessionPlayUrlParams): string {
  const qs = new URLSearchParams();
  if (params.planId) qs.set("planId", params.planId);
  if (params.dayId) qs.set("dayId", params.dayId);
  if (params.muscleGroup) qs.set("muscleGroup", params.muscleGroup);
  if (params.difficulty) qs.set("difficulty", params.difficulty);
  if (params.dayIndex != null) qs.set("dayIndex", String(params.dayIndex));
  return `/workout/play?${qs.toString()}`;
}
