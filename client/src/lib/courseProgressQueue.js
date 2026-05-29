/**
 * Sequential course-progress update queue — mirrors profileQueue. Keeps the
 * per-course distilled summary up to date as the learner completes lessons,
 * without overlapping writes racing each other.
 *
 * The summary is regenerated incrementally (prior summary + the one
 * just-completed lesson) so both the agent's input and the stored note stay
 * small — it is injected into the coach context on every turn of every other
 * lesson in the course (see lessonEngine.buildContext).
 */

import { getCourseProgress, saveCourseProgress } from '../../js/storage.js';
import { getLessonsInCourse } from '../../js/lessonOwner.js';
import * as orchestrator from '../../js/orchestrator.js';
import { syncInBackground } from './syncDebounce.js';

let _courseProgressQueue = Promise.resolve();

export function queueCourseProgressUpdate(fn) {
  _courseProgressQueue = _courseProgressQueue.then(fn).catch(e => {
    console.error('[plato] Course progress update failed:', e?.message || e, e?.stack);
  });
  return _courseProgressQueue;
}

/**
 * Regenerate the course-progress summary after a lesson completes.
 * No-op unless the lesson belongs to a course.
 * @param {object} lessonKB - the completed lesson's KB (learnerPosition, insights)
 * @param {object} lesson - the lesson (lessonId, name, course: { id, name })
 */
export function updateCourseProgressOnCompletionInBackground(lessonKB, lesson) {
  const courseId = lesson?.course?.id;
  if (!courseId) return Promise.resolve();
  return queueCourseProgressUpdate(async () => {
    const prior = await getCourseProgress(courseId);
    const lessonsInCourse = await getLessonsInCourse(courseId);
    const completedLesson = {
      name: lesson.name,
      learnerPosition: lessonKB?.learnerPosition || '',
      insights: lessonKB?.insights || [],
    };
    const result = await orchestrator.updateCourseProgress(
      lesson.course.name,
      lessonsInCourse,
      prior?.summary || '',
      completedLesson,
      prior?.completedLessonIds || [],
    );
    if (!result?.summary) {
      console.error('[plato] Course progress agent returned no summary:', result);
      return;
    }
    const completedLessonIds = [...new Set([
      ...(result.completedLessonIds || prior?.completedLessonIds || []),
      lesson.lessonId,
    ])];
    await saveCourseProgress(courseId, {
      courseId,
      summary: result.summary,
      completedLessonIds,
      updatedAt: Date.now(),
    });
    syncInBackground(`courseProgress:${courseId}`);
  });
}
