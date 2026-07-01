import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext.jsx';
import { getEnrollments, saveEnrollments, getLessonKB } from '../../js/storage.js';
import Check from 'lucide-react/dist/esm/icons/check';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';

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
  const [unenrollTarget, setUnenrollTarget] = useState(null);
  // Per-lesson completion (lessonId -> true) for the "N of M complete" progress
  // on each course card. Sourced from each lesson's KB status, same as the
  // lessons list; kept fresh via the lesson-completed event.
  const [completedById, setCompletedById] = useState({});

  useEffect(() => {
    (async () => setEnrolled(await getEnrollments()))();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = {};
      for (const l of lessons) {
        const kb = await getLessonKB(l.lessonId);
        if (kb?.status === 'completed') map[l.lessonId] = true;
      }
      if (!cancelled) setCompletedById(map);
    })();
    return () => { cancelled = true; };
  }, [lessons]);

  // Reflect a completion that happens elsewhere (e.g. finishing a lesson) without
  // a full reload.
  useEffect(() => {
    const onCompleted = (e) => {
      const id = e.detail?.lessonId;
      if (id) setCompletedById((prev) => ({ ...prev, [id]: true }));
    };
    window.addEventListener('plato:lesson-completed', onCompleted);
    return () => window.removeEventListener('plato:lesson-completed', onCompleted);
  }, []);

  const { courses, uncategorized } = useMemo(() => {
    const map = new Map();
    let uncat = { count: 0, completed: 0 };
    for (const l of lessons) {
      const done = !!completedById[l.lessonId];
      if (l.course?.id) {
        const entry = map.get(l.course.id) || { id: l.course.id, name: l.course.name, count: 0, completed: 0 };
        entry.count += 1;
        if (done) entry.completed += 1;
        map.set(l.course.id, entry);
      } else {
        uncat.count += 1;
        if (done) uncat.completed += 1;
      }
    }
    const sorted = [...map.values()].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );
    return { courses: sorted, uncategorized: uncat };
  }, [lessons, completedById]);

  const enrolledSet = useMemo(() => new Set(enrolled), [enrolled]);

  const enroll = async (courseId) => {
    const next = [...enrolled, courseId];
    setEnrolled(next);
    await saveEnrollments(next);
  };

  const toggleEnroll = (courseId, name) => {
    // Enrolling is one click; leaving a course asks for confirmation first.
    if (enrolledSet.has(courseId)) {
      setUnenrollTarget({ id: courseId, name });
    } else {
      enroll(courseId);
    }
  };

  const confirmUnenroll = async () => {
    if (!unenrollTarget) return;
    const next = enrolled.filter((id) => id !== unenrollTarget.id);
    setEnrolled(next);
    await saveEnrollments(next);
    setUnenrollTarget(null);
  };

  // Which cards this view shows. "My Courses" is the enrolled subset (real
  // courses only — Uncategorized is never enrollable).
  const visibleCourses = view === VIEW_MINE
    ? courses.filter((c) => enrolledSet.has(c.id))
    : courses;
  const showUncategorized = view === VIEW_ALL && uncategorized.count > 0;

  const isAllEmpty = courses.length === 0 && uncategorized.count === 0;
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
                completed={c.completed}
                enrolled={enrolledSet.has(c.id)}
                onOpen={() => navigate(`/courses/${c.id}`)}
                onToggleEnroll={() => toggleEnroll(c.id, c.name)}
              />
            </li>
          ))}
          {showUncategorized && (
            <li className="list-none">
              <CourseCard
                name="Uncategorized"
                count={uncategorized.count}
                completed={uncategorized.completed}
                onOpen={() => navigate(`/courses/${UNCATEGORIZED}`)}
              />
            </li>
          )}
        </ul>
      )}

      <Dialog open={!!unenrollTarget} onOpenChange={(open) => { if (!open) setUnenrollTarget(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Leave this course?</DialogTitle>
            <DialogDescription>
              {unenrollTarget
                ? `“${unenrollTarget.name}” will be removed from My Courses. Your progress and chat history are kept — you can re-enroll anytime.`
                : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnenrollTarget(null)}>Cancel</Button>
            <Button
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmUnenroll}
            >
              Leave course
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CourseCard({ name, count, completed = 0, enrolled, onOpen, onToggleEnroll }) {
  const lessonWord = count === 1 ? 'lesson' : 'lessons';
  const allDone = count > 0 && completed === count;
  const metaText = completed === 0
    ? `${count} ${lessonWord}`
    : (allDone
      ? `All ${count} ${lessonWord} complete`
      : `${completed} of ${count} ${lessonWord} complete`);
  const pct = count > 0 ? Math.round((completed / count) * 100) : 0;
  return (
    <Card className="flex h-full flex-col transition-shadow hover:shadow-md group gap-0 p-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open course ${name}, ${metaText}`}
        className="flex-1 w-full text-left px-4 py-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring"
      >
        <span className="text-base font-semibold leading-snug transition-colors group-hover:text-primary block">
          {name}
        </span>
        <p className={`text-sm mt-1 ${allDone ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{metaText}</p>
        {completed > 0 && (
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
          </div>
        )}
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
