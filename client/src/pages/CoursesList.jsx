import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext.jsx';
import { Card } from '@/components/ui/card';

// Sentinel route segment for lessons with no course assigned.
const UNCATEGORIZED = 'none';

/**
 * Courses landing page — the classroom home. Lists the courses derived from the
 * learner's accessible lessons (each lesson carries an inlined `course`), with a
 * lesson count, and links into a course-scoped lessons view. An "Uncategorized"
 * card appears only when some lessons have no course.
 */
export default function CoursesList() {
  const { state } = useApp();
  const { lessons, loaded } = state;
  const navigate = useNavigate();

  const { courses, uncategorized } = useMemo(() => {
    const map = new Map();
    let uncat = 0;
    for (const l of lessons) {
      if (l.course?.id) {
        const entry = map.get(l.course.id) || { id: l.course.id, name: l.course.name, count: 0 };
        entry.count += 1;
        map.set(l.course.id, entry);
      } else {
        uncat += 1;
      }
    }
    const sorted = [...map.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    return { courses: sorted, uncategorized: uncat };
  }, [lessons]);

  const isEmpty = courses.length === 0 && uncategorized === 0;

  return (
    <div className="mx-auto max-w-5xl p-4">
      <h1 className="text-xl font-semibold mb-4">Courses</h1>

      <div role="status" aria-live="polite" className="sr-only">
        {loaded ? `Showing ${courses.length} ${courses.length === 1 ? 'course' : 'courses'}.` : ''}
      </div>

      {!loaded ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          Loading courses…
        </div>
      ) : isEmpty ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          No courses yet.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="list" aria-label="Courses">
          {courses.map((c, i) => (
            <li
              key={c.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both list-none"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <CourseCard name={c.name} count={c.count} onOpen={() => navigate(`/courses/${c.id}`)} />
            </li>
          ))}
          {uncategorized > 0 && (
            <li className="list-none">
              <CourseCard
                name="Uncategorized"
                count={uncategorized}
                onOpen={() => navigate(`/courses/${UNCATEGORIZED}`)}
              />
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function CourseCard({ name, count, onOpen }) {
  const lessonWord = count === 1 ? 'lesson' : 'lessons';
  return (
    <Card className="h-full transition-shadow hover:shadow-md group gap-0 p-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open course ${name}, ${count} ${lessonWord}`}
        className="w-full text-left px-4 py-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        <span className="text-base font-semibold leading-snug transition-colors group-hover:text-primary block">
          {name}
        </span>
        <p className="text-sm text-muted-foreground mt-1">{count} {lessonWord}</p>
      </button>
    </Card>
  );
}
