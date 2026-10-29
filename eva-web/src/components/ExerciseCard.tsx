import type { LibraryExercise } from "../data/exercises";
import { DIFFICULTY_LABELS } from "../data/exercises";

interface ExerciseCardProps {
  exercise: LibraryExercise;
}

export function ExerciseCard({ exercise }: ExerciseCardProps) {
  const diff = DIFFICULTY_LABELS[exercise.difficulty];

  return (
    <article className="ex-card" aria-label={`${exercise.nameEn} ${exercise.nameZh}`}>
      <header className="ex-card-head">
        <span className="ex-card-emoji" aria-hidden="true">
          {exercise.emoji}
        </span>
        <div className="ex-card-titles">
          <h3 className="ex-card-name">
            {exercise.nameEn}
            <span className="ex-card-name-zh">（{exercise.nameZh}）</span>
          </h3>
          <span className="ex-card-muscle">{exercise.muscleTag}</span>
        </div>
        <span className={`ex-card-diff ex-card-diff--${diff.tone}`}>
          {diff.label}
        </span>
      </header>

      <ol className="ex-card-tips" aria-label="動作要點">
        {exercise.formTips.map((tip, index) => (
          <li key={index}>{tip}</li>
        ))}
      </ol>
    </article>
  );
}
