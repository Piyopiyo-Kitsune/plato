import { MAX_EXCHANGES } from '../../lib/constants.js';

/**
 * Lesson progress meter -- simple bar driven by coach's progress score.
 * Shows exchange count when over-target to help learners gauge if they're in
 * a productive tangent or should return to the exemplar path.
 */
export default function ProgressBar({ lessonKB }) {
  if (!lessonKB) return null;

  const progress = lessonKB.progress ?? 0;
  const isComplete = lessonKB.status === 'completed';
  const pct = isComplete ? 100 : progress * 10;
  const activities = lessonKB.activitiesCompleted ?? 0;
  const showExchangeCount = !isComplete && activities > MAX_EXCHANGES;

  return (
    <div
      className="mt-1.5"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={`Lesson progress: ${pct}% toward exemplar${showExchangeCount ? `, exchange ${activities}` : ''}`}
    >
      <div className="flex justify-between text-xs text-muted-foreground mb-1" aria-hidden="true">
        <span>Starting</span>
        <span>{isComplete ? '\uD83C\uDF89 Exemplar Achieved!' : 'Exemplar \uD83C\uDF89'}</span>
      </div>
      {showExchangeCount && (
        <div className="text-xs text-muted-foreground text-center mb-1">
          Exchange {activities} \u2014 exploring beyond the lesson path
        </div>
      )}
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-primary'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
