import {
  DIFFICULTY_LABELS,
  MUSCLE_GROUP_META,
  type LibraryExercise,
} from "../../../eva-core/data/exerciseLibrary";

interface ExerciseLibraryGridProps {
  exercises: LibraryExercise[];
  onSelect: (exercise: LibraryExercise) => void;
}

export function ExerciseLibraryGrid({
  exercises,
  onSelect,
}: ExerciseLibraryGridProps) {
  if (exercises.length === 0) {
    return <p className="lib-empty">呢個分類暫時未有動作～</p>;
  }

  return (
    <div className="lib-grid">
      {exercises.map((exercise) => {
        const diff = DIFFICULTY_LABELS[exercise.difficulty];
        const muscle = MUSCLE_GROUP_META[exercise.muscleGroup];

        return (
          <button
            key={exercise.id}
            type="button"
            className="lib-card"
            onClick={() => onSelect(exercise)}
            aria-label={`查看 ${exercise.name} 動作詳情`}
          >
            <div
              className={`lib-illus lib-illus--${exercise.illustration}`}
              aria-hidden="true"
            >
              <span className="lib-illus-figure" />
            </div>

            <div className="lib-card-body">
              <h3 className="lib-card-name">{exercise.name}</h3>
              <div className="lib-card-tags">
                <span className="lib-card-muscle">
                  {muscle.emoji} {muscle.label}
                </span>
                <span className={`lib-card-diff lib-card-diff--${diff.tone}`}>
                  {diff.label}
                </span>
              </div>
              <p className="lib-card-tip">{exercise.formTips[0]}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
