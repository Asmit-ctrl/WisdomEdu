import {
  AIGenerationLog,
  AttemptFeatureSnapshot,
  Classroom,
  Concept,
  ContentItem,
  InsightSnapshot,
  Question,
  QuestionTemplate,
  QuestionVariant,
  School,
  Skill,
  SkillPrerequisite,
  StudentConceptMastery,
  StudentConceptState,
  StudentLearningPath,
  StudentSkillMastery,
  StudentTaskPlan,
  Submission,
  TaskAssignment,
  User
} from "./models.js";
import { generateInsightNarrative, generateVariantSupport, hasOpenAIEnhancements } from "./aiService.js";
import { loadClass10ChapterLibrary } from "./chapterLibrary.js";
import { RULES, computeRiskLevel } from "./rules.js";

const CHAPTER_MASTERY_TARGET = 0.8;
const STUCK_CYCLE_THRESHOLD = 3;
const DEFAULT_SCHOOL_TIMEZONE = "Asia/Kolkata";
const schoolTimezoneCache = new Map();

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function extractNumericGrade(value) {
  const raw = String(value ?? "").trim();
  if (!raw) {
    return "";
  }

  const match = raw.match(/\d+/);
  return match ? match[0] : raw;
}

function normalizeAnswer(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/degrees?/g, "deg")
    .replace(/°/g, "deg");
}

function parseFractionLike(value) {
  const normalized = normalizeAnswer(value).replace(/ /g, "");
  if (!/^-?\d+\/-?\d+$/.test(normalized)) {
    return null;
  }

  const [left, right] = normalized.split("/").map(Number);
  if (!Number.isFinite(left) || !Number.isFinite(right) || right === 0) {
    return null;
  }

  return left / right;
}

function answersEquivalent(submittedAnswer, correctAnswer) {
  const left = normalizeAnswer(submittedAnswer);
  const right = normalizeAnswer(correctAnswer);

  if (left === right) {
    return true;
  }

  const leftNumeric = Number(left);
  const rightNumeric = Number(right);
  if (!Number.isNaN(leftNumeric) && !Number.isNaN(rightNumeric)) {
    return Math.abs(leftNumeric - rightNumeric) < 0.0001;
  }

  const leftFraction = parseFractionLike(left);
  const rightFraction = parseFractionLike(right);
  if (leftFraction !== null && rightFraction !== null) {
    return Math.abs(leftFraction - rightFraction) < 0.0001;
  }

  const trueAliases = new Set(["true", "t", "yes", "correct"]);
  const falseAliases = new Set(["false", "f", "no", "incorrect"]);
  if ((trueAliases.has(left) && trueAliases.has(right)) || (falseAliases.has(left) && falseAliases.has(right))) {
    return true;
  }

  return false;
}

function hashText(text) {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function replaceNumbers(text, offset) {
  return String(text).replace(/-?\d+(\.\d+)?/g, (match) => {
    const numeric = Number(match);
    if (Number.isNaN(numeric)) {
      return match;
    }

    return String(numeric + offset);
  });
}

function rotateOptions(options, seed) {
  if (!Array.isArray(options) || options.length < 2) {
    return options ?? [];
  }

  const offset = seed % options.length;
  return [...options.slice(offset), ...options.slice(0, offset)];
}

function computeConfidenceBand({ accuracy, hintRatio }) {
  if (accuracy >= 0.8 && hintRatio <= 0.2) return "high";
  if (accuracy >= 0.45) return "medium";
  return "low";
}

function computePaceBand({ responseRatio }) {
  if (responseRatio <= 0.75) return "fast";
  if (responseRatio >= 1.15) return "slow";
  return "on_track";
}

function toDateOnly(value = new Date()) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  return parsed.toISOString().slice(0, 10);
}

