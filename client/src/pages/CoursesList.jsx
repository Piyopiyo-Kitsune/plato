import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext.jsx';
import { getEnrollments, saveEnrollments } from '../../js/storage.js';
import Check from 'lucide-react/dist/esm/icons/check';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// Sentinel route segment for lessons with no course assigned.
const UNCATEGORIZED = 'none';

// Landing-page views.
const VIEW_ALL = 'all';
const VIEW_MINE = 'mine';

/**
 * Courses landing page — the WordPress Coach home. Lists the courses derived
 * from the learner's accessible lessons (each lesson carries an inlined
 * `course`), with a lesson count, and links into a course-scoped lessons view.
 *
 * Two views, toggled by a segmented control:
 *   - "All Courses" — everything the learner can access; each card can be
 *     enrolled in.
 *   - "My Courses"  — only the courses the learner has explicitly enrolled in.
 *
 * Enrollment is a per-learner list of course ids persisted to sync-data
 * (`enrollments`). An "Uncategorized" card appears only in All Courses and is
 * not enrollable (it isn't a real course).
 */
export default function CoursesList() {
  const { state } = useApp();
  const { lessons, loaded } = state;
  const navigate = useNavigate();

  const [view, setView] = useState(VIEW_ALL);
  const [enrolled, setEnrolled] = useState([]);

  useEffect(() => {
    (async () => setEnrolled(await getEnrollments()))();
  }, []);

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

  const enrolledSet = useMemo(() => new Set(enrolled), [enrolled]);

  const toggleEnroll = async (courseId) => {
    const next = enrolledSet.has(courseId)
      ? enrolled.filter((id) => id !== courseId)
      : [...enrolled, courseId];
    setEnrolled(next);
    await saveEnrollments(next);
  };

  // Which cards this view shows. "My Courses" is the enrolled subset (real
  // courses only — Uncategorized is never enrollable).
  const visibleCourses = view === VIEW_MINE
    ? courses.filter((c) => enrolledSet.has(c.id))
    : courses;
  const showUncategorized = view === VIEW_ALL && uncategorized > 0;

  const isAllEmpty = courses.length === 0 && uncategorized === 0;
  const isMineEmpty = view === VIEW_MINE && visibleCourses.length === 0;

  return (
    <div className="mx-auto max-w-5xl p-4">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Welcome to your WordPress Coach</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground leading-relaxed">
          {view === VIEW_ALL
            ? 'Explore WordPress topics through an engaging chat with your AI coach. It guides you through short, hands-on lessons, answers questions, and adjusts to how you learn. Pick a course below to get started.'
            : 'These are the courses you’ve enrolled in. Pick up where you left off — or switch to All Courses to find more.'}
        </p>
      </header>

      {/* View toggle: All Courses / My Courses */}
      <div className="mb-4 inline-flex rounded-md border p-0.5" role="group" aria-label="Course view">
        <button
          type="button"
          onClick={() => setView(VIEW_ALL)}
          aria-pressed={view === VIEW_ALL}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            view === VIEW_ALL ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All Courses
        </button>
        <button
          type="button"
          onClick={() => setView(VIEW_MINE)}
          aria-pressed={view === VIEW_MINE}
          className={`rounded px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
            view === VIEW_MINE ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          My Courses{enrolled.length > 0 ? ` (${enrolled.length})` : ''}
        </button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {loaded
          ? `${view === VIEW_MINE ? 'My Courses' : 'All Courses'}: showing ${visibleCourses.length} ${visibleCourses.length === 1 ? 'course' : 'courses'}.`
          : ''}
      </div>

      {!loaded ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          Loading courses…
        </div>
      ) : isAllEmpty ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          No courses yet.
        </div>
      ) : isMineEmpty ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="text-muted-foreground">You haven&apos;t enrolled in any courses yet.</p>
          <Button variant="outline" className="mt-3" onClick={() => setView(VIEW_ALL)}>
            Browse all courses
          </Button>
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" role="list" aria-label={view === VIEW_MINE ? 'My courses' : 'All courses'}>
          {visibleCourses.map((c, i) => (
            <li
              key={c.id}
              className="animate-in fade-in slide-in-from-bottom-2 fill-mode-both list-none"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <CourseCard
                name={c.name}
                count={c.count}
                enrolled={enrolledSet.has(c.id)}
                onOpen={() => navigate(`/courses/${c.id}`)}
                onToggleEnroll={() => toggleEnroll(c.id)}
              />
            </li>
          ))}
          {showUncategorized && (
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

function CourseCard({ name, count, enrolled, onOpen, onToggleEnroll }) {
  const lessonWord = count === 1 ? 'lesson' : 'lessons';
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md group gap-0 p-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open course ${name}, ${count} ${lessonWord}`}
        className="flex-1 w-full text-left px-4 py-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        <span className="text-base font-semibold leading-snug transition-colors group-hover:text-primary block">
          {name}
        </span>
        <p className="text-sm text-muted-foreground mt-1">{count} {lessonWord}</p>
      </button>
      {onToggleEnroll && (
        <div className="border-t px-4 py-2">
          <Button
            type="button"
            variant={enrolled ? 'secondary' : 'outline'}
            size="sm"
            aria-pressed={enrolled}
            aria-label={enrolled ? `Leave course ${name}` : `Enroll in course ${name}`}
            onClick={onToggleEnroll}
          >
            {enrolled ? (
              <>
                <Check className="size-4" aria-hidden="true" /> Enrolled
              </>
            ) : (
              'Enroll'
            )}
          </Button>
        </div>
      )}
    </Card>
  );
}
