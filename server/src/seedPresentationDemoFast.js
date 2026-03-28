import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.OPENAI_ENABLE_ENHANCED_GENERATION = "false";

import mongoose from "mongoose";
import { connectDatabase } from "./db.js";
import { hashPassword } from "./auth.js";
import {
  School,
  User,
  Classroom,
  Concept,
  QuestionTemplate,
  QuestionVariant,
  Submission,
  StudentConceptMastery,
  StudentConceptState,
  StudentTaskPlan,
  StudentLearningPath,
  TaskAssignment,
  InsightSnapshot,
  ActivityEvent
} from "./models.js";

const { ObjectId } = mongoose.Types;

const DEMO = {
  schoolName: "WisdomEdu Presentation School",
  slug: "wisdomedu-presentation-school",
  timezone: "Asia/Kolkata",
  adminName: "Presentation Admin",
  adminEmail: "presentation.admin@wisdomedu.demo",
  password: "Demo@12345"
};

const TEACHERS = [
  {
    key: "10A",
    fullName: "Ananya Sharma",
    email: "ananya.sharma@wisdomedu.demo",
    classroomName: "Class 10 A"
  },
  {
    key: "10B",
    fullName: "Rahul Verma",
    email: "rahul.verma@wisdomedu.demo",
    classroomName: "Class 10 B"
  }
];

const STUDENT_BLUEPRINTS = [
  { fullName: "Aarav Mehta", classroomKey: "10A", phase: "breakthrough", unlockByDay: 7 },
  { fullName: "Diya Kapoor", classroomKey: "10A", phase: "steady", unlockByDay: null },
  { fullName: "Kabir Nair", classroomKey: "10A", phase: "foundation", unlockByDay: null },
  { fullName: "Myra Khanna", classroomKey: "10A", phase: "steady", unlockByDay: null },
  { fullName: "Reyansh Gupta", classroomKey: "10A", phase: "breakthrough", unlockByDay: 8 },
  { fullName: "Anika Iyer", classroomKey: "10A", phase: "rebound", unlockByDay: null },
  { fullName: "Vihaan Sethi", classroomKey: "10A", phase: "steady", unlockByDay: null },
  { fullName: "Sara Bhatia", classroomKey: "10A", phase: "foundation", unlockByDay: null },
  { fullName: "Advik Malhotra", classroomKey: "10A", phase: "breakthrough", unlockByDay: 7 },
  { fullName: "Navya Arora", classroomKey: "10A", phase: "steady", unlockByDay: null },
  { fullName: "Arjun Jain", classroomKey: "10A", phase: "foundation", unlockByDay: null },
  { fullName: "Siya Menon", classroomKey: "10A", phase: "steady", unlockByDay: null },
  { fullName: "Lakshya Bansal", classroomKey: "10A", phase: "rebound", unlockByDay: null },
  { fullName: "Ira Chopra", classroomKey: "10A", phase: "breakthrough", unlockByDay: 8 },
  { fullName: "Dev Patil", classroomKey: "10A", phase: "steady", unlockByDay: null },
  { fullName: "Aanya Rao", classroomKey: "10B", phase: "steady", unlockByDay: null },
  { fullName: "Ritvik Kulkarni", classroomKey: "10B", phase: "foundation", unlockByDay: null },
  { fullName: "Kiara Desai", classroomKey: "10B", phase: "rebound", unlockByDay: null },
  { fullName: "Yuvan Pillai", classroomKey: "10B", phase: "steady", unlockByDay: null },
  { fullName: "Prisha Tandon", classroomKey: "10B", phase: "breakthrough", unlockByDay: 8 },
  { fullName: "Aarohi Singh", classroomKey: "10B", phase: "foundation", unlockByDay: null },
  { fullName: "Hriday Bose", classroomKey: "10B", phase: "steady", unlockByDay: null },
  { fullName: "Samaira Dutta", classroomKey: "10B", phase: "rebound", unlockByDay: null },
  { fullName: "Vivaan Yadav", classroomKey: "10B", phase: "foundation", unlockByDay: null },
  { fullName: "Meher Joshi", classroomKey: "10B", phase: "steady", unlockByDay: null },
  { fullName: "Dhruv Chawla", classroomKey: "10B", phase: "breakthrough", unlockByDay: 7 },
  { fullName: "Pari Ghosh", classroomKey: "10B", phase: "steady", unlockByDay: null },
  { fullName: "Arnav Walia", classroomKey: "10B", phase: "foundation", unlockByDay: null },
  { fullName: "Rhea Thomas", classroomKey: "10B", phase: "steady", unlockByDay: null },
  { fullName: "Nivaan Saxena", classroomKey: "10B", phase: "rebound", unlockByDay: null }
];