function toDateOnlyInTimezone(value = new Date(), timeZone = DEFAULT_SCHOOL_TIMEZONE) {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = formatter.formatToParts(parsed);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

async function getSchoolTimezone(schoolId) {
  const cacheKey = String(schoolId ?? "");
  if (cacheKey && schoolTimezoneCache.has(cacheKey)) {
    return schoolTimezoneCache.get(cacheKey);
  }

  const school = schoolId ? await School.findById(schoolId).select("timezone").lean() : null;
  const timezone = school?.timezone || DEFAULT_SCHOOL_TIMEZONE;
  if (cacheKey) {
    schoolTimezoneCache.set(cacheKey, timezone);
  }
  return timezone;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function diffDaysFromToday(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  const today = new Date(`${toDateOnly()}T00:00:00.000Z`);
  const target = new Date(`${toDateOnly(parsed)}T00:00:00.000Z`);
  return Math.floor((today.getTime() - target.getTime()) / 86400000);
}

function diffDaysFromDate(value, referenceDate) {
  if (!value || !referenceDate) {
    return null;
  }

  const target = new Date(`${String(value).slice(0, 10)}T00:00:00.000Z`);
  const reference = new Date(`${String(referenceDate).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(target.getTime()) || Number.isNaN(reference.getTime())) {
    return null;
  }

  return Math.floor((reference.getTime() - target.getTime()) / 86400000);
}

function buildDailyMasteryMilestone({ currentMastery, paceBand, targetMastery = CHAPTER_MASTERY_TARGET }) {
  const currentPercent = Math.round(clamp(currentMastery, 0, 1) * 100);
  const targetPercent = Math.round(clamp(targetMastery, 0, 1) * 100);
  const increment = paceBand === "fast" ? 12 : paceBand === "slow" ? 8 : 10;

  return {
    start: currentPercent,
    goal: Math.min(targetPercent, currentPercent + increment)
  };
}

function ensureDailyMilestone({ path, currentMastery, paceBand, schoolDate, targetMastery = CHAPTER_MASTERY_TARGET, preserveReached = true }) {
  const sameSchoolDay = path.dailyTargetDate === schoolDate;
  const currentPercent = Math.round(clamp(currentMastery, 0, 1) * 100);
  const needsFreshMilestone =
    !sameSchoolDay ||
    !Number.isFinite(Number(path.dailyMasteryGoal)) ||
    Number(path.dailyMasteryGoal) < Number(path.dailyMasteryStart);

  if (needsFreshMilestone) {
    const milestone = buildDailyMasteryMilestone({
      currentMastery,
      paceBand,
      targetMastery
    });
    path.dailyMasteryStart = milestone.start;
    path.dailyMasteryGoal = milestone.goal;
    path.dailyTargetDate = schoolDate;
    path.dailyTargetStatus = milestone.goal <= milestone.start ? "reached" : "in_progress";
    path.dailyGoalReachedAt = path.dailyTargetStatus === "reached" ? new Date() : undefined;
    return;
  }

  if (!preserveReached && currentPercent < Number(path.dailyMasteryGoal ?? 0)) {
    path.dailyTargetStatus = "in_progress";
    path.dailyGoalReachedAt = undefined;
  }
}

function hasReachedDailyMilestone(path, masteryPercent, schoolDate) {
  if (!path || path.dailyTargetDate !== schoolDate) {
    return false;
  }

  const targetGoal = Number(path.dailyMasteryGoal ?? 0);
  return path.dailyTargetStatus === "reached" || (targetGoal > 0 && masteryPercent >= targetGoal);
}

function deriveStudentRiskProfile({
  status,
  currentMastery,
  currentCycleIndex,
  latestAssignmentDate,
  lastPracticedAt,
  dailyTargetDate,
  dailyMasteryGoal,
  dailyTargetStatus,
  paceBand,
  todayDate = toDateOnly()
}) {
  const masteryPercent = Number(currentMastery ?? 0);
  const assignedDaysAgo = diffDaysFromDate(latestAssignmentDate || dailyTargetDate, todayDate);
  const practicedDaysAgo = diffDaysFromDate(lastPracticedAt, todayDate);
  const effectiveIdleDays = practicedDaysAgo ?? assignedDaysAgo;
  const targetGoal = Number(dailyMasteryGoal ?? 0);
  const targetReached = dailyTargetStatus === "reached" || (targetGoal > 0 && masteryPercent >= targetGoal);
  const newlyAssigned = (assignedDaysAgo === null || assignedDaysAgo <= 1) && (currentCycleIndex ?? 0) <= 1;

  if (status === "completed" || status === "ready_to_unlock") {
    return { level: "low", label: "Low", reason: "Chapter target is already secure." };
  }

  if (status === "stuck") {
    return { level: "high", label: "High", reason: "The learner has repeated the same chapter cycle multiple times without reaching mastery." };
  }

  if (status === "not_started") {
    return { level: "low", label: "Low", reason: "The learner has not entered the daily chapter cycle yet." };
  }

  if (newlyAssigned && !targetReached) {
    return { level: "low", label: "Low", reason: "The learner is still within the grace window for today's mastery goal." };
  }

  if ((effectiveIdleDays ?? -1) >= 3 && !targetReached) {
    return { level: "high", label: "High", reason: "No meaningful progress has been recorded for several days after assignment." };
  }

  if (((effectiveIdleDays ?? -1) >= 2 || (assignedDaysAgo ?? -1) >= 2) && !targetReached) {
    return { level: "medium", label: "Medium", reason: "The learner is behind the dated mastery target and needs monitoring." };
  }

  if (paceBand === "slow" && masteryPercent < Math.max(targetGoal - 5, 35) && !targetReached) {
    return { level: "medium", label: "Medium", reason: "Progress is slower than expected for the current daily milestone." };
  }

  return { level: "low", label: "Low", reason: "Progress is on track for the current chapter milestone." };
}

function summarizeRationale({ conceptName, mastery, paceBand, targetDifficulty }) {
  return [
    `${conceptName} is currently below the mastery threshold at ${Math.round(mastery * 100)}%.`,
    `Pace is ${paceBand.replace("_", " ")}, so the task starts at difficulty ${targetDifficulty}.`,
    "The pack mixes similar questions and a checkpoint before moving to the next concept."
  ];
}

function buildRationaleTags({ paceBand, confidenceBand, fallbackToPrerequisite, mastery, targetDifficulty }) {
  const tags = ["weak concept"];
  if (paceBand === "slow") tags.push("pace slow");
  if (paceBand === "fast" && mastery >= RULES.risk.medium) tags.push("fast mastery");
  if (confidenceBand === "low") tags.push("low confidence");
  if (targetDifficulty >= 4) tags.push("challenge raised");
  if (fallbackToPrerequisite) tags.push("prerequisite fallback");
  return tags;
}

function computeDifficultyChange({ previousDifficulty, targetDifficulty, paceBand, accuracy, hintRatio }) {
  if (targetDifficulty > previousDifficulty || (accuracy >= 0.8 && paceBand === "fast")) {
    return "up";
  }
  if (targetDifficulty < previousDifficulty || accuracy < 0.5 || hintRatio >= 0.5) {
    return "down";
  }
  return "stay";
}

function serializeVariant(variant, order, stage) {
  return {
    id: variant._id,
    prompt: variant.prompt,
    questionType: variant.questionType,
    options: variant.options ?? [],
    explanation: variant.explanation,
    difficultyLevel: variant.difficultyLevel,
    expectedTimeSec: variant.expectedTimeSec ?? 60,
    stage,
    order
  };
}

export async function ensureQuestionTemplateCatalog() {
  const library = await loadClass10ChapterLibrary();
  const chapters = library.chapters ?? [];

  await Skill.bulkWrite(
    chapters.map((chapter) => ({
      updateOne: {
        filter: { skillId: chapter.skillId },
        update: {
          $setOnInsert: {
            schoolId: null,
            skillId: chapter.skillId,
            name: chapter.skillName,
            gradeLevel: library.gradeLevel,
            standard: chapter.standard,
            description: chapter.description
          }
        },
        upsert: true
      }
    }))
  );

  await Concept.bulkWrite(
    chapters.map((chapter) => ({
      updateOne: {
        filter: { code: chapter.code },
        update: {
          $setOnInsert: {
            subject: library.subject,
            gradeLevel: library.gradeLevel,
            code: chapter.code,
            name: chapter.name,
            description: chapter.description
          }
        },
        upsert: true
      }
    }))
  );

  const concepts = await Concept.find({ code: { $in: chapters.map((chapter) => chapter.code) } }).lean();
  const conceptByCode = new Map(concepts.map((concept) => [concept.code, concept]));

  const operations = [];

  for (const chapter of chapters) {
    if (!conceptByCode.has(chapter.code)) {
      continue;
    }

    for (const [index, question] of (chapter.questions ?? []).entries()) {
      const templateKey = `${chapter.code}:${index + 1}`;
      operations.push({
        updateOne: {
          filter: { templateKey },
          update: {
            $set: {
              source: "class10-json",
              chapterNumber: chapter.chapterNumber,
              code: chapter.code,
              chapterName: chapter.name,
              standard: chapter.standard,
              skillId: chapter.skillId,
              gradeLevel: library.gradeLevel,
              topic: question.topic || chapter.name,
              questionIndex: index + 1,
              prompt: question.prompt,
              questionType: question.questionType,
              options: question.options ?? [],
              correctAnswer: String(question.correctAnswer),
              explanation: question.explanation,
              difficultyLevel: question.difficultyLevel,
              expectedTimeSec: question.expectedTimeSec ?? 60,
              hintWeight: question.hintWeight ?? 1,
              lessonSummary: chapter.lessonSummary,
              practiceFocus: chapter.practiceFocus,
              checkpointGoal: chapter.checkpointGoal,
              retrievalText: [
                chapter.name,
                chapter.description,
                question.topic,
                question.prompt,
                question.explanation
              ]
                .filter(Boolean)
                .join(" "),
              active: true
            }
          },
          upsert: true
        }
      });
    }
  }

  if (operations.length > 0) {
    await QuestionTemplate.bulkWrite(operations);
  }
}

async function getChapterCatalog() {
  const library = await loadClass10ChapterLibrary();
  const orderedChapters = [...(library.chapters ?? [])].sort((left, right) => left.chapterNumber - right.chapterNumber);
  const concepts = await Concept.find({ code: { $in: orderedChapters.map((chapter) => chapter.code) } }).lean();
  const conceptByCode = new Map(concepts.map((concept) => [concept.code, concept]));

  return orderedChapters
    .map((chapter) => ({
      ...chapter,
      concept: conceptByCode.get(chapter.code) ?? null
    }))
    .filter((chapter) => chapter.concept);
}

function buildChapterLadder({ chapters, path, masteryByCode, stateByCode }) {
  const completedSet = new Set(path?.completedChapterCodes ?? []);
  const currentCode = path?.currentChapterCode ?? "";
  const currentChapterNumber = path?.currentChapterNumber ?? 1;

  return chapters.map((chapter) => {
    const mastery = masteryByCode.get(chapter.code) ?? 0;
    const state = stateByCode.get(chapter.code) ?? null;
    const completed = completedSet.has(chapter.code);
    const current = currentCode ? currentCode === chapter.code : chapter.chapterNumber === currentChapterNumber;
    const locked = !completed && !current && chapter.chapterNumber > currentChapterNumber;

    return {
      chapterNumber: chapter.chapterNumber,
      code: chapter.code,
      name: chapter.name,
      mastery: Math.round(mastery * 100),
      completed,
      current,
      locked,
      checkpointPassed: Boolean(state?.checkpointPassed)
    };
  });
}

async function getOrCreateLearningPath({ schoolId, classroomId, studentId, teacherId = null, activate = false }) {
  const chapters = await getChapterCatalog();
  const firstChapter = chapters[0] ?? null;
  if (!firstChapter?.concept) {
    return null;
  }

  let path = await StudentLearningPath.findOne({ schoolId, studentId });
  if (!path) {
    path = await StudentLearningPath.create({
      schoolId,
      studentId,
      classroomId,
      status: activate ? "active" : "not_started",
      currentChapterNumber: firstChapter.chapterNumber,
      currentConceptId: firstChapter.concept._id,
      currentChapterCode: firstChapter.code,
      activatedByTeacherId: activate ? teacherId || undefined : undefined,
      activatedAt: activate ? new Date() : undefined,
      completedChapterCodes: [],
      currentCycleIndex: 0,
      dailyTargetStatus: "in_progress"
    });
  } else {
    let updated = false;
    if (String(path.classroomId) !== String(classroomId)) {
      path.classroomId = classroomId;
      updated = true;
    }
    if (!path.currentChapterCode) {
      path.currentChapterNumber = firstChapter.chapterNumber;
      path.currentConceptId = firstChapter.concept._id;
      path.currentChapterCode = firstChapter.code;
      updated = true;
    }
    if (activate && path.status !== "completed" && path.status !== "active") {
      path.status = "active";
      path.activatedByTeacherId = teacherId || path.activatedByTeacherId;
      path.activatedAt = path.activatedAt || new Date();
      updated = true;
    }
    if (updated) {
      await path.save();
    }
  }

  return path;
}

async function getPathChapterContext({ path }) {
  const chapters = await getChapterCatalog();
  const currentChapter =
    chapters.find((chapter) => chapter.code === path?.currentChapterCode) ??
    chapters.find((chapter) => chapter.chapterNumber === path?.currentChapterNumber) ??
    chapters[0] ??
    null;

  return { chapters, currentChapter };
}

function derivePathStatus({ path, currentMastery, currentState, latestAssignmentDate, lastPracticedAt }) {
  if (!path) return "not_started";
  if (path.status === "completed") return "completed";
  const assignedDaysAgo = diffDaysFromToday(latestAssignmentDate);
  const practicedDaysAgo = diffDaysFromToday(lastPracticedAt);
  const sustainedStall = (assignedDaysAgo ?? practicedDaysAgo ?? -1) >= 2 || (practicedDaysAgo ?? -1) >= 2;
  if (
    (path.currentCycleIndex ?? 0) >= STUCK_CYCLE_THRESHOLD &&
    currentMastery < CHAPTER_MASTERY_TARGET &&
    ((currentState?.consecutiveWrong ?? 0) >= 3 || sustainedStall)
  ) {
    return "stuck";
  }
  if (currentState?.checkpointPassed && currentMastery >= CHAPTER_MASTERY_TARGET) return "ready_to_unlock";
  if (
    path.status === "active" ||
    currentMastery > 0 ||
    Boolean(currentState) ||
    (path.currentCycleIndex ?? 0) > 0 ||
    (path.completedChapterCodes?.length ?? 0) > 0
  ) {
    return "working";
  }
  return path.status ?? "not_started";
}

async function getStudentRecentUsage(studentId) {
  const recentPlans = await StudentTaskPlan.find({ studentId })
    .sort({ createdAt: -1 })
    .limit(6)
    .populate("practiceItems.variantId")
    .lean();

  const seenTemplateIds = new Set();
  const seenQuestionIds = new Set();

  for (const plan of recentPlans) {
    for (const item of plan.practiceItems ?? []) {
      const variant = item.variantId;
      if (!variant) continue;
      if (variant.templateQuestionId) seenTemplateIds.add(String(variant.templateQuestionId));
      if (variant.sourceQuestionId) seenQuestionIds.add(String(variant.sourceQuestionId));
    }
  }

  return { seenTemplateIds, seenQuestionIds };
}

async function getStudentRecentChapterTopics({ studentId, conceptCode }) {
  const recentPlans = await StudentTaskPlan.find({ studentId, conceptCode })
    .sort({ createdAt: -1 })
    .limit(4)
    .select("coveredTopics")
    .lean();

  return new Set(
    recentPlans.flatMap((plan) => plan.coveredTopics ?? []).filter(Boolean)
  );
}

function selectCandidatesForBatch({ rankedCandidates, practiceCount, recentTopics }) {
  const groupedByTopic = rankedCandidates.reduce((map, item) => {
    const topic = String(item.topic ?? item.chapterName ?? item.code ?? "General").trim();
    if (!map.has(topic)) {
      map.set(topic, []);
    }
    map.get(topic).push(item);
    return map;
  }, new Map());

  const topicQueue = [...groupedByTopic.keys()].sort((left, right) => {
    const leftSeen = recentTopics.has(left) ? 1 : 0;
    const rightSeen = recentTopics.has(right) ? 1 : 0;
    if (leftSeen !== rightSeen) {
      return leftSeen - rightSeen;
    }
    return left.localeCompare(right);
  });

  const selected = [];
  while (selected.length < practiceCount + 1 && topicQueue.length > 0) {
    let selectedInRound = 0;
    for (const topic of topicQueue) {
      const pool = groupedByTopic.get(topic) ?? [];
      if (pool.length === 0) {
        continue;
      }
      selected.push(pool.shift());
      selectedInRound += 1;
      if (selected.length >= practiceCount + 1) {
        break;
      }
    }

    if (selectedInRound === 0) {
      break;
    }
  }

  if (selected.length < practiceCount + 1) {
    const seenKeys = new Set(selected.map((item) => String(item._id)));
    rankedCandidates.forEach((candidate) => {
      if (selected.length >= practiceCount + 1 || seenKeys.has(String(candidate._id))) {
        return;
      }
      seenKeys.add(String(candidate._id));
      selected.push(candidate);
    });
  }

  return selected;
}

async function ensureConceptState({ schoolId, classroomId, studentId, conceptId, masteryScore }) {
  let state = await StudentConceptState.findOne({ schoolId, classroomId, studentId, conceptId });
  if (!state) {
    state = await StudentConceptState.create({
      schoolId,
      classroomId,
      studentId,
      conceptId,
      masteryScore
    });
  }

  return state;
}

async function getConceptQueue({ schoolId, classroomId, studentId, gradeLevel }) {
  const masteries = await StudentConceptMastery.find({ schoolId, classroomId, studentId })
    .populate("conceptId")
    .lean();

  const queue = masteries
    .filter((item) => item?.conceptId)
    .sort((left, right) => left.currentMastery - right.currentMastery)
    .slice(0, 4)
    .map((item) => ({
      concept: item.conceptId,
      mastery: item.currentMastery,
      riskLevel: item.riskLevel
    }));

  if (queue.length > 0) {
    return queue;
  }

  const fallbackConcept = await Concept.findOne({ gradeLevel: String(gradeLevel || "10") }).sort({ code: 1 }).lean();
  return fallbackConcept
    ? [
        {
          concept: fallbackConcept,
          mastery: 0.75,
          riskLevel: "low"
        }
      ]
    : [];
}

async function selectFocusConcept({ schoolId, classroomId, studentId, gradeLevel }) {
  const queue = await getConceptQueue({ schoolId, classroomId, studentId, gradeLevel });
  return queue[0]
    ? {
        concept: queue[0].concept,
        mastery: queue[0].mastery,
        riskLevel: queue[0].riskLevel
      }
    : { concept: null, mastery: 0.75, riskLevel: "low" };
}

async function maybeFallbackToPrerequisite({ schoolId, focusConcept, conceptState, derivedSkillId }) {
  if (!conceptState || conceptState.consecutiveWrong < 2 || !derivedSkillId) {
    return { focusConcept, fallbackToPrerequisite: false, prerequisiteSkillId: "" };
  }

  const prerequisite = await SkillPrerequisite.findOne({ skillId: derivedSkillId }).lean();
  if (!prerequisite?.prerequisiteSkillId) {
    return { focusConcept, fallbackToPrerequisite: false, prerequisiteSkillId: "" };
  }

  const prerequisiteTemplate = await QuestionTemplate.findOne({ skillId: prerequisite.prerequisiteSkillId }).lean();
  if (!prerequisiteTemplate?.code) {
    return { focusConcept, fallbackToPrerequisite: false, prerequisiteSkillId: "" };
  }

  const prerequisiteConcept = await Concept.findOne({ code: prerequisiteTemplate.code }).lean();
  if (!prerequisiteConcept) {
    return { focusConcept, fallbackToPrerequisite: false, prerequisiteSkillId: "" };
  }

  return {
    focusConcept: {
      concept: prerequisiteConcept,
      mastery: Math.min(focusConcept.mastery, 0.4),
      riskLevel: "high"
    },
    fallbackToPrerequisite: true,
    prerequisiteSkillId: prerequisite.prerequisiteSkillId
  };
}

function chooseTargetDifficulty({ mastery, paceBand }) {
  let target = mastery < 0.4 ? 1 : mastery < 0.7 ? 2 : 3;
  if (paceBand === "fast") target += 1;
  if (paceBand === "slow") target -= 1;
  return clamp(target, 1, 5);
}

function buildVariantPayload({ baseItem, studentId, index, conceptId, skillId, gradeLevel, chapterCode, schoolId, sourceKind }) {
  const seed = hashText(`${studentId}:${baseItem.prompt}:${index}`);
  const offset = (seed % 4) + 1;
  const hasNumbers = /\d/.test(baseItem.prompt) || /\d/.test(baseItem.correctAnswer);
  const promptPrefix = sourceKind === "template" ? "Practice variant:" : "Teacher-approved variant:";

  const prompt = hasNumbers
    ? replaceNumbers(baseItem.prompt, offset)
    : `${promptPrefix} ${baseItem.prompt}`;
  const options = hasNumbers
    ? rotateOptions((baseItem.options ?? []).map((option) => replaceNumbers(option, offset)), seed)
    : rotateOptions(baseItem.options ?? [], seed);
  const correctAnswer = hasNumbers ? replaceNumbers(baseItem.correctAnswer, offset) : baseItem.correctAnswer;
  const explanation = hasNumbers ? replaceNumbers(baseItem.explanation, offset) : baseItem.explanation;
  const noveltyHash = `${chapterCode}:${hashText(`${prompt}:${correctAnswer}:${studentId}`)}`;
  const allowedAnswerPatterns = [String(correctAnswer).trim()];

  return {
    schoolId,
    templateQuestionId: sourceKind === "template" ? baseItem._id : null,
    sourceQuestionId: sourceKind === "teacher" ? baseItem._id : null,
    conceptId,
    skillId,
    chapterCode,
    gradeLevel,
    topic: baseItem.topic ?? "",
    prompt,
    questionType: baseItem.questionType,
    options,
    correctAnswer,
    explanation,
    difficultyLevel: baseItem.difficultyLevel,
    expectedTimeSec: baseItem.expectedTimeSec ?? 60,
    hintWeight: baseItem.hintWeight ?? 1,
    generationMethod: hasNumbers ? "deterministic_variant" : sourceKind === "teacher" ? "teacher_copy" : "template_copy",
    variantType: hasNumbers ? "value_shift" : "surface_shift",
    parameterSignature: `seed:${seed};offset:${offset}`,
    noveltyHash,
    allowedAnswerPatterns
  };
}

async function getRankedCandidates({ schoolId, conceptId, gradeLevel, targetDifficulty, studentId }) {
  const { seenTemplateIds, seenQuestionIds } = await getStudentRecentUsage(studentId);
  const resolvedGradeLevel = extractNumericGrade(gradeLevel) || "10";
  const conceptCode = conceptId?.code ?? "";

  const [exactTemplates, gradeTemplates, exactTeacherQuestions, gradeTeacherQuestions] = await Promise.all([
    QuestionTemplate.find({ code: conceptCode, active: true }).lean(),
    QuestionTemplate.find({ gradeLevel: resolvedGradeLevel, active: true }).lean(),
    Question.find({
      schoolId,
      conceptIds: conceptId._id,
      reviewStatus: "approved",
      approvedForGeneration: true
    }).lean(),
    Question.find({
      schoolId,
      gradeLevel: resolvedGradeLevel,
      reviewStatus: "approved",
      approvedForGeneration: true
    }).lean()
  ]);

  const templateById = new Map();
  for (const template of [...exactTemplates, ...gradeTemplates]) {
    templateById.set(String(template._id), template);
  }

  const teacherById = new Map();
  for (const question of [...exactTeacherQuestions, ...gradeTeacherQuestions]) {
    teacherById.set(String(question._id), question);
  }

  const templates = [...templateById.values()];
  const teacherQuestions = [...teacherById.values()];

  function candidatePriority(item, sourceKind) {
    const conceptMatch =
      sourceKind === "template"
        ? item.code === conceptCode
        : (item.conceptIds ?? []).some((id) => String(id) === String(conceptId._id));
    const gradeMatch = String(item.gradeLevel ?? "") === resolvedGradeLevel;
    const difficultyPenalty = Math.abs((item.difficultyLevel ?? targetDifficulty) - targetDifficulty);
    const questionTypePenalty = item.questionType === "mcq" ? 0.1 : 0;

    return (conceptMatch ? 0 : 10) + (gradeMatch ? 0 : 4) + difficultyPenalty + questionTypePenalty;
  }

  const sortedTemplates = templates
    .sort((left, right) => {
      const score = candidatePriority(left, "template") - candidatePriority(right, "template");
      if (score !== 0) return score;
      return left.questionType.localeCompare(right.questionType);
    })
    .map((item) => ({ ...item, sourceKind: "template" }));

  const sortedTeacherQuestions = teacherQuestions
    .sort((left, right) => {
      const score = candidatePriority(left, "teacher") - candidatePriority(right, "teacher");
      if (score !== 0) return score;
      return left.questionType.localeCompare(right.questionType);
    })
    .map((item) => ({ ...item, sourceKind: "teacher" }));

  const unseenTemplates = sortedTemplates.filter((template) => !seenTemplateIds.has(String(template._id)));
  const unseenTeacherQuestions = sortedTeacherQuestions.filter((question) => !seenQuestionIds.has(String(question._id)));

  if (unseenTemplates.length > 0 || unseenTeacherQuestions.length > 0) {
    return [...unseenTeacherQuestions, ...unseenTemplates];
  }

  return [...sortedTeacherQuestions, ...sortedTemplates];
}

async function resolveStudentGradeLevel({ classroomId, user }) {
  const fromUser = extractNumericGrade(user?.gradeLevel) || extractNumericGrade(user?.classroom);
  if (fromUser) {
    return fromUser;
  }

  if (!classroomId) {
    return "10";
  }

  const classroom = await Classroom.findById(classroomId).select("gradeLevel").lean();
  return extractNumericGrade(classroom?.gradeLevel) || "10";
}

async function getClassroomMasteriesByStudent({ schoolId, classroomIds, studentIds }) {
  const query = { schoolId, studentId: { $in: studentIds } };
  if (classroomIds?.length) {
    query.classroomId = { $in: classroomIds };
  }

  const masteries = await StudentConceptMastery.find(query).populate("conceptId").lean();
  const byStudent = new Map();

  for (const mastery of masteries) {
    const key = String(mastery.studentId);
    const list = byStudent.get(key) ?? [];
    list.push(mastery);
    byStudent.set(key, list);
  }

  return byStudent;
}

function getRankedCandidatesFromMasteryFallback({ masteries, conceptStates }) {
  if (conceptStates.length > 0) {
    return conceptStates.sort((left, right) => left.masteryScore - right.masteryScore).slice(0, 3);
  }

  return masteries
    .map((item) => ({
      conceptId: item.conceptId,
      masteryScore: item.currentMastery,
      paceBand: "on_track",
      confidenceBand: item.currentMastery < RULES.risk.medium ? "low" : "medium",
      prerequisiteFallbackSkillId: ""
    }))
    .sort((left, right) => left.masteryScore - right.masteryScore)
    .slice(0, 3);
}

async function hasConceptCoverage({ schoolId, concept }) {
  if (!concept?._id || !concept?.code) {
    return false;
  }

  const [templateCoverage, teacherCoverage] = await Promise.all([
    QuestionTemplate.exists({ code: concept.code, active: true }),
    Question.exists({
      schoolId,
      conceptIds: concept._id,
      reviewStatus: "approved",
      approvedForGeneration: true
    })
  ]);

  return Boolean(templateCoverage || teacherCoverage);
}

async function resolveFocusConceptWithCoverage({ schoolId, gradeLevel, conceptQueue, currentFocus }) {
  if (await hasConceptCoverage({ schoolId, concept: currentFocus.concept })) {
    return currentFocus;
  }

  for (const queued of conceptQueue) {
    if (!queued?.concept?._id) continue;
    if (String(queued.concept._id) === String(currentFocus?.concept?._id)) continue;
    if (await hasConceptCoverage({ schoolId, concept: queued.concept })) {
      return {
        concept: queued.concept,
        mastery: queued.mastery,
        riskLevel: queued.riskLevel
      };
    }
  }

  const fallbackTemplate = await QuestionTemplate.findOne({
    gradeLevel: extractNumericGrade(gradeLevel) || "10",
    active: true
  })
    .sort({ chapterNumber: 1, questionIndex: 1 })
    .lean();

  if (!fallbackTemplate?.code) {
    return currentFocus;
  }

  const fallbackConcept = await Concept.findOne({ code: fallbackTemplate.code }).lean();
  if (!fallbackConcept) {
    return currentFocus;
  }

  return {
    concept: fallbackConcept,
    mastery: currentFocus?.mastery ?? 0.6,
    riskLevel: currentFocus?.riskLevel ?? computeRiskLevel(currentFocus?.mastery ?? 0.6)
  };
}

async function buildTaskNarrative({ studentName, focusConcept, paceBand, confidenceBand, targetDifficulty, fallbackToPrerequisite, conceptQueue }) {
  const fallbackSummary = `${focusConcept.name} is next for ${studentName}. Difficulty ${targetDifficulty} starts from a ${paceBand.replace("_", " ")} pace and ${confidenceBand} confidence profile.`;
  const aiNarrative = await generateInsightNarrative({
    role: "student",
    structuredContext: {
      studentName,
      focusConcept: focusConcept.name,
      paceBand,
      confidenceBand,
      targetDifficulty,
      fallbackToPrerequisite,
      queue: conceptQueue.map((item) => ({
        code: item.concept.code,
        name: item.concept.name,
        mastery: item.mastery
      }))
    }
  }).catch(() => null);

  return {
    summary: aiNarrative?.summary || fallbackSummary,
    highlights:
      aiNarrative?.highlights ??
      [
        `Focus concept: ${focusConcept.name}`,
        `Pace: ${paceBand.replace("_", " ")}`,
        fallbackToPrerequisite ? "The engine stepped back to a prerequisite skill first." : "The engine stays on the current concept until checkpoint mastery is met."
      ]
  };
}

async function enrichVariantsWithAI({ schoolId, classroomId, studentId, taskPlanId, focusConcept, paceBand, confidenceBand, targetDifficulty, variants, selected }) {
  for (const [index, variant] of variants.entries()) {
    const source = selected[index];
    let auditStatus = "ok";
    let generationPath = variant.generationMethod;
    let notes = "Rules-first variant created.";

    if (hasOpenAIEnhancements()) {
      const aiSupport = await generateVariantSupport({
        template: {
          topic: variant.topic,
          prompt: variant.prompt,
          questionType: variant.questionType,
          options: variant.options,
          correctAnswer: variant.correctAnswer,
          explanation: variant.explanation,
          difficultyLevel: variant.difficultyLevel
        },
        context: {
          concept: focusConcept.name,
          paceBand,
          confidenceBand,
          targetDifficulty
        }
      }).catch(() => null);

      if (aiSupport) {
        variant.aiSupport = {
          hint: aiSupport.hint,
          explanation: aiSupport.explanation,
          rewriteRationale: aiSupport.rewriteRationale
        };
        if (aiSupport.rewritePrompt?.trim()) {
          variant.prompt = aiSupport.rewritePrompt.trim();
          variant.generationMethod = "openai_rewrite";
          generationPath = "openai_rewrite";
        }
        notes = aiSupport.rewriteRationale || "OpenAI-enhanced support text added.";
        await variant.save();
      } else {
        auditStatus = "fallback";
      }
    }

    await AIGenerationLog.create({
      schoolId,
      studentId,
      classroomId,
      taskPlanId,
      templateQuestionId: variant.templateQuestionId,
      questionVariantId: variant._id,
      generationPath,
      model: generationPath === "openai_rewrite" ? "gpt-5-mini" : "",
      retrievalCandidates: selected.map((item) => String(item._id)),
      selectedCandidate: String(source?._id ?? ""),
      auditStatus,
      notes
    });
  }
}

async function findReusableTaskPlan({ schoolId, classroomId, studentId }) {
  return StudentTaskPlan.findOne({
    schoolId,
    classroomId,
    studentId,
    status: "planned"
  })
    .sort({ createdAt: -1 })
    .populate("practiceItems.variantId");
}

async function getOpenTaskAssignments({ schoolId, classroomId, studentId }) {
  const query = {
    schoolId,
    studentId,
    status: { $in: ["assigned", "started"] }
  };

  if (classroomId) {
    query.classroomId = classroomId;
  }

  return TaskAssignment.find(query)
    .sort({ assignedAt: -1 })
    .populate({
      path: "taskPlanId",
      populate: { path: "practiceItems.variantId" }
    });
}

async function normalizeOpenTaskAssignments({ schoolId, classroomId, studentId, keepAssignmentId = null }) {
  const openAssignments = await getOpenTaskAssignments({ schoolId, classroomId, studentId });
  if (openAssignments.length === 0) {
    return null;
  }

  const keepAssignment =
    openAssignments.find((assignment) => String(assignment._id) === String(keepAssignmentId)) ??
    openAssignments[0];

  const supersededAssignments = openAssignments.filter((assignment) => String(assignment._id) !== String(keepAssignment._id));
  if (supersededAssignments.length > 0) {
    const supersededAt = new Date();
    await Promise.all(
      supersededAssignments.map(async (assignment) => {
        assignment.status = "superseded";
        assignment.supersededByAssignmentId = keepAssignment._id;
        assignment.submittedAt = assignment.submittedAt ?? supersededAt;
        assignment.completedAt = assignment.completedAt ?? supersededAt;
        if (assignment.taskPlanId && ["planned", "assigned", "in_progress"].includes(assignment.taskPlanId.status)) {
          assignment.taskPlanId.status = "superseded";
          assignment.taskPlanId.completedAt = assignment.taskPlanId.completedAt ?? supersededAt;
          await assignment.taskPlanId.save();
        }
        await assignment.save();
      })
    );
  }

  return keepAssignment;
}

async function createTaskAssignmentFromPlan({ schoolId, classroomId, teacherId, studentId, pathId, plan, assignedForDate, autoAssigned = false }) {
  plan.status = "assigned";
  await plan.save();

  const assignment = await TaskAssignment.create({
    schoolId,
    classroomId,
    studentId,
    teacherId,
    pathId: pathId ?? plan.pathId ?? null,
    taskPlanId: plan._id,
    chapterNumber: plan.chapterNumber,
    cycleIndex: plan.cycleIndex,
    autoAssigned,
    assignedForDate
  });

  return assignment.populate({
    path: "taskPlanId",
    populate: { path: "practiceItems.variantId" }
  });
}

async function getLatestTaskAssignment({ schoolId, studentId, classroomId = null }) {
  const query = { schoolId, studentId };
  if (classroomId) {
    query.classroomId = classroomId;
  }

  return TaskAssignment.findOne(query)
    .sort({ assignedAt: -1 })
    .populate({
      path: "taskPlanId",
      populate: { path: "practiceItems.variantId" }
    });
}

function serializeStudentTaskFromAssignment(assignment, latestInsight = null) {
  const taskPlan = assignment?.taskPlanId;
  if (!taskPlan) {
    return null;
  }

  return {
    assignmentId: assignment._id,
    assignmentStatus: assignment.status,
    taskPlanId: taskPlan._id,
    pathId: taskPlan.pathId ?? assignment.pathId ?? null,
    assignedForDate: assignment.assignedForDate,
    chapterNumber: taskPlan.chapterNumber,
    cycleIndex: taskPlan.cycleIndex,
    masteryTarget: Math.round((taskPlan.masteryTarget ?? CHAPTER_MASTERY_TARGET) * 100),
    concept: {
      id: taskPlan.conceptId,
      code: taskPlan.conceptCode,
      name: taskPlan.conceptName
    },
    paceBand: taskPlan.paceBand,
    confidenceBand: taskPlan.confidenceBand,
    targetDifficulty: taskPlan.targetDifficulty,
    rationale: taskPlan.rationale ?? [],
    rationaleTags: taskPlan.rationaleTags ?? [],
    narrativeSummary: taskPlan.narrativeSummary || latestInsight?.summary || "",
    coveredTopics: taskPlan.coveredTopics ?? [],
    coverageScore: taskPlan.coverageScore ?? 0,
    lesson: taskPlan.lesson ?? null,
    items: (taskPlan.practiceItems ?? [])
      .sort((left, right) => left.order - right.order)
      .map((item) => ({
        ...serializeVariant(item.variantId, item.order, item.stage),
        hint: item.variantId?.aiSupport?.hint ?? "",
        explanation: item.variantId?.aiSupport?.explanation ?? "",
        generationMethod: item.variantId?.generationMethod ?? "template_copy"
      }))
  };
}

async function createTaskPlan({ schoolId, classroomId, teacherId, studentId, refresh = false, allowAfterMilestone = false }) {
  await ensureQuestionTemplateCatalog();

  if (!refresh) {
    const existingAssignment = await normalizeOpenTaskAssignments({ schoolId, classroomId, studentId });
    if (existingAssignment?.taskPlanId) {
      return existingAssignment.taskPlanId;
    }
  }

  const path = await getOrCreateLearningPath({
    schoolId,
    classroomId,
    studentId,
    teacherId,
    activate: Boolean(teacherId)
  });
  if (!path || path.status === "completed" || path.status === "not_started") {
    return null;
  }

  const user = await User.findById(studentId).lean();
  const gradeLevel = await resolveStudentGradeLevel({ classroomId, user });
  const { chapters, currentChapter } = await getPathChapterContext({ path });
  if (!currentChapter?.concept) {
    return null;
  }

  const focusConcept = currentChapter.concept;
  const focusTemplate = await QuestionTemplate.findOne({ code: focusConcept.code }).sort({ questionIndex: 1 }).lean();
  const masteryRecord = await StudentConceptMastery.findOne({
    schoolId,
    classroomId,
    studentId,
    conceptId: focusConcept._id
  }).lean();
  const conceptState = await ensureConceptState({
    schoolId,
    classroomId,
    studentId,
    conceptId: focusConcept._id,
    masteryScore: masteryRecord?.currentMastery ?? 0
  });
  const currentMastery = masteryRecord?.currentMastery ?? conceptState.masteryScore ?? 0;
  const derivedSkillId = focusTemplate?.skillId ?? null;
  const prerequisite = derivedSkillId ? await SkillPrerequisite.findOne({ skillId: derivedSkillId }).lean() : null;
  const fallbackToPrerequisite =
    Boolean(prerequisite?.prerequisiteSkillId) && (conceptState.consecutiveWrong >= 2 || conceptState.totalRetries >= 4);

  const skillMastery = derivedSkillId
    ? await StudentSkillMastery.findOne({ schoolId, classroomId, studentId, skillId: derivedSkillId }).lean()
    : await StudentSkillMastery.findOne({ schoolId, classroomId, studentId }).lean();
  const recentAttempts = skillMastery?.attempts?.slice(-8) ?? [];
  const responseRatio = recentAttempts.length
    ? recentAttempts.reduce((sum, attempt) => sum + clamp((attempt.responseTimeMs || 0) / 90000, 0.2, 3), 0) / recentAttempts.length
    : conceptState.averageResponseRatio || 1;
  const accuracy = recentAttempts.length
    ? recentAttempts.filter((attempt) => attempt.isCorrect).length / recentAttempts.length
    : currentMastery;
  const hintRatio = recentAttempts.length
    ? recentAttempts.reduce((sum, attempt) => sum + (attempt.hintsUsed || 0), 0) / recentAttempts.length
    : conceptState.totalHintsUsed > 0
      ? conceptState.totalHintsUsed / Math.max(recentAttempts.length, 1)
      : 0;

  const paceBand = computePaceBand({ responseRatio });
  const confidenceBand = computeConfidenceBand({ accuracy, hintRatio });
  const rawTargetDifficulty = chooseTargetDifficulty({ mastery: currentMastery, paceBand });
  const targetDifficulty = fallbackToPrerequisite ? 1 : rawTargetDifficulty;
  const content = await ContentItem.find({ conceptId: focusConcept._id }).sort({ difficultyLevel: 1 }).lean();
  const schoolTimeZone = await getSchoolTimezone(schoolId);
  const schoolDate = toDateOnlyInTimezone(new Date(), schoolTimeZone);
  ensureDailyMilestone({
    path,
    currentMastery,
    paceBand,
    schoolDate,
    targetMastery: CHAPTER_MASTERY_TARGET
  });
  const milestoneReachedToday = hasReachedDailyMilestone(path, Math.round(currentMastery * 100), schoolDate);
  if (milestoneReachedToday && !allowAfterMilestone) {
    await path.save();
    return null;
  }
  const rankedCandidates = await getRankedCandidates({
    schoolId,
    conceptId: focusConcept,
    gradeLevel,
    targetDifficulty,
    studentId
  });

  const practiceCount = fallbackToPrerequisite ? 6 : paceBand === "slow" ? 6 : paceBand === "fast" ? 4 : 5;
  const recentTopics = await getStudentRecentChapterTopics({ studentId, conceptCode: focusConcept.code });
  let selected = selectCandidatesForBatch({ rankedCandidates, practiceCount, recentTopics });
  if (selected.length === 1) {
    selected = [selected[0], selected[0]];
  }
  if (selected.length === 0) {
    return null;
  }

  const nextCycleIndex = Math.max(1, (path.currentCycleIndex ?? 0) + 1);
  path.currentCycleIndex = nextCycleIndex;
  path.lastAutoAssignedAt = new Date();
  if (!milestoneReachedToday) {
    path.dailyTargetStatus = "in_progress";
    path.dailyGoalReachedAt = undefined;
  }
  await path.save();

  const variants = await QuestionVariant.insertMany(
    selected.map((item, index) =>
      buildVariantPayload({
        baseItem: item,
        studentId,
        index,
        conceptId: focusConcept._id,
        skillId: item.skillId ?? derivedSkillId,
        gradeLevel: String(gradeLevel),
        chapterCode: focusConcept.code,
        schoolId,
        sourceKind: item.sourceKind
      })
    )
  );

  conceptState.lastAssignedAt = new Date();
  conceptState.masteryScore = currentMastery;
  conceptState.paceBand = paceBand;
  conceptState.confidenceBand = confidenceBand;
  conceptState.lastDifficultyLevel = targetDifficulty;
  conceptState.prerequisiteFallbackSkillId = fallbackToPrerequisite ? prerequisite?.prerequisiteSkillId ?? "" : "";
  await conceptState.save();

  const chapterQueue = buildChapterLadder({
    chapters,
    path,
    masteryByCode: new Map([[focusConcept.code, currentMastery]]),
    stateByCode: new Map([[focusConcept.code, conceptState]])
  }).map((item) => ({
    conceptId: chapters.find((chapter) => chapter.code === item.code)?.concept?._id ?? focusConcept._id,
    code: item.code,
    name: item.name,
    mastery: item.mastery / 100
  }));

  const rationale = [
    `Chapter ${currentChapter.chapterNumber} stays active until ${Math.round(CHAPTER_MASTERY_TARGET * 100)}% mastery and checkpoint pass.`,
    ...summarizeRationale({
      conceptName: focusConcept.name,
      mastery: currentMastery,
      paceBand,
      targetDifficulty
    })
  ];
  const rationaleTags = [
    `chapter ${currentChapter.chapterNumber}`,
    ...buildRationaleTags({
      paceBand,
      confidenceBand,
      fallbackToPrerequisite,
      mastery: currentMastery,
      targetDifficulty
    })
  ];
  const narrative = await buildTaskNarrative({
    studentName: user?.fullName ?? "Student",
    focusConcept,
    paceBand,
    confidenceBand,
    targetDifficulty,
    fallbackToPrerequisite,
    conceptQueue: chapterQueue.map((item) => ({
      concept: { code: item.code, name: item.name },
      mastery: item.mastery
    }))
  });

  const lesson = content.find((item) => item.type === "lesson");
  const selectedTopics = [...new Set(selected.map((item) => String(item.topic ?? item.chapterName ?? focusConcept.name).trim()).filter(Boolean))];
  const totalChapterTopics = Math.max(
    1,
    new Set(rankedCandidates.map((item) => String(item.topic ?? item.chapterName ?? focusConcept.name).trim()).filter(Boolean)).size
  );
  const taskPlan = await StudentTaskPlan.create({
    schoolId,
    classroomId,
    studentId,
    teacherId: teacherId || path.activatedByTeacherId || undefined,
    pathId: path._id,
    conceptId: focusConcept._id,
    conceptCode: focusConcept.code,
    conceptName: focusConcept.name,
    chapterNumber: currentChapter.chapterNumber,
    cycleIndex: nextCycleIndex,
    autoAssigned: nextCycleIndex > 1,
    masteryTarget: CHAPTER_MASTERY_TARGET,
    unlocksNextChapter: false,
    status: "planned",
    paceBand,
    confidenceBand,
    targetDifficulty,
    rationale,
    rationaleTags,
    narrativeSummary: narrative.summary,
    generatedAt: new Date(),
    coveredTopics: selectedTopics,
    coverageScore: Number((selectedTopics.length / totalChapterTopics).toFixed(3)),
    conceptQueue: chapterQueue,
    lesson: lesson
      ? { title: lesson.title, body: lesson.body }
      : focusTemplate
        ? {
            title: `${focusConcept.name} explainer`,
            body:
              focusTemplate.lessonSummary ||
              focusTemplate.practiceFocus ||
              `${focusConcept.name} remains active until you reach ${Math.round(CHAPTER_MASTERY_TARGET * 100)}% mastery.`
          }
        : null,
    practiceItems: variants.map((variant, index) => ({
      variantId: variant._id,
      order: index + 1,
      stage: index === variants.length - 1 ? "checkpoint" : "practice",
      difficultyLevel: variant.difficultyLevel,
      sourceKind: selected[index]?.sourceKind ?? "template"
    }))
  });

  await enrichVariantsWithAI({
    schoolId,
    classroomId,
    studentId,
    taskPlanId: taskPlan._id,
    focusConcept,
    paceBand,
    confidenceBand,
    targetDifficulty,
    variants,
    selected
  });

  await InsightSnapshot.create({
    schoolId,
    userId: studentId,
    role: "student",
    snapshotType: "task",
    summary: narrative.summary,
    highlights: narrative.highlights,
    signalSummary: {
      weakestConcepts: [focusConcept.name],
      paceProfile: paceBand,
      confidenceProfile: confidenceBand,
      nextBlocker: fallbackToPrerequisite ? "The system is adding scaffolded support before trying the chapter again." : "",
      masteryLiftPercent: 0
    },
    context: {
      classroomId,
      studentId,
      conceptId: focusConcept._id,
      taskPlanId: taskPlan._id
    }
  });

  return taskPlan.populate("practiceItems.variantId");
}

export async function precomputeTeacherTasks({ schoolId, classroomId, teacherId, studentIds, refresh = false }) {
  const plans = [];
  for (const studentId of studentIds) {
    const plan = await createTaskPlan({ schoolId, classroomId, teacherId, studentId, refresh });
    if (plan) {
      plans.push(plan);
    }
  }
  return plans;
}

export async function previewTeacherTaskRecommendations({ schoolId, classroomId, teacherId, studentIds, refresh = false }) {
  return precomputeTeacherTasks({ schoolId, classroomId, teacherId, studentIds, refresh });
}

export async function assignTeacherTasks({ schoolId, classroomId, teacherId, studentIds, assignedForDate }) {
  const assignments = [];
  const schoolTimeZone = await getSchoolTimezone(schoolId);
  const targetDate = assignedForDate || toDateOnlyInTimezone(new Date(), schoolTimeZone);
  for (const studentId of studentIds) {
    const path = await getOrCreateLearningPath({
      schoolId,
      classroomId,
      studentId,
      teacherId,
      activate: true
    });

    const existingAssignment = await normalizeOpenTaskAssignments({ schoolId, classroomId, studentId });
    if (existingAssignment?.taskPlanId) {
      assignments.push({ assignment: existingAssignment, plan: existingAssignment.taskPlanId });
      continue;
    }

    const plan =
      (await findReusableTaskPlan({ schoolId, classroomId, studentId })) ||
      (await createTaskPlan({ schoolId, classroomId, teacherId, studentId, refresh: true, allowAfterMilestone: true }));
    if (!plan) continue;

    const assignment = await createTaskAssignmentFromPlan({
      schoolId,
      classroomId,
      teacherId,
      studentId,
      pathId: path?._id ?? plan.pathId ?? null,
      plan,
      assignedForDate: targetDate,
      autoAssigned: Boolean(plan.autoAssigned)
    });

    assignments.push({ assignment, plan: assignment.taskPlanId });
  }

  return assignments;
}

export async function getStudentTodayTask({ schoolId, studentId }) {
  let assignment = await normalizeOpenTaskAssignments({ schoolId, studentId });
  let leanAssignment = assignment ? assignment.toObject() : null;

  if (!leanAssignment?.taskPlanId) {
    const path = await StudentLearningPath.findOne({ schoolId, studentId });
    if (path?.status === "active") {
      const schoolTimeZone = await getSchoolTimezone(schoolId);
      const schoolDate = toDateOnlyInTimezone(new Date(), schoolTimeZone);
      if (path.dailyTargetStatus === "reached" && path.dailyTargetDate === schoolDate) {
        return null;
      }

      const plan = await createTaskPlan({
        schoolId,
        classroomId: path.classroomId,
        teacherId: path.activatedByTeacherId,
        studentId,
        refresh: true,
        allowAfterMilestone: false
      });

      if (plan) {
        assignment = await createTaskAssignmentFromPlan({
          schoolId,
          classroomId: path.classroomId,
          teacherId: path.activatedByTeacherId,
          studentId,
          pathId: path._id,
          plan,
          assignedForDate: schoolDate,
          autoAssigned: true
        });
        leanAssignment = assignment.toObject();
      }
    }
  }

  if (!leanAssignment?.taskPlanId) {
    return null;
  }

  const latestInsight = await InsightSnapshot.findOne({
      schoolId,
      userId: studentId,
      "context.taskPlanId": leanAssignment.taskPlanId._id
    })
    .sort({ createdAt: -1 })
    .lean();

  return serializeStudentTaskFromAssignment(leanAssignment, latestInsight);
}

export async function continueStudentTask({ schoolId, studentId }) {
  const openAssignment = await normalizeOpenTaskAssignments({ schoolId, studentId });
  if (openAssignment?.taskPlanId) {
    return serializeStudentTaskFromAssignment(openAssignment.toObject());
  }

  const path = await StudentLearningPath.findOne({ schoolId, studentId });
  if (!path || path.status !== "active") {
    throw createHttpError(404, "No active chapter path is available to continue.");
  }

  const schoolTimeZone = await getSchoolTimezone(schoolId);
  const schoolDate = toDateOnlyInTimezone(new Date(), schoolTimeZone);
  const plan = await createTaskPlan({
    schoolId,
    classroomId: path.classroomId,
    teacherId: path.activatedByTeacherId,
    studentId,
    refresh: true,
    allowAfterMilestone: true
  });

  if (!plan) {
    throw createHttpError(409, "No additional practice batch is ready right now.");
  }

  const assignment = await createTaskAssignmentFromPlan({
    schoolId,
    classroomId: path.classroomId,
    teacherId: path.activatedByTeacherId,
    studentId,
    pathId: path._id,
    plan,
    assignedForDate: schoolDate,
    autoAssigned: true
  });

  return serializeStudentTaskFromAssignment(assignment.toObject());
}

function computeTaskAnswerFeatures(scoredAnswers) {
  const accuracy = scoredAnswers.filter((answer) => answer.isCorrect).length / Math.max(scoredAnswers.length, 1);
  const responseRatio =
    scoredAnswers.reduce((sum, answer) => sum + clamp((answer.responseTimeMs || 0) / Math.max(answer.expectedTimeSec * 1000, 1), 0.2, 3), 0) /
    Math.max(scoredAnswers.length, 1);
  const totalHints = scoredAnswers.reduce((sum, answer) => sum + (answer.hintsUsed || 0), 0);
  const totalRetries = scoredAnswers.reduce((sum, answer) => sum + (answer.retries || 0), 0);
  return {
    accuracy,
    responseRatio: Number(responseRatio.toFixed(3)),
    hintRatio: Number((totalHints / Math.max(scoredAnswers.length, 1)).toFixed(3)),
    totalHints,
    totalRetries
  };
}

async function updateTaskLearningState({ schoolId, classroomId, studentId, conceptId, skillId, scoredAnswers, taskPlan, taskAssignmentId, sourceSubmissionId, scorePercent }) {
  const correctRatio = scoredAnswers.filter((answer) => answer.isCorrect).length / Math.max(scoredAnswers.length, 1);
  const mastery = await StudentConceptMastery.findOne({ schoolId, classroomId, studentId, conceptId });
  const nextMastery = mastery
    ? Number(((mastery.currentMastery * mastery.attemptsCount + correctRatio) / (mastery.attemptsCount + 1)).toFixed(3))
    : Number(correctRatio.toFixed(3));
  const checkpointCorrect = scoredAnswers.filter((answer) => answer.stage === "checkpoint" && answer.isCorrect).length > 0;

  if (!mastery) {
    await StudentConceptMastery.create({
      schoolId,
      classroomId,
      studentId,
      conceptId,
      baselineMastery: nextMastery,
      currentMastery: nextMastery,
      riskLevel: computeRiskLevel(nextMastery),
      attemptsCount: 1
    });
  } else {
    mastery.currentMastery = nextMastery;
    mastery.attemptsCount += 1;
    mastery.riskLevel = computeRiskLevel(nextMastery);
    await mastery.save();
  }

  const features = computeTaskAnswerFeatures(scoredAnswers);
  let conceptState = await StudentConceptState.findOne({ schoolId, classroomId, studentId, conceptId });
  if (!conceptState) {
    conceptState = await StudentConceptState.create({
      schoolId,
      classroomId,
      studentId,
      conceptId,
      masteryScore: nextMastery
    });
  }

  const previousDifficulty = conceptState.lastDifficultyLevel || taskPlan.targetDifficulty;
  conceptState.masteryScore = nextMastery;
  conceptState.confidenceBand = computeConfidenceBand({
    accuracy: features.accuracy,
    hintRatio: features.hintRatio
  });
  conceptState.paceBand = computePaceBand({ responseRatio: features.responseRatio });
  conceptState.recentFirstAttemptAccuracy = Number(features.accuracy.toFixed(3));
  conceptState.averageResponseRatio = features.responseRatio;
  conceptState.totalHintsUsed += features.totalHints;
  conceptState.totalRetries += features.totalRetries;
  conceptState.lastPracticedAt = new Date();
  conceptState.lastDifficultyLevel = taskPlan.targetDifficulty;
  conceptState.consecutiveCorrect = scoredAnswers.every((answer) => answer.isCorrect) ? conceptState.consecutiveCorrect + 1 : 0;
  conceptState.consecutiveWrong = scoredAnswers.every((answer) => !answer.isCorrect) ? conceptState.consecutiveWrong + 1 : 0;
  const currentPrerequisite = skillId ? await SkillPrerequisite.findOne({ skillId }).lean() : null;
  conceptState.prerequisiteFallbackSkillId =
    conceptState.consecutiveWrong >= 2 && currentPrerequisite?.prerequisiteSkillId
      ? currentPrerequisite.prerequisiteSkillId
      : "";
  conceptState.latestBlocker =
    features.accuracy < 0.5
      ? "Accuracy remains below target."
      : features.responseRatio > 1.15
        ? "The student is solving correctly but too slowly."
        : "";
  conceptState.checkpointPassed =
    checkpointCorrect &&
    nextMastery >= CHAPTER_MASTERY_TARGET &&
    !conceptState.latestBlocker &&
    !conceptState.prerequisiteFallbackSkillId;
  if (conceptState.checkpointPassed) {
    conceptState.conceptCompletedAt = new Date();
  }
  await conceptState.save();

  const difficultyChange = computeDifficultyChange({
    previousDifficulty,
    targetDifficulty: taskPlan.targetDifficulty,
    paceBand: conceptState.paceBand,
    accuracy: features.accuracy,
    hintRatio: features.hintRatio
  });
  const nextAction = conceptState.checkpointPassed
    ? "advance_to_next_chapter"
    : difficultyChange === "down"
      ? "reinforce_same_chapter"
      : difficultyChange === "up"
        ? "raise_difficulty_same_chapter"
        : "continue_same_chapter";

  await AttemptFeatureSnapshot.create({
    schoolId,
    studentId,
    classroomId,
    conceptId,
    taskPlanId: taskPlan._id,
    taskAssignmentId,
    submissionId: sourceSubmissionId,
    accuracy: features.accuracy,
    responseRatio: features.responseRatio,
    hintRatio: features.hintRatio,
    retries: features.totalRetries,
    checkpointPassed: conceptState.checkpointPassed,
    difficultyChange,
    nextAction
  });

  if (skillId) {
    let skillState = await StudentSkillMastery.findOne({ schoolId, classroomId, studentId, skillId });
    if (!skillState) {
      skillState = await StudentSkillMastery.create({
        schoolId,
        classroomId,
        studentId,
        skillId,
        masteryScore: 0,
        confidence: "medium",
        attempts: [],
        consecutiveWrong: 0
      });
    }

    skillState.masteryScore = nextMastery;
    skillState.confidence = conceptState.confidenceBand;
    skillState.lastAttempt = new Date();
    skillState.consecutiveWrong = scoredAnswers.every((answer) => !answer.isCorrect) ? skillState.consecutiveWrong + 1 : 0;
    scoredAnswers.forEach((answer) => {
      skillState.attempts.push({
        questionId: answer.variantId,
        isCorrect: answer.isCorrect,
        responseTimeMs: answer.responseTimeMs,
        hintsUsed: answer.hintsUsed,
        retries: answer.retries,
        performanceScore: answer.isCorrect ? 1 : 0,
        masteryAfter: nextMastery,
        createdAt: new Date()
      });
    });
    if (skillState.attempts.length > 200) {
      skillState.attempts = skillState.attempts.slice(-200);
    }
    await skillState.save();
  }

  await InsightSnapshot.create({
    schoolId,
    userId: studentId,
    role: "student",
    snapshotType: "progress",
    summary: `${taskPlan.conceptName} is now at ${Math.round(nextMastery * 100)}% mastery after today's task.`,
    highlights: [
      `Checkpoint ${conceptState.checkpointPassed ? "passed" : "still in progress"}`,
      `Pace: ${conceptState.paceBand.replace("_", " ")}`,
      `Score: ${scorePercent}%`,
      `Next action: ${nextAction.replace(/_/g, " ")}`
    ],
    signalSummary: {
      weakestConcepts: [taskPlan.conceptName],
      paceProfile: conceptState.paceBand,
      confidenceProfile: conceptState.confidenceBand,
      nextBlocker: conceptState.latestBlocker,
      masteryLiftPercent: Number(((nextMastery - (mastery?.baselineMastery ?? nextMastery)) * 100).toFixed(1))
    },
    context: {
      classroomId,
      studentId,
      conceptId,
      taskPlanId: taskPlan._id
    }
  });

  return {
    mastery: nextMastery,
    conceptState,
    difficultyChange,
    nextAction
  };
}

export async function submitStudentTask({ schoolId, studentId, taskAssignmentId, rawAnswers }) {
  const assignment = await TaskAssignment.findOne({ _id: taskAssignmentId, schoolId, studentId }).populate({
    path: "taskPlanId",
    populate: { path: "practiceItems.variantId" }
  });
  if (!assignment?.taskPlanId) {
    throw createHttpError(404, "Task assignment not found.");
  }
  if (!["assigned", "started"].includes(assignment.status) || assignment.submittedAt) {
    throw createHttpError(409, "This batch has already been submitted.");
  }

  const taskPlan = assignment.taskPlanId;
  assignment.status = "started";
  assignment.startedAt = assignment.startedAt ?? new Date();
  await assignment.save();
  const variantMap = new Map((taskPlan.practiceItems ?? []).map((item) => [String(item.variantId._id), { variant: item.variantId, stage: item.stage }]));
  const scoredAnswers = rawAnswers.map((answer) => {
    const matched = variantMap.get(String(answer.variantId));
    const variant = matched?.variant;
    const submittedAnswer = String(answer.submittedAnswer ?? "").trim();
    return {
      variantId: answer.variantId,
      stage: matched?.stage ?? "practice",
      submittedAnswer,
      isCorrect: answersEquivalent(submittedAnswer, variant?.correctAnswer ?? ""),
      responseTimeMs: Number(answer.responseTimeMs || 0),
      hintsUsed: Number(answer.hintsUsed || 0),
      retries: Number(answer.retries || 0),
      expectedTimeSec: variant?.expectedTimeSec ?? 60
    };
  });

  const correctCount = scoredAnswers.filter((answer) => answer.isCorrect).length;
  const scorePercent = Number(((correctCount / Math.max(scoredAnswers.length, 1)) * 100).toFixed(2));

  const submission = await Submission.create({
    schoolId,
    assessmentId: null,
    studentId,
    classroomId: assignment.classroomId,
    answers: scoredAnswers.map((answer) => ({
      questionId: answer.variantId,
      submittedAnswer: answer.submittedAnswer,
      isCorrect: answer.isCorrect,
      responseTimeMs: answer.responseTimeMs,
      hintsUsed: answer.hintsUsed,
      retries: answer.retries
    })),
    scorePercent,
    sourceType: scoredAnswers.some((answer) => answer.stage === "checkpoint") ? "checkpoint" : "practice"
  });

  const skillId = taskPlan.practiceItems?.[0]?.variantId?.skillId ?? null;
  const learningState = await updateTaskLearningState({
    schoolId,
    classroomId: assignment.classroomId,
    studentId,
    conceptId: taskPlan.conceptId,
    skillId,
    scoredAnswers,
    taskPlan,
    taskAssignmentId: assignment._id,
    sourceSubmissionId: submission._id,
    scorePercent
  });

  const path =
    (assignment.pathId || taskPlan.pathId
      ? await StudentLearningPath.findOne({ _id: assignment.pathId || taskPlan.pathId, schoolId, studentId })
      : await StudentLearningPath.findOne({ schoolId, studentId })) ?? null;
  const { chapters } = await getPathChapterContext({ path });
  const schoolTimeZone = await getSchoolTimezone(schoolId);
  const schoolDate = toDateOnlyInTimezone(new Date(), schoolTimeZone);
  const chapterMastered =
    learningState.conceptState.checkpointPassed && learningState.mastery >= (taskPlan.masteryTarget ?? CHAPTER_MASTERY_TARGET);

  assignment.status = "completed";
  assignment.startedAt = assignment.startedAt ?? new Date();
  assignment.completedAt = new Date();
  assignment.submittedAt = assignment.completedAt;
  taskPlan.status = "completed";
  taskPlan.completedAt = new Date();
  taskPlan.unlocksNextChapter = chapterMastered;

  let chapterUnlocked = false;
  let dailyGoalReached = false;
  if (path) {
    path.status = "active";
    path.currentConceptId = taskPlan.conceptId;
    path.currentChapterCode = taskPlan.conceptCode;
    path.currentChapterNumber = taskPlan.chapterNumber;
    ensureDailyMilestone({
      path,
      currentMastery: learningState.mastery,
      paceBand: learningState.conceptState.paceBand,
      schoolDate,
      targetMastery: CHAPTER_MASTERY_TARGET
    });
    const masteryPercent = Math.round(learningState.mastery * 100);
    dailyGoalReached = masteryPercent >= Number(path.dailyMasteryGoal ?? 0);
    path.dailyTargetStatus = dailyGoalReached ? "reached" : "in_progress";
    path.dailyTargetDate = schoolDate;
    path.dailyGoalReachedAt = dailyGoalReached ? new Date() : undefined;

    if (chapterMastered) {
      chapterUnlocked = true;
      if (!path.completedChapterCodes.includes(taskPlan.conceptCode)) {
        path.completedChapterCodes.push(taskPlan.conceptCode);
      }
      path.lastMasteryAt = new Date();
      path.dailyTargetStatus = "reached";
      path.dailyMasteryStart = masteryPercent;
      path.dailyMasteryGoal = masteryPercent;
      path.dailyGoalReachedAt = new Date();

      const nextChapter = chapters.find((chapter) => chapter.chapterNumber > taskPlan.chapterNumber);
      if (nextChapter?.concept) {
        path.currentChapterNumber = nextChapter.chapterNumber;
        path.currentConceptId = nextChapter.concept._id;
        path.currentChapterCode = nextChapter.code;
        path.currentCycleIndex = 0;
        path.dailyTargetStatus = "in_progress";
        path.dailyMasteryStart = 0;
        path.dailyMasteryGoal = 0;
        path.dailyTargetDate = schoolDate;
        path.dailyGoalReachedAt = undefined;
      } else {
        path.status = "completed";
      }
    }
  }
  await assignment.save();
  await taskPlan.save();
  if (path) {
    await path.save();
  }

  let nextTask = null;
  if (path?.status === "active" && (chapterUnlocked || !dailyGoalReached)) {
    const nextPlan = await createTaskPlan({
      schoolId,
      classroomId: assignment.classroomId,
      teacherId: assignment.teacherId || path.activatedByTeacherId,
      studentId,
      refresh: true,
      allowAfterMilestone: chapterUnlocked
    });
    if (nextPlan) {
      const nextAssignment = await createTaskAssignmentFromPlan({
        schoolId,
        classroomId: assignment.classroomId,
        teacherId: assignment.teacherId || path.activatedByTeacherId,
        studentId,
        pathId: path._id,
        plan: nextPlan,
        assignedForDate: schoolDate,
        autoAssigned: true,
      });

      nextTask = serializeStudentTaskFromAssignment(nextAssignment.toObject());
    }
  }

  return {
    submission,
    scorePercent,
    mastery: learningState.mastery,
    conceptState: learningState.conceptState,
    difficultyChange: learningState.difficultyChange,
    nextAction: learningState.nextAction,
    chapterUnlocked,
    dailyGoalReached,
    pathStatus: path?.status ?? "not_started",
    currentChapterNumber: path?.currentChapterNumber ?? taskPlan.chapterNumber,
    nextTask
  };
}

export async function getStudentPathView({ schoolId, studentId }) {
  const [path, chapters, masteryDocs, conceptStates, assignments, submissions, latestInsight, schoolTimeZone] = await Promise.all([
    StudentLearningPath.findOne({ schoolId, studentId }).lean(),
    getChapterCatalog(),
    StudentConceptMastery.find({ schoolId, studentId }).populate("conceptId").lean(),
    StudentConceptState.find({ schoolId, studentId }).populate("conceptId").lean(),
    TaskAssignment.find({ schoolId, studentId }).sort({ assignedAt: -1 }).limit(20).populate("taskPlanId").lean(),
    Submission.find({ schoolId, studentId }).sort({ createdAt: -1 }).limit(10).lean(),
    InsightSnapshot.findOne({ schoolId, userId: studentId, role: "student" }).sort({ createdAt: -1 }).lean(),
    getSchoolTimezone(schoolId)
  ]);
  const schoolDate = toDateOnlyInTimezone(new Date(), schoolTimeZone);

  const masteryByCode = new Map(
    masteryDocs
      .filter((item) => item?.conceptId?.code)
      .map((item) => [item.conceptId.code, item.currentMastery ?? 0])
  );
  const stateByCode = new Map(
    conceptStates
      .filter((item) => item?.conceptId?.code)
      .map((item) => [item.conceptId.code, item])
  );
  const chapterLadder = buildChapterLadder({ chapters, path, masteryByCode, stateByCode });
  const currentChapter =
    chapters.find((chapter) => chapter.code === path?.currentChapterCode) ??
    chapters.find((chapter) => chapter.chapterNumber === path?.currentChapterNumber) ??
    chapters[0] ??
    null;
  const currentMastery = currentChapter ? masteryByCode.get(currentChapter.code) ?? 0 : 0;
  const currentState = currentChapter ? stateByCode.get(currentChapter.code) ?? null : null;
  const visibleAssignments = assignments.filter((assignment) => assignment.status !== "superseded");
  const openAssignment =
    visibleAssignments.find((assignment) => ["assigned", "started"].includes(assignment.status)) ?? null;
  const latestAssignment = visibleAssignments[0] ?? null;
  const latestAssignmentDate = openAssignment?.assignedForDate ?? latestAssignment?.assignedForDate ?? "";
  const lastPracticedAt = currentState?.lastPracticedAt ? toDateOnly(currentState.lastPracticedAt) : "";
  const currentStatus = derivePathStatus({ path, currentMastery, currentState, latestAssignmentDate, lastPracticedAt });
  const milestoneCompletedToday = Boolean(path?.dailyTargetStatus === "reached" && path?.dailyTargetDate === schoolDate);
  const canContinuePractice = Boolean(path?.status === "active" && !openAssignment && !chapterLadder.every((chapter) => chapter.status === "completed") && milestoneCompletedToday);
  const latestVisibleBatch = latestAssignment
    ? {
        id: latestAssignment._id,
        status: latestAssignment.status,
        assignedForDate: latestAssignment.assignedForDate,
        chapterNumber: latestAssignment.taskPlanId?.chapterNumber ?? latestAssignment.chapterNumber ?? null,
        concept: latestAssignment.taskPlanId?.conceptName ?? "Chapter batch",
        itemsCount: latestAssignment.taskPlanId?.practiceItems?.length ?? 0,
        targetDifficulty: latestAssignment.taskPlanId?.targetDifficulty ?? 1,
        cycleIndex: latestAssignment.taskPlanId?.cycleIndex ?? latestAssignment.cycleIndex ?? 1
      }
    : null;

  return {
    studentId,
    classroomId: path?.classroomId ?? latestAssignment?.classroomId ?? null,
    status: currentStatus,
    currentChapterNumber: currentChapter?.chapterNumber ?? null,
    currentChapterCode: currentChapter?.code ?? "",
    currentChapterName: currentChapter?.name ?? "Not started",
    currentMastery: Math.round(currentMastery * 100),
    completedChaptersCount: path?.completedChapterCodes?.length ?? 0,
    totalChapters: chapters.length,
    currentCycleIndex: path?.currentCycleIndex ?? 0,
    dailyTargetStatus: path?.dailyTargetStatus ?? "in_progress",
    dailyMasteryStart: path?.dailyMasteryStart ?? 0,
    dailyMasteryGoal: path?.dailyMasteryGoal ?? 0,
    dailyTargetDate: path?.dailyTargetDate ?? "",
    dailyGoalReachedAt: path?.dailyGoalReachedAt ?? null,
    milestoneCompletedToday,
    canContinuePractice,
    latestAssignmentStatus: openAssignment?.status ?? latestAssignment?.status ?? "none",
    latestAssignmentDate,
    latestScore: submissions[0]?.scorePercent ?? null,
    paceBand: currentState?.paceBand ?? "on_track",
    confidenceBand: currentState?.confidenceBand ?? "medium",
    lastPracticedAt,
    currentTaskItemsCount: openAssignment?.taskPlanId?.practiceItems?.length ?? latestAssignment?.taskPlanId?.practiceItems?.length ?? 0,
    chapterLadder,
    latestBatch: latestVisibleBatch,
    assignmentHistory: Array.from(
      new Map(
        visibleAssignments.map((assignment) => {
          const chapterNumber = assignment.taskPlanId?.chapterNumber ?? assignment.chapterNumber ?? null;
          const cycleIndex = assignment.taskPlanId?.cycleIndex ?? assignment.cycleIndex ?? 1;
          const key = `${assignment.assignedForDate}:${chapterNumber}:${cycleIndex}:${assignment.status}`;
          return [
            key,
            {
              id: assignment._id,
              status: assignment.status,
              assignedForDate: assignment.assignedForDate,
              chapterNumber,
              concept: assignment.taskPlanId?.conceptName ?? "Chapter batch",
              itemsCount: assignment.taskPlanId?.practiceItems?.length ?? 0,
              targetDifficulty: assignment.taskPlanId?.targetDifficulty ?? 1,
              cycleIndex
            }
          ];
        })
      ).values()
    ).slice(0, 4),
    summary:
      latestInsight?.summary ||
      (path?.status === "completed"
        ? "The Class 10 chapter path is complete."
        : currentChapter
          ? `Chapter ${currentChapter.chapterNumber} is active at ${Math.round(currentMastery * 100)}% mastery.`
          : "The learning path has not started yet."),
    highlights:
      latestInsight?.highlights ??
      [
        currentChapter ? `Current chapter: ${currentChapter.chapterNumber} - ${currentChapter.name}` : "No active chapter",
        currentState?.checkpointPassed ? "Checkpoint passed for the current chapter." : "Checkpoint still needs to be cleared.",
        `Daily target: ${(path?.dailyTargetStatus ?? "in_progress").replace("_", " ")}`
      ],
    recentResults: submissions.slice(0, 4).map((item, index) => ({
      id: String(item._id ?? `${item.sourceType}-${index}`),
      title: `${item.sourceType} submission`,
      score: `${item.scorePercent}%`,
      createdAt: item.createdAt
    })),
    openTask:
      openAssignment?.taskPlanId
        ? serializeStudentTaskFromAssignment(
            {
              ...openAssignment,
              taskPlanId: openAssignment.taskPlanId
            },
            latestInsight
          )
        : null
  };
}

export async function getTeacherPathStatuses({ schoolId, teacherId, classroomId = null }) {
  const schoolTimeZone = await getSchoolTimezone(schoolId);
  const schoolDate = toDateOnlyInTimezone(new Date(), schoolTimeZone);
  const classrooms = await Classroom.find(classroomId ? { _id: classroomId, schoolId, teacherId } : { schoolId, teacherId }).lean();
  const classroomIds = classrooms.map((item) => item._id);
  const students = await User.find({ schoolId, role: "student", classroomId: { $in: classroomIds } }).lean();
  const statuses = await Promise.all(
    students.map(async (student) => {
      const view = await getStudentPathView({ schoolId, studentId: student._id });
      const riskProfile = deriveStudentRiskProfile({
        status: view.status,
        currentMastery: view.currentMastery,
        currentCycleIndex: view.currentCycleIndex,
        latestAssignmentDate: view.latestAssignmentDate,
        lastPracticedAt: view.lastPracticedAt,
        dailyTargetDate: view.dailyTargetDate,
        dailyMasteryGoal: view.dailyMasteryGoal,
        dailyTargetStatus: view.dailyTargetStatus,
        paceBand: view.paceBand,
        todayDate: schoolDate
      });
      return {
        studentId: student._id,
        classroomId: student.classroomId,
        name: student.fullName,
        ...view,
        riskLevel: riskProfile.level,
        riskLabel: riskProfile.label,
        riskReason: riskProfile.reason,
        stuck: view.status === "stuck",
        readyToUnlock: view.status === "ready_to_unlock",
        completed: view.status === "completed"
      };
    })
  );

  const active = statuses.filter((item) => item.status === "working").length;
  const stuck = statuses.filter((item) => item.status === "stuck").length;
  const ready = statuses.filter((item) => item.status === "ready_to_unlock").length;
  const completed = statuses.filter((item) => item.status === "completed").length;
  const chapterDistribution = Array.from(
    statuses.reduce((map, item) => {
      const key = item.currentChapterNumber ? `${item.currentChapterNumber}` : "0";
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map())
  ).map(([chapterNumber, value]) => ({
    chapterNumber: Number(chapterNumber),
    value
  }));

  return {
    metrics: [
      { label: "Active paths", value: String(active) },
      { label: "Stuck", value: String(stuck) },
      { label: "Ready to unlock", value: String(ready) },
      { label: "Completed", value: String(completed) }
    ],
    chapterDistribution,
    students: statuses
  };
}

export async function buildTeacherStudentInsights({ schoolId, teacherId, classroomId = null }) {
  const pathStatus = await getTeacherPathStatuses({ schoolId, teacherId, classroomId });

  const students = await Promise.all(
    pathStatus.students.map(async (student) => {
      const aiNarrative = await generateInsightNarrative({
        role: "teacher",
        structuredContext: {
          student: student.name,
          currentChapter: student.currentChapterName,
          currentChapterNumber: student.currentChapterNumber,
          currentMastery: student.currentMastery / 100,
          paceBand: student.paceBand,
          confidenceBand: student.confidenceBand,
          status: student.status,
          completedChapters: student.completedChaptersCount,
          latestAssignment: student.latestAssignmentStatus
        }
      }).catch(() => null);

      return {
        studentId: student.studentId,
        name: student.name,
        classroomId: student.classroomId,
        summary:
          aiNarrative?.summary ||
          `${student.name} is on Chapter ${student.currentChapterNumber ?? "-"} at ${student.currentMastery}% mastery.`,
        highlights:
          aiNarrative?.highlights ??
          [
            `Current chapter: ${student.currentChapterName}`,
            `Completed chapters: ${student.completedChaptersCount}`,
            `Daily target: ${student.dailyTargetStatus.replace("_", " ")}`,
            student.dailyMasteryGoal > student.dailyMasteryStart
              ? `Milestone: ${student.dailyMasteryStart}% -> ${student.dailyMasteryGoal}%${student.dailyTargetDate ? ` on ${student.dailyTargetDate}` : ""}`
              : `Risk: ${student.riskReason}`
          ],
        tags: [
          student.status === "completed" ? "path complete" : `chapter ${student.currentChapterNumber ?? "-"}`,
          student.paceBand === "slow" ? "pace slow" : student.paceBand === "fast" ? "fast mastery" : "on track",
          student.status === "stuck" ? "stuck" : null
        ].filter(Boolean),
        overloaded: student.status === "stuck",
        underChallenged: student.paceBand === "fast" && student.currentMastery >= Math.round(CHAPTER_MASTERY_TARGET * 100),
        weakestConcepts: student.currentChapterName ? [student.currentChapterName] : [],
        latestAssignmentStatus: student.latestAssignmentStatus,
        currentChapterNumber: student.currentChapterNumber,
        currentMastery: student.currentMastery,
        completedChaptersCount: student.completedChaptersCount,
        pathStatus: student.status
      };
    })
  );

  return {
    metrics: pathStatus.metrics,
    students
  };
}

export async function getAdminPathRollup({ schoolId }) {
  const schoolTimeZone = await getSchoolTimezone(schoolId);
  const schoolDate = toDateOnlyInTimezone(new Date(), schoolTimeZone);
  const [students, classrooms] = await Promise.all([
    User.find({ schoolId, role: "student" }).select("_id fullName gradeLevel classroom classroomId").lean(),
    Classroom.find({ schoolId }).select("_id name gradeLevel teacherId").lean()
  ]);
  const classroomById = new Map(classrooms.map((classroom) => [String(classroom._id), classroom]));
  const views = await Promise.all(
    students.map(async (student) => {
      const view = await getStudentPathView({ schoolId, studentId: student._id });
      const riskProfile = deriveStudentRiskProfile({
        status: view.status,
        currentMastery: view.currentMastery,
        currentCycleIndex: view.currentCycleIndex,
        latestAssignmentDate: view.latestAssignmentDate,
        lastPracticedAt: view.lastPracticedAt,
        dailyTargetDate: view.dailyTargetDate,
        dailyMasteryGoal: view.dailyMasteryGoal,
        dailyTargetStatus: view.dailyTargetStatus,
        paceBand: view.paceBand,
        todayDate: schoolDate
      });
      const classroom = classroomById.get(String(student.classroomId ?? ""));

      return {
        ...view,
        studentId: student._id,
        name: student.fullName,
        gradeLevel: student.gradeLevel,
        classroomId: student.classroomId ?? null,
        classroomName: classroom?.name ?? student.classroom ?? "Unassigned",
        classroomGradeLevel: classroom?.gradeLevel ?? "",
        riskLevel: riskProfile.level,
        riskLabel: riskProfile.label,
        riskReason: riskProfile.reason
      };
    })
  );
  const averageChapterReached = views.length
    ? Number((views.reduce((sum, item) => sum + (item.currentChapterNumber ?? 0), 0) / views.length).toFixed(1))
    : 0;
  const stuckCount = views.filter((item) => item.status === "stuck").length;
  const completedCount = views.filter((item) => item.status === "completed").length;
  const activeCount = views.filter((item) => item.status === "working").length;
  const readyCount = views.filter((item) => item.status === "ready_to_unlock").length;
  const behindCount = views.filter((item) => ["medium", "high"].includes(item.riskLevel) && item.status !== "completed").length;
  const chapterDistribution = Array.from(
    views.reduce((map, item) => {
      const key = String(item.currentChapterNumber ?? 0);
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map())
  ).map(([chapterNumber, value]) => ({
    chapterNumber: Number(chapterNumber),
    value
  }));
  const riskDistribution = [
    { label: "Low", value: views.filter((item) => item.riskLevel === "low").length },
    { label: "Medium", value: views.filter((item) => item.riskLevel === "medium").length },
    { label: "High", value: views.filter((item) => item.riskLevel === "high").length }
  ];
  const milestoneDistribution = [
    { label: "Reached today", value: views.filter((item) => item.dailyTargetStatus === "reached").length },
    { label: "In progress", value: views.filter((item) => item.dailyTargetStatus === "in_progress" && item.riskLevel === "low").length },
    { label: "Behind target", value: behindCount }
  ];
  const classroomRollup = Array.from(
    views.reduce((map, item) => {
      const key = String(item.classroomId ?? item.classroomName ?? "unassigned");
      if (!map.has(key)) {
        map.set(key, {
          classroomId: item.classroomId ?? null,
          classroomName: item.classroomName ?? "Unassigned",
          gradeLevel: item.classroomGradeLevel ?? "",
          students: 0,
          active: 0,
          stuck: 0,
          ready: 0,
          completed: 0,
          behind: 0,
          averageMastery: 0
        });
      }

      const current = map.get(key);
      current.students += 1;
      current.averageMastery += item.currentMastery ?? 0;
      if (item.status === "working") current.active += 1;
      if (item.status === "stuck") current.stuck += 1;
      if (item.status === "ready_to_unlock") current.ready += 1;
      if (item.status === "completed") current.completed += 1;
      if (["medium", "high"].includes(item.riskLevel)) current.behind += 1;
      return map;
    }, new Map()).values()
  ).map((item) => ({
    ...item,
    averageMastery: item.students ? Math.round(item.averageMastery / item.students) : 0
  }));

  return {
    metrics: [
      { label: "Active paths", value: String(activeCount) },
      { label: "Students stuck", value: String(stuckCount) },
      { label: "Average chapter", value: String(averageChapterReached) },
      { label: "Path completed", value: String(completedCount) }
    ],
    chapterDistribution,
    riskDistribution,
    milestoneDistribution,
    classroomRollup,
    studentsBehindTarget: behindCount,
    readyToUnlock: readyCount,
    students: views
  };
}

export async function buildAdminRollupInsights({ schoolId }) {
  const rollup = await getAdminPathRollup({ schoolId });
  const taskAssignments = await TaskAssignment.find({ schoolId }).lean();
  const fallbackSummary = `Average progress is Chapter ${rollup.metrics[2]?.value ?? "0"} with ${rollup.metrics[1]?.value ?? "0"} students currently stuck.`;
  const aiNarrative = await generateInsightNarrative({
    role: "admin",
    structuredContext: {
      averageChapter: rollup.metrics[2]?.value ?? "0",
      stuckStudents: rollup.metrics[1]?.value ?? "0",
      completedPaths: rollup.metrics[3]?.value ?? "0",
      assignedTasks: taskAssignments.length
    }
  }).catch(() => null);

  return {
    summary: aiNarrative?.summary || fallbackSummary,
    highlights:
      aiNarrative?.highlights ??
      [
        `Adaptive batches assigned: ${taskAssignments.length}`,
        `Average chapter reached: ${rollup.metrics[2]?.value ?? "0"}`,
        `Students stuck: ${rollup.metrics[1]?.value ?? "0"}`
      ],
    metrics: [
      ...rollup.metrics,
      { label: "Adaptive batches assigned", value: String(taskAssignments.length) }
    ],
    chapterDistribution: rollup.chapterDistribution
  };
}
