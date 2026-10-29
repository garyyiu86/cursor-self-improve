import {
  MUSCLE_GROUP_META,
  MUSCLE_GROUPS,
  type MuscleFilter,
} from "../../../eva-core/data/exerciseLibrary";

interface MuscleFilterBarProps {
  value: MuscleFilter;
  onChange: (filter: MuscleFilter) => void;
}

const FILTERS: { id: MuscleFilter; label: string }[] = [
  { id: "all", label: "全部" },
  ...MUSCLE_GROUPS.map((id) => ({
    id,
    label: MUSCLE_GROUP_META[id].label,
  })),
];

export function MuscleFilterBar({ value, onChange }: MuscleFilterBarProps) {
  return (
    <div className="lib-filters" role="tablist" aria-label="肌肉群篩選">
      {FILTERS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={value === id}
          className={`lib-filter-btn${value === id ? " lib-filter-btn--active" : ""}`}
          onClick={() => onChange(id)}
        >
          {id !== "all" ? (
            <span className="lib-filter-emoji" aria-hidden="true">
              {MUSCLE_GROUP_META[id as keyof typeof MUSCLE_GROUP_META]?.emoji}
            </span>
          ) : null}
          {label}
        </button>
      ))}
    </div>
  );
}