const STUCK_STUDENT_INDEXES = new Set([2, 7, 16, 20, 29]);

const CHAPTER_ONE_SCORE_MAP = {
  foundation: [20, 20, 40, 40, 40, 60, 40, 60, 60, 60],
  rebound: [20, 40, 40, 60, 40, 60, 60, 60, 80, 60],
  steady: [40, 40, 60, 60, 60, 80, 60, 80, 80, 80],
  breakthrough: [60, 60, 80, 80, 80, 100, 80, 100, 100, 80]
};

const CHAPTER_TWO_SCORE_MAP = {
  foundation: [20, 40, 40, 40],
  rebound: [40, 40, 60, 60],
  steady: [40, 60, 60, 80],
  breakthrough: [60, 60, 80, 80]
};

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toDateOnlyInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

function makeIstDate(dateOnly, hour, minute) {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${dateOnly}T${hh}:${mm}:00+05:30`);
}

function buildDateSeries(days, timeZone) {
  return Array.from({ length: days }, (_item, index) => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() - (days - index));
    return toDateOnlyInTimezone(date, timeZone);
  });
}

function computeRiskLevel(mastery) {
  if (mastery >= 0.7) return "low";
  if (mastery >= 0.4) return "medium";
  return "high";
}

function pickCurrentChapter(blueprint, index) {
  if (blueprint.unlockByDay) {
    return 2;
  }
  if (blueprint.phase === "steady" && index % 11 === 0) {
    return 2;
  }
  return 1;
}

function getCurrentMasteryPercent({ phase, currentChapterNumber, index, stuck }) {
  const chapterOneBase = {
    foundation: 28,
    rebound: 42,
    steady: 58,
    breakthrough: 72
  };
  const chapterTwoBase = {
    foundation: 24,
    rebound: 36,
    steady: 48,
    breakthrough: 56
  };
  const spread = currentChapterNumber === 1 ? chapterOneBase[phase] : chapterTwoBase[phase];
  const value = spread + ((index % 4) * 4 - 4);
  if (stuck) {
    return Math.max(19, Math.min(value, 33));
  }
  return Math.max(19, Math.min(value, currentChapterNumber === 1 ? 78 : 68));
}

function getChapterOneMasteryPercent({ phase, currentChapterNumber, index }) {
  if (currentChapterNumber === 1) {
    return getCurrentMasteryPercent({ phase, currentChapterNumber, index, stuck: false });
  }
  return Math.max(84, Math.min(93, 86 + (index % 5) * 2));
}

function getDailyGoal(currentMasteryPercent, stuck) {
  const start = Math.max(10, currentMasteryPercent - (stuck ? 4 : 6));
  const goal = Math.min(79, start + (stuck ? 8 : 12));
  return { start, goal };
}

function getPaceBand(phase, stuck) {
  if (stuck || phase === "foundation") return "slow";
  if (phase === "breakthrough") return "fast";
  return "on_track";
}

function getConfidenceBand(phase, stuck) {
  if (stuck || phase === "foundation") return "low";
  if (phase === "breakthrough") return "high";
  return "medium";
}

function chooseWrongAnswer(variant, offset = 1) {
  const correctAnswer = String(variant.correctAnswer ?? "").trim();
  if (/^-?\d+(\.\d+)?$/.test(correctAnswer)) {
    return String(Number(correctAnswer) + offset + 2);
  }
  if (/^-?\d+\/\d+$/.test(correctAnswer)) {
    return `${Number(offset) + 1}/2`;
  }
  if (variant.questionType === "true_false") {
    return correctAnswer.toLowerCase() === "true" ? "False" : "True";
  }
  const alternate = (variant.options ?? []).find((item) => String(item).trim() !== correctAnswer);
  return alternate ? String(alternate) : `wrong-${offset}`;
}

function buildVariantDocs({ schoolId, concept, templates, createdAt }) {
  return templates.slice(0, 5).map((template, index) => ({
    _id: new ObjectId(),
    schoolId,
    templateQuestionId: template._id,
    conceptId: concept._id,
    skillId: template.skillId ?? null,
    chapterCode: concept.code,
    gradeLevel: "10",
    topic: template.topic ?? concept.name,
    prompt: template.prompt,
    questionType: template.questionType,
    options: template.options ?? [],
    correctAnswer: template.correctAnswer,
    explanation: template.explanation,
    difficultyLevel: template.difficultyLevel,
    expectedTimeSec: template.expectedTimeSec ?? 60,
    hintWeight: template.hintWeight ?? 1,
    generationMethod: "template_copy",
    variantType: "presentation_seed",
    parameterSignature: `presentation:${concept.code}:${index + 1}`,
    noveltyHash: `presentation-${concept.code}-${index + 1}`,
    allowedAnswerPatterns: template.allowedAnswerPatterns ?? [],
    aiSupport: {
      hint: `Start with the ${template.topic || concept.name.toLowerCase()} idea first.`,
      explanation: template.explanation,
      rewriteRationale: "Seeded for a live presentation flow."
    },
    createdAt,
    updatedAt: createdAt
  }));
}

function pickPracticeItems(variantDocs) {
  return variantDocs.map((variant, index) => ({
    variantId: variant._id,
    order: index + 1,
    stage: index === variantDocs.length - 1 ? "checkpoint" : "practice",
    difficultyLevel: variant.difficultyLevel,
    sourceKind: "template"
  }));
}

function buildSubmissionAnswers(variantDocs, scorePercent, dayIndex) {
  const correctCount = Math.max(1, Math.min(variantDocs.length, Math.round((scorePercent / 100) * variantDocs.length)));
  return variantDocs.map((variant, index) => {
    const isCorrect = index < correctCount;
    return {
      questionId: variant._id,
      submittedAnswer: isCorrect ? String(variant.correctAnswer ?? "") : chooseWrongAnswer(variant, dayIndex + index),
      isCorrect,
      responseTimeMs: Math.round((variant.expectedTimeSec ?? 60) * 1000 * (1 + index * 0.08)),
      hintsUsed: isCorrect ? 0 : 1,
      retries: isCorrect ? 0 : 1
    };
  });
}

async function deleteExistingDemoSchool() {
  const demoSchools = await School.find({
    $or: [{ slug: DEMO.slug }, { adminEmail: DEMO.adminEmail }]
  }).lean();

  for (const school of demoSchools) {
    const schoolId = school._id;
    await Promise.all([
      ActivityEvent.deleteMany({ schoolId }),
      InsightSnapshot.deleteMany({ schoolId }),
      TaskAssignment.deleteMany({ schoolId }),
      StudentTaskPlan.deleteMany({ schoolId }),
      StudentLearningPath.deleteMany({ schoolId }),
      StudentConceptState.deleteMany({ schoolId }),
      StudentConceptMastery.deleteMany({ schoolId }),
      Submission.deleteMany({ schoolId }),
      QuestionVariant.deleteMany({ schoolId }),
      Classroom.deleteMany({ schoolId }),
      User.deleteMany({ schoolId }),
      School.deleteOne({ _id: schoolId })
    ]);
  }
}

async function loadConceptContext() {
  const [realNumbers, polynomials] = await Promise.all([
    Concept.findOne({ code: "G10-REAL-NUMBERS" }).lean(),
    Concept.findOne({ code: "G10-POLYNOMIALS" }).lean()
  ]);

  if (!realNumbers || !polynomials) {
    throw new Error("Class 10 library is missing. Run `npm run seed:class10` first.");
  }

  const [realTemplates, polyTemplates] = await Promise.all([
    QuestionTemplate.find({ code: realNumbers.code }).sort({ questionIndex: 1 }).limit(5).lean(),
    QuestionTemplate.find({ code: polynomials.code }).sort({ questionIndex: 1 }).limit(5).lean()
  ]);

  if (realTemplates.length < 5 || polyTemplates.length < 5) {
    throw new Error("Not enough templates found for Real Numbers and Polynomials.");
  }

  return {
    chapterOne: { concept: realNumbers, templates: realTemplates, chapterNumber: 1 },
    chapterTwo: { concept: polynomials, templates: polyTemplates, chapterNumber: 2 }
  };
}

async function main() {
  await connectDatabase();
  await deleteExistingDemoSchool();

  const { chapterOne, chapterTwo } = await loadConceptContext();
  const passwordHash = await hashPassword(DEMO.password);

  const schoolId = new ObjectId();
  const adminId = new ObjectId();
  const teacherIds = TEACHERS.map(() => new ObjectId());
  const classroomIds = TEACHERS.map(() => new ObjectId());
  const startDate = buildDateSeries(10, DEMO.timezone)[0];
  const createdAt = makeIstDate(startDate, 8, 0);

  const schoolDoc = {
    _id: schoolId,
    name: DEMO.schoolName,
    slug: DEMO.slug,
    adminName: DEMO.adminName,
    adminEmail: DEMO.adminEmail,
    timezone: DEMO.timezone,
    createdAt,
    updatedAt: createdAt
  };

  const userDocs = [
    {
      _id: adminId,
      schoolId,
      role: "admin",
      fullName: DEMO.adminName,
      email: DEMO.adminEmail,
      passwordHash,
      status: "active",
      createdAt,
      updatedAt: createdAt
    }
  ];

  const teacherDocs = TEACHERS.map((teacher, index) => {
    const teacherDoc = {
      _id: teacherIds[index],
      schoolId,
      role: "teacher",
      fullName: teacher.fullName,
      email: teacher.email,
      passwordHash,
      status: "active",
      createdAt: makeIstDate(startDate, 8, 10 + index * 5),
      updatedAt: makeIstDate(startDate, 8, 10 + index * 5)
    };
    userDocs.push(teacherDoc);
    return teacherDoc;
  });

  const classroomDocs = TEACHERS.map((teacher, index) => ({
    _id: classroomIds[index],
    schoolId,
    teacherId: teacherIds[index],
    name: teacher.classroomName,
    gradeLevel: "10",
    createdAt: makeIstDate(startDate, 8, 20 + index * 5),
    updatedAt: makeIstDate(startDate, 8, 20 + index * 5)
  }));

  const classroomByKey = new Map(TEACHERS.map((teacher, index) => [teacher.key, classroomDocs[index]]));
  const teacherByKey = new Map(TEACHERS.map((teacher, index) => [teacher.key, teacherDocs[index]]));

  const variantDocs = [
    ...buildVariantDocs({ schoolId, concept: chapterOne.concept, templates: chapterOne.templates, createdAt }),
    ...buildVariantDocs({ schoolId, concept: chapterTwo.concept, templates: chapterTwo.templates, createdAt })
  ];

  const chapterOneVariants = variantDocs.filter((variant) => variant.chapterCode === chapterOne.concept.code);
  const chapterTwoVariants = variantDocs.filter((variant) => variant.chapterCode === chapterTwo.concept.code);

  const pastDayStrings = buildDateSeries(10, DEMO.timezone);
  const todayDate = toDateOnlyInTimezone(new Date(), DEMO.timezone);

  const studentDocs = [];
  const pathDocs = [];
  const masteryDocs = [];
  const conceptStateDocs = [];
  const taskPlanDocs = [];
  const taskAssignmentDocs = [];
  const submissionDocs = [];
  const insightDocs = [];
  const activityDocs = [];

  for (const [index, blueprint] of STUDENT_BLUEPRINTS.entries()) {
    const studentId = new ObjectId();
    const classroom = classroomByKey.get(blueprint.classroomKey);
    const teacher = teacherByKey.get(blueprint.classroomKey);
    const studentCreatedAt = makeIstDate(startDate, 8, 30 + (index % 20));
    const currentChapterNumber = pickCurrentChapter(blueprint, index);
    const stuck = STUCK_STUDENT_INDEXES.has(index);
    const currentConcept = currentChapterNumber === 1 ? chapterOne.concept : chapterTwo.concept;
    const currentMasteryPercent = getCurrentMasteryPercent({
      phase: blueprint.phase,
      currentChapterNumber,
      index,
      stuck
    });
    const chapterOneMasteryPercent = getChapterOneMasteryPercent({
      phase: blueprint.phase,
      currentChapterNumber,
      index
    });
    const chapterTwoMasteryPercent = currentChapterNumber === 2 ? currentMasteryPercent : 0;
    const paceBand = getPaceBand(blueprint.phase, stuck);
    const confidenceBand = getConfidenceBand(blueprint.phase, stuck);
    const milestone = getDailyGoal(currentMasteryPercent, stuck);
    const currentCycleIndex = currentChapterNumber === 2 ? 3 + (index % 2) : 3 + (index % 3);
    const pathId = new ObjectId();
    const lastPracticeDate = stuck ? pastDayStrings[pastDayStrings.length - 3] : pastDayStrings[pastDayStrings.length - 1];
    const lastPracticeStamp = makeIstDate(lastPracticeDate, stuck ? 11 : 18, stuck ? 20 : 30);

    const studentDoc = {
      _id: studentId,
      schoolId,
      role: "student",
      fullName: blueprint.fullName,
      email: `student${String(index + 1).padStart(2, "0")}.${slugify(blueprint.fullName)}@wisdomedu.demo`,
      passwordHash,
      gradeLevel: "10",
      classroomId: classroom._id,
      classroom: classroom.name,
      status: "active",
      createdAt: studentCreatedAt,
      updatedAt: lastPracticeStamp
    };
    studentDocs.push(studentDoc);
    userDocs.push(studentDoc);

    pathDocs.push({
      _id: pathId,
      schoolId,
      studentId,
      classroomId: classroom._id,
      status: "active",
      currentChapterNumber,
      currentConceptId: currentConcept._id,
      currentChapterCode: currentConcept.code,
      activatedByTeacherId: teacher._id,
      activatedAt: makeIstDate(startDate, 9, 10),
      completedChapterCodes: currentChapterNumber === 2 ? [chapterOne.concept.code] : [],
      currentCycleIndex,
      lastAutoAssignedAt: makeIstDate(todayDate, 7, 45 + (index % 10)),
      lastMasteryAt: currentChapterNumber === 2 ? makeIstDate(pastDayStrings[Math.max(0, (blueprint.unlockByDay ?? 7) - 1)], 18, 10) : undefined,
      dailyTargetStatus: "in_progress",
      dailyMasteryStart: milestone.start,
      dailyMasteryGoal: milestone.goal,
      dailyTargetDate: todayDate,
      createdAt: studentCreatedAt,
      updatedAt: makeIstDate(todayDate, 8, 5 + (index % 10))
    });

    masteryDocs.push({
      _id: new ObjectId(),
      schoolId,
      studentId,
      classroomId: classroom._id,
      conceptId: chapterOne.concept._id,
      baselineMastery: Number(Math.max(0.12, (chapterOneMasteryPercent - 24) / 100).toFixed(2)),
      currentMastery: Number((chapterOneMasteryPercent / 100).toFixed(2)),
      riskLevel: computeRiskLevel(chapterOneMasteryPercent / 100),
      attemptsCount: 10,
      createdAt: studentCreatedAt,
      updatedAt: currentChapterNumber === 2 ? makeIstDate(pastDayStrings[Math.max(0, (blueprint.unlockByDay ?? 7) - 1)], 18, 12) : lastPracticeStamp
    });

    if (currentChapterNumber === 2) {
      masteryDocs.push({
        _id: new ObjectId(),
        schoolId,
        studentId,
        classroomId: classroom._id,
        conceptId: chapterTwo.concept._id,
        baselineMastery: Number(Math.max(0.08, (chapterTwoMasteryPercent - 18) / 100).toFixed(2)),
        currentMastery: Number((chapterTwoMasteryPercent / 100).toFixed(2)),
        riskLevel: computeRiskLevel(chapterTwoMasteryPercent / 100),
        attemptsCount: 4,
        createdAt: makeIstDate(pastDayStrings[Math.max(0, (blueprint.unlockByDay ?? 7) - 1)], 18, 18),
        updatedAt: lastPracticeStamp
      });
    }

    conceptStateDocs.push({
      _id: new ObjectId(),
      schoolId,
      studentId,
      classroomId: classroom._id,
      conceptId: chapterOne.concept._id,
      masteryScore: Number((chapterOneMasteryPercent / 100).toFixed(2)),
      confidenceBand: currentChapterNumber === 1 ? confidenceBand : "high",
      paceBand: currentChapterNumber === 1 ? paceBand : "on_track",
      checkpointPassed: currentChapterNumber === 2,
      conceptCompletedAt: currentChapterNumber === 2 ? makeIstDate(pastDayStrings[Math.max(0, (blueprint.unlockByDay ?? 7) - 1)], 18, 15) : undefined,
      lastAssignedAt: makeIstDate(todayDate, 7, 30 + (index % 10)),
      lastPracticedAt: currentChapterNumber === 1 ? lastPracticeStamp : makeIstDate(pastDayStrings[Math.max(0, (blueprint.unlockByDay ?? 7) - 1)], 18, 20),
      recentFirstAttemptAccuracy: Number((Math.min(0.92, chapterOneMasteryPercent / 100)).toFixed(2)),
      averageResponseRatio: currentChapterNumber === 1 ? (stuck ? 1.62 : paceBand === "fast" ? 0.84 : paceBand === "slow" ? 1.22 : 1.01) : 0.96,
      totalHintsUsed: currentChapterNumber === 1 ? (stuck ? 14 : blueprint.phase === "foundation" ? 10 : 5) : 3,
      totalRetries: currentChapterNumber === 1 ? (stuck ? 8 : blueprint.phase === "foundation" ? 6 : 2) : 1,
      consecutiveCorrect: currentChapterNumber === 1 ? (paceBand === "fast" ? 2 : 0) : 4,
      consecutiveWrong: currentChapterNumber === 1 && stuck ? 3 : 0,
      lastDifficultyLevel: currentChapterNumber === 1 ? (blueprint.phase === "breakthrough" ? 3 : 2) : 2,
      latestBlocker: currentChapterNumber === 1 && stuck ? "Accuracy remains below target." : "",
      prerequisiteFallbackSkillId: "",
      createdAt: studentCreatedAt,
      updatedAt: currentChapterNumber === 1 ? lastPracticeStamp : makeIstDate(pastDayStrings[Math.max(0, (blueprint.unlockByDay ?? 7) - 1)], 18, 20)
    });

    if (currentChapterNumber === 2) {
      conceptStateDocs.push({
        _id: new ObjectId(),
        schoolId,
        studentId,
        classroomId: classroom._id,
        conceptId: chapterTwo.concept._id,
        masteryScore: Number((chapterTwoMasteryPercent / 100).toFixed(2)),
        confidenceBand,
        paceBand,
        checkpointPassed: false,
        lastAssignedAt: makeIstDate(todayDate, 7, 30 + (index % 10)),
        lastPracticedAt: lastPracticeStamp,
        recentFirstAttemptAccuracy: Number((Math.min(0.72, chapterTwoMasteryPercent / 100)).toFixed(2)),
        averageResponseRatio: stuck ? 1.4 : paceBand === "fast" ? 0.92 : paceBand === "slow" ? 1.18 : 1.03,
        totalHintsUsed: stuck ? 9 : blueprint.phase === "rebound" ? 6 : 4,
        totalRetries: stuck ? 5 : blueprint.phase === "rebound" ? 3 : 1,
        consecutiveCorrect: paceBand === "fast" ? 2 : 0,
        consecutiveWrong: stuck ? 3 : 1,
        lastDifficultyLevel: blueprint.phase === "breakthrough" ? 3 : 2,
        latestBlocker: stuck ? "Accuracy remains below target." : "",
        prerequisiteFallbackSkillId: "",
        createdAt: makeIstDate(pastDayStrings[Math.max(0, (blueprint.unlockByDay ?? 7) - 1)], 18, 25),
        updatedAt: lastPracticeStamp
      });
    }

    const chapterOneScores = CHAPTER_ONE_SCORE_MAP[blueprint.phase];
    const chapterTwoScores = CHAPTER_TWO_SCORE_MAP[blueprint.phase];

    pastDayStrings.forEach((dayString, dayIndex) => {
      const onChapterTwo = currentChapterNumber === 2 && blueprint.unlockByDay && dayIndex >= blueprint.unlockByDay - 1;
      const chapter = onChapterTwo ? chapterTwo : chapterOne;
      const variants = onChapterTwo ? chapterTwoVariants : chapterOneVariants;
      const scorePercent = onChapterTwo
        ? chapterTwoScores[Math.min(dayIndex - (blueprint.unlockByDay - 1), chapterTwoScores.length - 1)]
        : chapterOneScores[Math.min(dayIndex, chapterOneScores.length - 1)];
      const taskPlanId = new ObjectId();
      const taskAssignmentId = new ObjectId();
      const submissionId = new ObjectId();
      const cycleIndex =
        onChapterTwo
          ? Math.min(3, 1 + Math.floor((dayIndex - (blueprint.unlockByDay - 1)) / 2))
          : Math.min(4, 1 + Math.floor(dayIndex / 3));
      const assignedAt = makeIstDate(dayString, 7 + (index % 2), 10 + (dayIndex % 20));
      const startedAt = makeIstDate(dayString, 18, 5 + (index % 8));
      const completedAt = new Date(startedAt.getTime() + (10 + dayIndex) * 60000);
      const practiceItems = pickPracticeItems(variants);
      const answers = buildSubmissionAnswers(variants, scorePercent, dayIndex);
      const coveredTopics = [...new Set(variants.map((variant) => variant.topic).filter(Boolean))];

      taskPlanDocs.push({
        _id: taskPlanId,
        schoolId,
        classroomId: classroom._id,
        studentId,
        teacherId: teacher._id,
        pathId,
        conceptId: chapter.concept._id,
        conceptCode: chapter.concept.code,
        conceptName: chapter.concept.name,
        chapterNumber: chapter.chapterNumber,
        cycleIndex,
        autoAssigned: true,
        masteryTarget: 0.8,
        unlocksNextChapter: false,
        status: "completed",
        paceBand: onChapterTwo ? paceBand : currentChapterNumber === 1 ? paceBand : "on_track",
        confidenceBand: onChapterTwo ? confidenceBand : currentChapterNumber === 1 ? confidenceBand : "high",
        targetDifficulty: chapter.chapterNumber === 1 ? 2 : 3,
        rationale: [
          `Stay on Chapter ${chapter.chapterNumber} until mastery is secure.`,
          `${chapter.concept.name} is the current focus for this batch.`
        ],
        rationaleTags: [`chapter ${chapter.chapterNumber}`, paceBand.replace("_", " ")],
        narrativeSummary: `${blueprint.fullName} is practicing ${chapter.concept.name} through a focused mastery batch.`,
        generatedAt: new Date(assignedAt.getTime() - 5 * 60000),
        coveredTopics,
        coverageScore: Number((0.62 + ((dayIndex + index) % 3) * 0.08).toFixed(2)),
        conceptQueue: [
          {
            conceptId: chapter.concept._id,
            code: chapter.concept.code,
            name: chapter.concept.name,
            mastery: Number(((chapter.chapterNumber === 1 ? chapterOneMasteryPercent : chapterTwoMasteryPercent) / 100).toFixed(2))
          }
        ],
        lesson: {
          title: `${chapter.concept.name} warm-up`,
          body: `Work through the core idea of ${chapter.concept.name.toLowerCase()} and clear the checkpoint before moving ahead.`
        },
        practiceItems,
        completedAt,
        createdAt: assignedAt,
        updatedAt: completedAt
      });

      taskAssignmentDocs.push({
        _id: taskAssignmentId,
        schoolId,
        classroomId: classroom._id,
        studentId,
        teacherId: teacher._id,
        pathId,
        taskPlanId,
        chapterNumber: chapter.chapterNumber,
        cycleIndex,
        autoAssigned: true,
        status: "completed",
        assignedForDate: dayString,
        assignedAt,
        startedAt,
        completedAt,
        submittedAt: completedAt,
        createdAt: assignedAt,
        updatedAt: completedAt
      });

      submissionDocs.push({
        _id: submissionId,
        schoolId,
        assessmentId: null,
        studentId,
        classroomId: classroom._id,
        answers,
        scorePercent,
        sourceType: dayIndex % 2 === 0 ? "checkpoint" : "practice",
        createdAt: completedAt,
        updatedAt: completedAt
      });

      activityDocs.push({
        _id: new ObjectId(),
        schoolId,
        userId: studentId,
        userRole: "student",
        eventType: "student_task_submission",
        occurredAt: completedAt,
        sessionId: `presentation-session-${studentId}-${dayIndex}`,
        context: {
          classroomId: classroom._id,
          studentId,
          conceptId: chapter.concept._id,
          submissionId,
          scorePercent,
          mastery: Number(((chapter.chapterNumber === 1 ? chapterOneMasteryPercent : chapterTwoMasteryPercent) / 100).toFixed(2)),
          durationSeconds: 11 + dayIndex
        },
        metadata: {
          userAgent: "presentation-seed",
          apiVersion: "v1"
        },
        createdAt: completedAt,
        updatedAt: completedAt
      });
    });

    const activeVariants = currentChapterNumber === 2 ? chapterTwoVariants : chapterOneVariants;
    const activeTaskPlanId = new ObjectId();
    const activeAssignmentId = new ObjectId();
    const activeAssignedAt = makeIstDate(todayDate, 7, 50 + (index % 8));

    taskPlanDocs.push({
      _id: activeTaskPlanId,
      schoolId,
      classroomId: classroom._id,
      studentId,
      teacherId: teacher._id,
      pathId,
      conceptId: currentConcept._id,
      conceptCode: currentConcept.code,
      conceptName: currentConcept.name,
      chapterNumber: currentChapterNumber,
      cycleIndex: currentCycleIndex,
      autoAssigned: true,
      masteryTarget: 0.8,
      unlocksNextChapter: false,
      status: "assigned",
      paceBand,
      confidenceBand,
      targetDifficulty: currentChapterNumber === 1 ? 2 : 3,
      rationale: [
        `Today's milestone is ${milestone.start}% -> ${milestone.goal}%.`,
        `Stay with ${currentConcept.name} until mastery is strong enough to unlock the next chapter.`
      ],
      rationaleTags: [`chapter ${currentChapterNumber}`, paceBand.replace("_", " "), confidenceBand],
      narrativeSummary: `${blueprint.fullName} is continuing ${currentConcept.name} with a live batch tuned to the current pace and confidence profile.`,
      generatedAt: new Date(activeAssignedAt.getTime() - 4 * 60000),
      coveredTopics: [...new Set(activeVariants.map((variant) => variant.topic).filter(Boolean))],
      coverageScore: 0.74,
      conceptQueue: [
        {
          conceptId: currentConcept._id,
          code: currentConcept.code,
          name: currentConcept.name,
          mastery: Number((currentMasteryPercent / 100).toFixed(2))
        }
      ],
      lesson: {
        title: `${currentConcept.name} live mission`,
        body: `Clear this focused batch to keep today's mastery target moving toward ${milestone.goal}%.`
      },
      practiceItems: pickPracticeItems(activeVariants),
      createdAt: activeAssignedAt,
      updatedAt: activeAssignedAt
    });

    taskAssignmentDocs.push({
      _id: activeAssignmentId,
      schoolId,
      classroomId: classroom._id,
      studentId,
      teacherId: teacher._id,
      pathId,
      taskPlanId: activeTaskPlanId,
      chapterNumber: currentChapterNumber,
      cycleIndex: currentCycleIndex,
      autoAssigned: true,
      status: "assigned",
      assignedForDate: todayDate,
      assignedAt: activeAssignedAt,
      createdAt: activeAssignedAt,
      updatedAt: activeAssignedAt
    });

    insightDocs.push({
      _id: new ObjectId(),
      schoolId,
      userId: studentId,
      role: "student",
      snapshotType: "progress",
      summary: `${currentConcept.name} is active at ${currentMasteryPercent}% mastery with today's milestone aiming for ${milestone.goal}%.`,
      highlights: [
        `Current chapter: ${currentChapterNumber} - ${currentConcept.name}`,
        `Daily milestone: ${milestone.start}% to ${milestone.goal}%`,
        `Pace: ${paceBand.replace("_", " ")}`
      ],
      signalSummary: {
        weakestConcepts: [currentConcept.name],
        paceProfile: paceBand,
        confidenceProfile: confidenceBand,
        nextBlocker: stuck ? "Needs another low-difficulty checkpoint run." : "",
        masteryLiftPercent: Math.max(8, currentMasteryPercent - milestone.start)
      },
      context: {
        classroomId: classroom._id,
        studentId,
        conceptId: currentConcept._id,
        taskPlanId: activeTaskPlanId
      },
      createdAt: makeIstDate(todayDate, 8, 40 + (index % 8)),
      updatedAt: makeIstDate(todayDate, 8, 40 + (index % 8))
    });

    activityDocs.push({
      _id: new ObjectId(),
      schoolId,
      userId: teacher._id,
      userRole: "teacher",
      eventType: "teacher_task_assignment_created",
      occurredAt: activeAssignedAt,
      sessionId: `presentation-teacher-${teacher._id}-${index}`,
      context: {
        classroomId: classroom._id,
        studentId,
        conceptId: currentConcept._id,
        details: `seeded live assignment for ${blueprint.fullName}`
      },
      metadata: {
        userAgent: "presentation-seed",
        apiVersion: "v1"
      },
      createdAt: activeAssignedAt,
      updatedAt: activeAssignedAt
    });
  }

  await School.create(schoolDoc);
  await User.insertMany(userDocs, { ordered: true });
  await Classroom.insertMany(classroomDocs, { ordered: true });
  await QuestionVariant.insertMany(variantDocs, { ordered: true });
  await StudentLearningPath.insertMany(pathDocs, { ordered: true });
  await StudentConceptMastery.insertMany(masteryDocs, { ordered: true });
  await StudentConceptState.insertMany(conceptStateDocs, { ordered: true });
  await StudentTaskPlan.insertMany(taskPlanDocs, { ordered: true });
  await TaskAssignment.insertMany(taskAssignmentDocs, { ordered: true });
  await Submission.insertMany(submissionDocs, { ordered: true });
  await InsightSnapshot.insertMany(insightDocs, { ordered: true });
  await ActivityEvent.insertMany(activityDocs, { ordered: true });

  console.log("");
  console.log("Presentation demo data created successfully.");
  console.log(
    JSON.stringify(
      {
        school: DEMO.schoolName,
        teachers: teacherDocs.length,
        students: studentDocs.length,
        submissions: submissionDocs.length,
        openAssignments: studentDocs.length
      },
      null,
      2
    )
  );
  console.log("");
  console.log("Login credentials:");
  console.log(`  Admin:   ${DEMO.adminEmail} / ${DEMO.password}`);
  TEACHERS.forEach((teacher) => {
    console.log(`  Teacher: ${teacher.email} / ${DEMO.password}`);
  });
  console.log(`  Student: ${studentDocs[0].email} / ${DEMO.password}`);
}

main()
  .catch((error) => {
    console.error("Failed to seed presentation demo data.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
