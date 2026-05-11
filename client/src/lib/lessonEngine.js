/**
 * Lesson engine — conversational coaching toward the exemplar.
 *
 * 1. Lesson starts: Lesson Owner generates KB, Coach opens conversation
 * 2. Learner responds (text or image)
 * 3. Coach evaluates, coaches forward, updates KB + progress
 * 4. Repeat until exemplar achieved
 */

import {
  getLearnerProfileSummary, getPreferences,
  getLessonKB, saveLessonKB,
  saveScreenshot,
  saveLessonMessages, getLessonMessages,
} from '../../js/storage.js';
import * as orchestrator from '../../js/orchestrator.js';
import { syncInBackground } from './syncDebounce.js';
import { ensureProfileExists, updateProfileOnCompletionInBackground, updateProfileFromObservation } from './profileQueue.js';
import { LESSON_PHASES, MSG_TYPES, MAX_EXCHANGES } from './constants.js';

function ts() { return Date.now(); }

/**
 * Defense-in-depth guard for the "View as User" admin feature: if the SPA
 * is currently impersonating a learner, no write paths in the lesson engine
 * may execute — they would corrupt the impersonated learner's record using
 * the admin's own JWT (which is what the Function URL actually authorizes
 * against). The compose bar is also disabled in the UI; this guard catches
 * programmatic / future-bug callers.
 */
function assertNotImpersonating(action) {
  if (typeof sessionStorage === 'undefined') return;
  if (sessionStorage.getItem('plato_impersonation')) {
    throw new Error(`Cannot ${action} while viewing as another user`);
  }
}

// Bedrock hard limit for base64-encoded image payloads.
// 5 MB decoded = 5 * 1024 * 1024 bytes. Base64 string length * 3/4 ≈ decoded bytes.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/**
 * Throw a learner-friendly error if an image data URL decodes to more than
 * 5 MB — Bedrock rejects larger images with a cryptic ValidationException.
 * Returns silently for non-image URLs or URLs without a parseable base64 body.
 */
export function assertImageWithinBedrockLimit(imageDataUrl) {
  if (!imageDataUrl) return;
  const match = imageDataUrl.match(/^data:image\/\w+;base64,(.+)$/);
  if (!match) return;
  const estimatedBytes = Math.floor(match[1].length * 3 / 4);
  if (estimatedBytes > MAX_IMAGE_BYTES) {
    throw new Error(
      `Image is too large (${(estimatedBytes / (1024 * 1024)).toFixed(1)} MB). ` +
      `Please resize it to under 5 MB and try again.`
    );
  }
}

// -- Tag parsing --------------------------------------------------------------

// Detects where the coach tag section begins (tags always come at the end)
const TAG_SECTION_REGEX = /\n?\[(?:PROGRESS|KB_UPDATE|PROFILE_UPDATE)[:\s]/;

/**
 * Extract a JSON object from text starting after startPos, using bracket
 * counting so that }] inside string values doesn't confuse the parser.
 */
function extractBracketedJSON(text, startPos) {
  let i = startPos;
  while (i < text.length && /\s/.test(text[i])) i++; // skip whitespace
  if (text[i] !== '{') return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  const start = i;

  while (i < text.length) {
    const ch = text[i];
    if (escape) { escape = false; }
    else if (ch === '\\' && inString) { escape = true; }
    else if (ch === '"') { inString = !inString; }
    else if (!inString) {
      if (ch === '{') depth++;
      else if (ch === '}') { depth--; if (depth === 0) return text.slice(start, i + 1); }
    }
    i++;
  }
  return null;
}

/** Strip the tag section from raw coach output, returning only the visible text. */
function stripTags(text) {
  const tagStart = text.search(TAG_SECTION_REGEX);
  return (tagStart !== -1 ? text.slice(0, tagStart) : text).trim();
}

export function parseCoachResponse(raw) {
  let progress = null;
  let kbUpdate = null;
  let profileUpdate = null;

  // Extract progress
  const progressMatch = raw.match(/\[PROGRESS:\s*(\d+)\]/);
  if (progressMatch) progress = parseInt(progressMatch[1], 10);

  // Extract KB update — bracket-aware so }] inside string values don't mislead
  const kbIdx = raw.indexOf('[KB_UPDATE:');
  if (kbIdx !== -1) {
    const jsonStr = extractBracketedJSON(raw, kbIdx + '[KB_UPDATE:'.length);
    if (jsonStr) { try { kbUpdate = JSON.parse(jsonStr); } catch { /* ignore */ } }
  }

  // Extract profile update
  const profIdx = raw.indexOf('[PROFILE_UPDATE:');
  if (profIdx !== -1) {
    const jsonStr = extractBracketedJSON(raw, profIdx + '[PROFILE_UPDATE:'.length);
    if (jsonStr) { try { profileUpdate = JSON.parse(jsonStr); } catch { /* ignore */ } }
  }

  return { text: stripTags(raw), progress, kbUpdate, profileUpdate };
}

/**
 * Wrap a stream callback to strip tags from partial accumulated text.
 * Tags always appear at the end of the response — truncate there.
 */
export function cleanStream(onStream) {
  if (!onStream) return () => {};
  return (partial) => onStream(stripTags(partial));
}

// -- Lesson lifecycle ---------------------------------------------------------

/**
 * Start a new lesson: Lesson Owner generates KB, Coach opens conversation.
 */
export async function startLesson(lessonId, lesson, onStream) {
  assertNotImpersonating('start a lesson');
  await ensureProfileExists();
  const profileSummary = await getLearnerProfileSummary();

  // Lesson Owner generates the KB
  const lessonKB = await orchestrator.initializeLessonKB(lesson, profileSummary);
  lessonKB.lessonId = lessonId;
  lessonKB.name = lesson.name;
  lessonKB.progress = 0;
  lessonKB.startedAt = ts();
  await saveLessonKB(lessonId, lessonKB);
  syncInBackground(`lessonKB:${lessonId}`);

  // Coach opens the conversation
  const prefs = await getPreferences();
  const context = buildContext(lesson, lessonKB, profileSummary, prefs.name);
  const coachMsg = await orchestrator.converseStream(
    'coach',
    [{ role: 'user', content: context }, { role: 'assistant', content: 'Ready.' }, { role: 'user', content: 'Start the lesson.' }],
    cleanStream(onStream),
    1024
  );

  const { text, progress } = parseCoachResponse(coachMsg);

  if (progress != null) {
    lessonKB.progress = progress;
    await saveLessonKB(lessonId, lessonKB);
  }

  const messages = [
    { role: 'assistant', content: text, msgType: MSG_TYPES.GUIDE, phase: LESSON_PHASES.LEARNING, timestamp: ts() },
  ];

  await saveLessonMessages(lessonId, messages);
  syncInBackground(`lessonKB:${lessonId}`, `messages:${lessonId}`);
  return { messages, lessonKB, phase: LESSON_PHASES.LEARNING };
}

/**
 * Send a message in the lesson conversation.
 *
 * @param {string} lessonId
 * @param {object} lesson
 * @param {string} text
 * @param {string|string[]|null} imageDataUrl - single data URL, array of data URLs, or null
 * @param {Function} onStream
 */
export async function sendMessage(lessonId, lesson, text, imageDataUrl, onStream) {
  assertNotImpersonating('send a message');
  let lessonKB = await getLessonKB(lessonId);
  const profileSummary = await getLearnerProfileSummary();

  // Normalise to array for uniform handling; filter nullish entries
  const imageDataUrls = Array.isArray(imageDataUrl)
    ? imageDataUrl.filter(Boolean)
    : imageDataUrl ? [imageDataUrl] : [];

  // Validate each image against the Bedrock size limit
  for (const url of imageDataUrls) {
    assertImageWithinBedrockLimit(url);
  }

  // Save images if provided
  const imageKeys = [];
  for (const url of imageDataUrls) {
    const key = `lesson-${lessonId}-${ts()}`;
    await saveScreenshot(key, url);
    imageKeys.push(key);
  }

  // Build conversation tail — filter out messages with empty content (e.g. image-only)
  const allMsgs = await getLessonMessages(lessonId);
  const tail = allMsgs.slice(-15)
    .map(m => ({ role: m.role, content: m.content }))
    .filter(m => m.content && (typeof m.content === 'string' ? m.content.trim() : m.content.length));

  // Build user message content
  const userParts = [];
  if (text) userParts.push({ type: 'text', text });
  for (const url of imageDataUrls) {
    const match = url.match(/^data:(image\/\w+);base64,(.+)$/);
    if (match) {
      userParts.push({ type: 'image', source: { type: 'base64', media_type: match[1], data: match[2] } });
    }
  }

  // Always include context as first message so coach has lesson + profile info
  const prefs = await getPreferences();
  const contextMsg = buildContext(lesson, lessonKB, profileSummary, prefs.name);
  const messages = [{ role: 'user', content: contextMsg }, { role: 'assistant', content: 'Ready.' }, ...tail];
  messages.push({ role: 'user', content: userParts.length === 1 && imageDataUrls.length === 0 ? text : userParts });

  const coachMsg = await orchestrator.converseStream(
    'coach',
    messages,
    cleanStream(onStream),
    1024
  );

  const { text: coachText, progress, kbUpdate, profileUpdate } = parseCoachResponse(coachMsg);

  // Save user message (store first imageKey for backward compat display; extras are also persisted via saveScreenshot)
  const userMsg = {
    role: 'user',
    content: text,
    imageKey: imageKeys[0] || null,
    imageKeys: imageKeys.length > 0 ? imageKeys : undefined,
    msgType: MSG_TYPES.USER,
    phase: lessonKB.status === 'completed' ? LESSON_PHASES.COMPLETED : LESSON_PHASES.LEARNING,
    timestamp: ts(),
  };

  return applyCoachResponseToKB(lessonId, lessonKB, coachText, progress, kbUpdate, profileUpdate, userMsg, profileSummary);
}

/**
 * Apply a coach response to the lesson KB and messages.
 * Pure-ish helper — all side effects are explicit (saveLessonKB, saveLessonMessages, sync).
 * This is the single owner of the completion invariant:
 *   progress >= 10  →  lesson is completed, side effects fire once.
 */
export async function applyCoachResponseToKB(
  lessonId, lessonKB, coachText, progress, kbUpdate, profileUpdate, userMsg, profileSummary
) {
  const wasCompleted = lessonKB.status === 'completed';

  // -- KB update --
  if (kbUpdate && !wasCompleted) {
    Object.assign(lessonKB, kbUpdate);
  }
  if (progress != null && !wasCompleted) {
    lessonKB.progress = progress;
  }

  // -- Completion check (only fires once) --
  let achieved = false;
  if (!wasCompleted && lessonKB.progress >= 10) {
    lessonKB.status = 'completed';
    lessonKB.completedAt = ts();
    achieved = true;
  }

  // -- Count learning exchanges (post-completion chatter excluded) --
  if (!wasCompleted) {
    lessonKB.activitiesCompleted = (lessonKB.activitiesCompleted || 0) + 1;
  }

  await saveLessonKB(lessonId, lessonKB);

  const phase = lessonKB.status === 'completed' ? LESSON_PHASES.COMPLETED : LESSON_PHASES.LEARNING;

  const coachMsg = {
    role: 'assistant',
    content: coachText,
    msgType: MSG_TYPES.GUIDE,
    phase,
    timestamp: ts(),
  };

  const newMsgs = userMsg ? [userMsg, coachMsg] : [coachMsg];
  const allMsgs = await getLessonMessages(lessonId);
  await saveLessonMessages(lessonId, [...allMsgs, ...newMsgs]);
  syncInBackground(`lessonKB:${lessonId}`, `messages:${lessonId}`);

  if (achieved) {
    updateProfileOnCompletionInBackground(lessonId, lessonKB);
  } else if (profileUpdate) {
    updateProfileFromObservation(profileUpdate, lessonId);
  }

  return { messages: [...allMsgs, ...newMsgs], lessonKB, phase, achieved };
}

// -- Context assembly ---------------------------------------------------------

/**
 * Build the context JSON string passed as the first user message to the coach.
 * Includes lesson metadata, KB state, learner profile, and pacing directive.
 */
export function buildContext(lesson, lessonKB, profileSummary, learnerName) {
  const exchanges = lessonKB.activitiesCompleted || 0;
  const isCompleted = lessonKB.status === 'completed';

  let pacingDirective = null;
  let postCompletionDirective = null;

  if (isCompleted) {
    postCompletionDirective =
      'This lesson is COMPLETED. You are now in feedback-only mode. ' +
      'Do NOT coach, assess, introduce new material, or award progress for any lesson. ' +
      'Respond only to direct questions about this lesson or general encouragement.';
  } else if (exchanges >= 20) {
    pacingDirective =
      'CRITICAL: This lesson has run very long. You MUST guide the learner to demonstrate ' +
      'the exemplar in the next 1-2 exchanges. Be extremely direct and specific about exactly ' +
      'what response would achieve mastery.';
  } else if (exchanges >= 15) {
    pacingDirective =
      'URGENT: Lesson is running long. Provide a very direct, specific prompt that leads ' +
      'the learner to the exemplar response immediately. Eliminate all scaffolding detours.';
  } else if (exchanges >= 11) {
    pacingDirective =
      'This lesson has exceeded the target length. Tighten your coaching — give concrete, ' +
      'specific guidance that moves the learner toward the exemplar without delay.';
  } else if (exchanges >= 8) {
    pacingDirective =
      'Approaching the target length. Focus on closing gaps — move toward the exemplar response.';
  }

  const context = {
    lessonId: lesson.lessonId,
    lessonName: lesson.name,
    lessonDescription: lesson.description,
    exemplar: lesson.exemplar,
    learningObjectives: lesson.learningObjectives,
    course: lesson.course ? { name: lesson.course.name } : null,
    lessonKB,
    learnerProfile: profileSummary || 'New learner, no profile yet.',
    learnerName: learnerName || null,
    exchangeCount: exchanges,
    ...(pacingDirective ? { pacingDirective } : {}),
    ...(postCompletionDirective ? { postCompletionDirective } : {}),
  };

  return JSON.stringify(context);
}
