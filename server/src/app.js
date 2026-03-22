import cors from "cors";
import express from "express";
import { hashPassword, requireAuth, signToken, verifyPassword } from "./auth.js";
import { config } from "./config.js";
import { connectDatabase } from "./db.js";
import { getSessionId, logActivityEvent } from "./eventCapture.js";
import {
  assignRecommendedIntervention,
  buildAdminSummary,
  buildTeacherReportData,
  buildTeacherDashboardData,
  ensureLearningSeedData,
  getPrerequisiteGapDiagnostics,
  getStudentPracticeRunner,
  getStudentRecommendations,
  getStudentSkillTimeline,
  getStudentNextSkillRecommendation,
  resolveQuestionMetadata,
  scoreAssessmentSubmission
} from "./learning.js";
import {
  assignTeacherTasks,
  getAdminPathRollup,
  getStudentPathView,
  getTeacherPathStatuses,
  buildAdminRollupInsights,
  buildTeacherStudentInsights,
  continueStudentTask,
  ensureQuestionTemplateCatalog,
  getStudentTodayTask,
  precomputeTeacherTasks,
  submitStudentTask
} from "./taskEngine.js";
import { hasOpenAIEnhancements } from "./aiService.js";
import {
  Assessment,
  ActivityEvent,
  Classroom,
  Concept,
  InsightSnapshot,
  InterventionAssignment,
  Question,
  QuestionTemplate,
  Skill,
  School,
  StudentConceptMastery,
  StudentLearningPath,
  Submission,
  TaskAssignment,
  User
} from "./models.js";

export const app = express();
let bootstrapPromise = null;

app.use(cors());
app.use(express.json());

["get", "post", "put", "patch", "delete"].forEach((method) => {
  const original = app[method].bind(app);
  app[method] = (path, ...handlers) =>
    original(
      path,
      ...handlers.map((handler) =>
        typeof handler === "function" && handler.length < 4
          ? (request, response, next) => Promise.resolve(handler(request, response, next)).catch(next)
          : handler
      )
    );
});

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function validateRuntimeConfig() {
  if (config.nodeEnv !== "production") {
    return;
  }

  if (!config.mongodbUri) {
    throw createHttpError(500, "MONGODB_URI is required in production.");
  }

  if (!config.jwtSecret || config.jwtSecret === "change-me") {
    throw createHttpError(500, "JWT_SECRET must be set to a non-default value in production.");
  }

  if (config.openaiEnableEnhancedGeneration && !config.openaiApiKey) {
    throw createHttpError(500, "OPENAI_API_KEY is required when enhanced generation is enabled.");
  }
}

function slugify(name) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function getValidatedClassroomStudents({ schoolId, classroomId, studentIds }) {
  const requestedIds = Array.isArray(studentIds) ? studentIds.map((item) => String(item)).filter(Boolean) : [];
  const query = {
    schoolId,
    role: "student",
    classroomId
  };

  if (requestedIds.length > 0) {
    query._id = { $in: requestedIds };
  }

  return User.find(query).select("_id fullName classroomId").lean();
}

function serializeQuestion(question) {
  return {
    _id: question._id,
    prompt: question.prompt,
    questionType: question.questionType,
    options: question.options ?? [],
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
    difficultyLevel: question.difficultyLevel,
    conceptIds: (question.conceptIds ?? []).map((concept) => ({
      _id: concept._id,
      name: concept.name,
      gradeLevel: concept.gradeLevel,
      code: concept.code
    })),
    gradeLevel: question.gradeLevel,
    topic: question.topic ?? "",
    reviewStatus: question.reviewStatus ?? "draft",
    approvedForGeneration: Boolean(question.approvedForGeneration),
    questionSource: question.questionSource ?? "teacher",
    teacherNotes: question.teacherNotes ?? "",
    expectedTimeSec: question.expectedTimeSec ?? 60,
    createdAt: question.createdAt,
    updatedAt: question.updatedAt
  };
}

function serializeReferenceQuestion(template) {
  return {
    _id: template._id,
    templateKey: template.templateKey,
    source: template.source,
    chapterNumber: template.chapterNumber,
    code: template.code,
    chapterName: template.chapterName,
    standard: template.standard ?? "",
    skillId: template.skillId ?? "",
    gradeLevel: template.gradeLevel,
    topic: template.topic ?? "",
    questionIndex: template.questionIndex,
    prompt: template.prompt,
    questionType: template.questionType,
    options: template.options ?? [],
    correctAnswer: template.correctAnswer,
    explanation: template.explanation,
    difficultyLevel: template.difficultyLevel,
    expectedTimeSec: template.expectedTimeSec ?? 60,
    hintWeight: template.hintWeight ?? 1,
    lessonSummary: template.lessonSummary ?? "",
    practiceFocus: template.practiceFocus ?? "",
    checkpointGoal: template.checkpointGoal ?? ""
  };
}

function serializeTaskPlan(plan) {
  return {
    _id: plan._id,
    studentId: plan.studentId,
    classroomId: plan.classroomId,
    pathId: plan.pathId ?? null,
    conceptId: plan.conceptId,
    conceptCode: plan.conceptCode,
    conceptName: plan.conceptName,
    chapterNumber: plan.chapterNumber ?? null,
    cycleIndex: plan.cycleIndex ?? 1,
    autoAssigned: Boolean(plan.autoAssigned),
    masteryTarget: Math.round((plan.masteryTarget ?? 0.8) * 100),
    unlocksNextChapter: Boolean(plan.unlocksNextChapter),
    status: plan.status,
    paceBand: plan.paceBand,
    confidenceBand: plan.confidenceBand,
    targetDifficulty: plan.targetDifficulty,
    rationale: plan.rationale ?? [],
    rationaleTags: plan.rationaleTags ?? [],
    narrativeSummary: plan.narrativeSummary ?? "",
    coveredTopics: plan.coveredTopics ?? [],
    coverageScore: plan.coverageScore ?? 0,
    conceptQueue: plan.conceptQueue ?? [],
    lesson: plan.lesson ?? null,
    items: (plan.practiceItems ?? [])
      .sort((left, right) => left.order - right.order)
      .map((item) => ({
        order: item.order,
        stage: item.stage,
        sourceKind: item.sourceKind,
        variantId: item.variantId?._id ?? item.variantId,
        prompt: item.variantId?.prompt ?? "",
        questionType: item.variantId?.questionType ?? "numeric",
        options: item.variantId?.options ?? [],
        difficultyLevel: item.variantId?.difficultyLevel ?? item.difficultyLevel ?? 1,
        expectedTimeSec: item.variantId?.expectedTimeSec ?? 60,
        hint: item.variantId?.aiSupport?.hint ?? "",
        explanation: item.variantId?.aiSupport?.explanation ?? "",
        generationMethod: item.variantId?.generationMethod ?? "template_copy",
        sourceReference: {
          templateQuestionId: item.variantId?.templateQuestionId ?? null,
          sourceQuestionId: item.variantId?.sourceQuestionId ?? null,
          chapterCode: item.variantId?.chapterCode ?? "",
          topic: item.variantId?.topic ?? ""
        }
      }))
  };
}

async function buildDashboard(role, auth) {
  if (role === "teacher") {
    const classrooms = await Classroom.find({ schoolId: auth.schoolId, teacherId: auth.sub }).lean();
    const pathStatus = await getTeacherPathStatuses({ schoolId: auth.schoolId, teacherId: auth.sub });
    const upcomingAssignments = await TaskAssignment.find({ schoolId: auth.schoolId, teacherId: auth.sub })
      .sort({ assignedAt: -1 })
      .limit(12)
      .lean();
    const chapterConcepts = Array.from(
      pathStatus.students.reduce((map, student) => {
        const key = `${student.currentChapterNumber ?? 0}:${student.currentChapterName}`;
        if (!map.has(key)) {
          map.set(key, {
            name: `Chapter ${student.currentChapterNumber ?? "-"} - ${student.currentChapterName}`,
            summary: "Students currently locked to this chapter.",
            band: student.status === "stuck" ? "Critical" : student.status === "completed" ? "Stable" : "Active",
            studentsFlagged: 0
          });
        }
        map.get(key).studentsFlagged += 1;
        return map;
      }, new Map()).values()
    );

    return {
      classrooms: classrooms.map((item) => ({
        id: item._id,
        name: item.name,
        gradeLevel: item.gradeLevel
      })),
      summaryCards: pathStatus.metrics,
      pathStatuses: pathStatus.students,
      flaggedStudents: pathStatus.students.map((student) => ({
        studentId: student.studentId,
        classroomId: student.classroomId,
        name: student.name,
        risk: student.riskLabel ?? "Low",
        riskReason: student.riskReason ?? "",
        weakConcepts: student.currentChapterName ? [student.currentChapterName] : [],
        lastActive: student.lastPracticedAt || student.latestAssignmentDate || "",
        dailyMasteryStart: student.dailyMasteryStart ?? 0,
        dailyMasteryGoal: student.dailyMasteryGoal ?? 0,
        dailyTargetDate: student.dailyTargetDate ?? "",
        dailyTargetStatus: student.dailyTargetStatus ?? "in_progress"
      })),
      classConcepts: chapterConcepts,
      skillHeatmap: [],
      skillAlerts: pathStatus.students
        .filter((student) => student.status === "stuck")
        .map((student) => ({
          studentId: student.studentId,
          skillId: `Chapter ${student.currentChapterNumber ?? "-"}`,
          message: `${student.name} is still below ${Math.round(80)}% mastery in ${student.currentChapterName}.`
        })),
      roster: pathStatus.students.map((student) => ({
        studentId: student.studentId,
        classroomId: student.classroomId,
        name: student.name,
        attendance: 92,
        mastery: student.currentMastery,
        status:
          student.status === "completed"
            ? "Completed path"
            : student.status === "stuck"
              ? "Needs support"
              : student.status === "not_started"
                ? "Not started"
                : student.riskLevel === "medium" || student.riskLevel === "high"
                  ? "Monitor"
                  : "Stable"
      })),
      weekPlan: [
        { day: "Mon", focus: "Start or resume class paths", note: "Teacher only needs to activate learners once." },
        { day: "Wed", focus: "Monitor stuck students", note: "System keeps refilling same-chapter practice until mastery is reached." },
        { day: "Fri", focus: "Check chapter unlocks", note: "Review who moved forward and who still needs support." }
      ],
      assignments: upcomingAssignments.map((assignment) => ({
        concept: `Chapter ${assignment.chapterNumber ?? "-"}`,
        title: assignment.autoAssigned ? "Auto-served batch" : "Teacher-started batch",
        description: `Assigned for ${assignment.assignedForDate}`,
        questions: 0,
        status: assignment.status
      })),
      bankStatus: chapterConcepts.map((concept) => `${concept.name}: ${concept.studentsFlagged} students currently active here.`)
    };
  }

  if (role === "student") {
    const pathView = await getStudentPathView({ schoolId: auth.schoolId, studentId: auth.sub });
    const todayTask = pathView.openTask ?? (await getStudentTodayTask({ schoolId: auth.schoolId, studentId: auth.sub }));
    const latestBatch = pathView.latestBatch ?? null;
    return {
      recommendations: [],
      practiceQueue: todayTask
        ? [
            {
              concept: todayTask.concept.name,
              title: `Chapter ${todayTask.chapterNumber} mastery batch`,
              description: todayTask.narrativeSummary || todayTask.rationale?.[0] || "Keep working until this chapter reaches mastery.",
              questions: todayTask.items.length,
              difficulty: `Difficulty ${todayTask.targetDifficulty}`
            }
          ]
        : [],
      checkpoints: pathView.currentChapterNumber
        ? [
            {
              when: "Current",
              title: `Chapter ${pathView.currentChapterNumber} checkpoint`,
              goal: "Reach 80% mastery and pass checkpoint to unlock the next chapter."
            }
          ]
        : [],
      mastery: pathView.chapterLadder.map((item) => ({
        concept: `Chapter ${item.chapterNumber} - ${item.name}`,
        mastery: item.mastery
      })),
      recentResults: pathView.recentResults.map((item) => ({
        id: item.id,
        title: item.title,
        score: item.score,
        createdAt: item.createdAt
      })),
      assignmentSummary: todayTask
        ? {
            status: todayTask.assignmentStatus ?? pathView.latestAssignmentStatus,
            assignedForDate: todayTask.assignedForDate,
            concept: `Chapter ${todayTask.chapterNumber} - ${todayTask.concept.name}`,
            itemsCount: todayTask.items.length,
            targetDifficulty: todayTask.targetDifficulty,
            paceBand: todayTask.paceBand,
            chapterNumber: todayTask.chapterNumber,
            currentMastery: pathView.currentMastery,
            masteryTarget: 80,
            todayTargetStatus: pathView.dailyTargetStatus,
            dailyMasteryStart: pathView.dailyMasteryStart,
            dailyMasteryGoal: pathView.dailyMasteryGoal,
            dailyTargetDate: pathView.dailyTargetDate,
            coveredTopics: todayTask.coveredTopics ?? [],
            coverageScore: todayTask.coverageScore ?? 0
          }
        : latestBatch
          ? {
              status: latestBatch.status,
              assignedForDate: latestBatch.assignedForDate,
              concept: `Chapter ${latestBatch.chapterNumber} - ${latestBatch.concept}`,
              itemsCount: latestBatch.itemsCount,
              targetDifficulty: latestBatch.targetDifficulty,
              chapterNumber: latestBatch.chapterNumber,
              currentMastery: pathView.currentMastery,
              masteryTarget: 80,
              todayTargetStatus: pathView.dailyTargetStatus,
              dailyMasteryStart: pathView.dailyMasteryStart,
              dailyMasteryGoal: pathView.dailyMasteryGoal,
              dailyTargetDate: pathView.dailyTargetDate
            }
        : null,
      assignmentHistory: pathView.assignmentHistory,
      latestBatch,
      studentInsight: {
        summary: pathView.summary,
        highlights: pathView.highlights
      },
      coachNote:
        pathView.status === "completed"
          ? "You have completed the Class 10 chapter path."
          : `You stay on Chapter ${pathView.currentChapterNumber ?? "-"} until mastery reaches 80% and checkpoint is passed.`,
      learningPath: {
        status: pathView.status,
        currentChapterNumber: pathView.currentChapterNumber,
        currentChapterName: pathView.currentChapterName,
        currentMastery: pathView.currentMastery,
        completedChaptersCount: pathView.completedChaptersCount,
        totalChapters: pathView.totalChapters,
        dailyTargetStatus: pathView.dailyTargetStatus,
        dailyMasteryStart: pathView.dailyMasteryStart,
        dailyMasteryGoal: pathView.dailyMasteryGoal,
        dailyTargetDate: pathView.dailyTargetDate,
        dailyGoalReachedAt: pathView.dailyGoalReachedAt,
        milestoneCompletedToday: pathView.milestoneCompletedToday,
        canContinuePractice: pathView.canContinuePractice,
        chapterLadder: pathView.chapterLadder
      },
      todayTask
    };
  }

  if (role === "parent") {
    const parent = await User.findOne({ _id: auth.sub, schoolId: auth.schoolId, role: "parent" }).lean();
    const linkedStudentIds = parent?.parentStudentIds ?? [];
    const linkedStudents = await User.find({ _id: { $in: linkedStudentIds }, schoolId: auth.schoolId, role: "student" }).lean();
    const linkedStudentViews = await Promise.all(
      linkedStudents.map(async (student) => {
        const pathView = await getStudentPathView({ schoolId: auth.schoolId, studentId: student._id });
        return {
          id: student._id,
          name: student.fullName,
          gradeLevel: student.gradeLevel,
          status: pathView.status,
          averageMastery: pathView.currentMastery,
          weakConcepts: pathView.currentMastery < 80 ? [{ concept: pathView.currentChapterName, mastery: pathView.currentMastery }] : [],
          latestAssignmentStatus: pathView.latestAssignmentStatus,
          currentConcept: `Chapter ${pathView.currentChapterNumber ?? "-"} - ${pathView.currentChapterName}`,
          assignedForDate: pathView.latestAssignmentDate,
          itemsCount: pathView.currentTaskItemsCount,
          lastScore: pathView.latestScore,
          summary: pathView.summary,
          completedChaptersCount: pathView.completedChaptersCount,
          todayTargetStatus: pathView.dailyTargetStatus,
          dailyMasteryStart: pathView.dailyMasteryStart,
          dailyMasteryGoal: pathView.dailyMasteryGoal,
          dailyTargetDate: pathView.dailyTargetDate
        };
      })
    );
    const activeAssignments = linkedStudentViews.filter((student) => ["assigned", "started"].includes(student.latestAssignmentStatus)).length;
    const averageMasteryAcrossStudents = linkedStudentViews.length
      ? Math.round(linkedStudentViews.reduce((sum, student) => sum + student.averageMastery, 0) / linkedStudentViews.length)
      : 0;
    const assignmentOverview = [
      { label: "Working", value: linkedStudentViews.filter((student) => student.status === "working").length },
      { label: "Stuck", value: linkedStudentViews.filter((student) => student.status === "stuck").length },
      { label: "Completed", value: linkedStudentViews.filter((student) => student.status === "completed").length }
    ];

    return {
      linkedStudents: linkedStudentViews,
      summaryCards: [
        { label: "Students linked", value: String(linkedStudents.length) },
        { label: "Active batches", value: String(activeAssignments) },
        { label: "Current mastery", value: `${averageMasteryAcrossStudents}%` },
        { label: "Completed chapters", value: String(linkedStudentViews.reduce((sum, student) => sum + student.completedChaptersCount, 0)) }
      ],
      weakAreas: linkedStudentViews
        .flatMap((student) =>
          student.weakConcepts.map((concept) => ({
            studentId: student.id,
            studentName: student.name,
            concept: concept.concept,
            mastery: concept.mastery
          }))
        )
        .slice(0, 8),
      assignmentOverview,
      progressByStudent: linkedStudentViews.map((student) => ({
        label: student.name,
        value: student.averageMastery,
        color: student.averageMastery >= 80 ? "#16a34a" : student.averageMastery >= 50 ? "#f59e0b" : "#dc2626"
      })),
      dailyProgress: linkedStudentViews
        .filter((student) => student.lastScore != null)
        .map((student) => ({
          studentId: student.id,
          studentName: student.name,
          title: student.currentConcept,
          score: student.lastScore,
          createdAt: new Date().toISOString()
        })),
      suggestions: linkedStudentViews.slice(0, 5).map((student) => student.summary)
    };
  }

  const pathRollup = await getAdminPathRollup({ schoolId: auth.schoolId });
  const rollupInsights = await buildAdminRollupInsights({ schoolId: auth.schoolId });
  const [schools, teachers, classrooms, students] = await Promise.all([
    School.find({ _id: auth.schoolId }).sort({ createdAt: -1 }).lean(),
    User.find({ schoolId: auth.schoolId, role: "teacher" }).select("_id fullName email").lean(),
    Classroom.find({ schoolId: auth.schoolId }).select("_id name gradeLevel teacherId").lean(),
    User.find({ schoolId: auth.schoolId, role: "student" }).select("_id").lean()
  ]);
  return {
    metrics: pathRollup.metrics,
    summaryCards: [
      { label: "Teachers", value: String(teachers.length) },
      { label: "Classrooms", value: String(classrooms.length) },
      { label: "Students", value: String(students.length) },
      { label: "Behind target", value: String(pathRollup.studentsBehindTarget ?? 0) }
    ],
    schools: schools.map((school) => ({
      name: school.name,
      owner: school.adminName,
      stage: "Live",
      assignments: `Avg chapter ${pathRollup.metrics[2]?.value ?? "0"}`,
      nextStep: `${pathRollup.studentsBehindTarget ?? 0} learners need closer milestone follow-up`
    })),
    pulse: [
      {
        title: "Average chapter reached",
        detail: `${pathRollup.metrics[2]?.value ?? "0"} is the average chapter currently reached across the school.`
      },
      {
        title: "Students stuck",
        detail: `${pathRollup.metrics[1]?.value ?? "0"} students are still repeating the same chapter cycle.`
      },
      {
        title: "Behind target",
        detail: `${pathRollup.studentsBehindTarget ?? 0} learners are behind their dated daily mastery milestone.`
      }
    ],
    riskDistribution: pathRollup.riskDistribution,
    milestoneDistribution: pathRollup.milestoneDistribution,
    chapterDistribution: pathRollup.chapterDistribution,
    classroomRollup: pathRollup.classroomRollup,
    students: pathRollup.students,
    insightSummary: rollupInsights.summary,
    insightHighlights: rollupInsights.highlights,
    buyerNotes: rollupInsights.highlights
  };
}

app.get("/api/health", (_request, response) => {
  response.json({ ok: true });
});

app.get("/api/ai/status", requireAuth("admin", "teacher"), (_request, response) => {
  response.json({
    enabled: hasOpenAIEnhancements(),
    configured: Boolean(config.openaiApiKey),
    models: {
      variant: config.openaiVariantModel,
      insight: config.openaiInsightModel,
      embeddings: config.openaiEmbeddingModel
    }
  });
});

app.post("/api/auth/register-school", async (request, response) => {
  const { schoolName, adminName, email, password, timezone } = request.body;

  if (!schoolName || !adminName || !email || !password) {
    response.status(400).json({ message: "schoolName, adminName, email, and password are required." });
    return;
  }

  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    response.status(409).json({ message: "An account with this email already exists." });
    return;
  }

  const school = await School.create({
    name: schoolName,
    slug: `${slugify(schoolName)}-${Date.now().toString().slice(-4)}`,
    adminName,
    adminEmail: email.toLowerCase(),
    timezone: timezone || "Asia/Kolkata"
  });

  const admin = await User.create({
    schoolId: school._id,
    role: "admin",
    fullName: adminName,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password)
  });

  const token = signToken(admin);
  response.status(201).json({
    token,
    user: {
      id: admin._id,
      role: admin.role,
      fullName: admin.fullName,
      email: admin.email,
      schoolId: school._id
    }
  });
});

app.post("/api/auth/login", async (request, response) => {
  const { email, password, role } = request.body;

  const user = await User.findOne({ email: email?.toLowerCase() });
  if (!user || !(await verifyPassword(password || "", user.passwordHash))) {
    response.status(401).json({ message: "Invalid email or password." });
    return;
  }

  if (role && user.role !== role) {
    response.status(403).json({ message: "This account does not belong to the selected portal." });
    return;
  }

  const token = signToken(user);
  await logActivityEvent({
    schoolId: user.schoolId,
    userId: user._id,
    userRole: user.role,
    eventType: "auth_login_succeeded",
    sessionId: getSessionId({ headers: request.headers, auth: { sub: user._id } }),
    context: {
      details: `Logged in as ${user.role}`
    },
    metadata: {
      userAgent: request.headers["user-agent"]
    }
  });
  response.json({
    token,
    user: {
      id: user._id,
      role: user.role,
      fullName: user.fullName,
      email: user.email,
      schoolId: user.schoolId
    }
  });
});

app.get("/api/auth/me", requireAuth("admin", "teacher", "student", "parent"), async (request, response) => {
  const user = await User.findById(request.auth.sub).lean();
  response.json({ user });
});

app.get("/api/catalog/concepts", requireAuth("admin", "teacher", "student", "parent"), async (_request, response) => {
  const concepts = await Concept.find().sort({ gradeLevel: 1, name: 1 }).lean();
  response.json({ concepts });
});

app.get("/api/catalog/reference-questions", requireAuth("admin", "teacher"), async (request, response) => {
  const { gradeLevel, chapterCode, q, topic, limit, templateId } = request.query;
  const query = { active: true };

  if (templateId) {
    query._id = templateId;
  }

  if (gradeLevel) {
    query.gradeLevel = String(gradeLevel);
  }

  if (chapterCode) {
    query.code = String(chapterCode);
  }

  if (topic) {
    query.topic = { $regex: String(topic), $options: "i" };
  }

  if (q) {
    query.$or = [
      { prompt: { $regex: String(q), $options: "i" } },
      { topic: { $regex: String(q), $options: "i" } },
      { chapterName: { $regex: String(q), $options: "i" } },
      { code: { $regex: String(q), $options: "i" } }
    ];
  }

  const parsedLimit = Number.parseInt(String(limit ?? "60"), 10);
  const safeLimit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 250) : 60;
  const referenceQuestions = await QuestionTemplate.find(query)
    .sort({ chapterNumber: 1, questionIndex: 1 })
    .limit(safeLimit)
    .lean();

  response.json({ referenceQuestions: referenceQuestions.map(serializeReferenceQuestion) });
});

app.post("/api/parents", requireAuth("admin", "teacher"), async (request, response) => {
  const { fullName, email, password, parentStudentIds = [] } = request.body;

  if (!fullName || !email || !password) {
    response.status(400).json({ message: "fullName, email, and password are required." });
    return;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    response.status(409).json({ message: "A user with this email already exists." });
    return;
  }

  const parent = await User.create({
    schoolId: request.auth.schoolId,
    role: "parent",
    fullName,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    parentStudentIds
  });

  response.status(201).json({ parent });
});

app.get("/api/catalog/questions", requireAuth("admin", "teacher"), async (request, response) => {
  const { gradeLevel, reviewStatus, q, generationReady } = request.query;
  const query = {
    $or: [{ schoolId: null }, { schoolId: request.auth.schoolId }]
  };

  if (gradeLevel) {
    query.gradeLevel = String(gradeLevel);
  }

  if (reviewStatus) {
    query.reviewStatus = String(reviewStatus);
  }

  if (generationReady === "true") {
    query.approvedForGeneration = true;
  }

  if (q) {
    query.prompt = { $regex: String(q), $options: "i" };
  }

  const questions = await Question.find(query).populate("conceptIds").sort({ updatedAt: -1, createdAt: -1 }).lean();
  response.json({ questions: questions.map(serializeQuestion) });
});

app.post("/api/catalog/questions", requireAuth("admin", "teacher"), async (request, response) => {
  const {
    conceptIds = [],
    prompt,
    questionType,
    options = [],
    correctAnswer,
    explanation,
    difficultyLevel,
    expectedTimeSec,
    hintWeight,
    topic,
    teacherNotes
  } = request.body;

  const optionBasedTypes = new Set(["mcq"]);
  const allowedQuestionTypes = new Set(["mcq", "numeric", "short_answer", "fill_blank", "true_false", "case_study"]);

  if (!Array.isArray(conceptIds) || conceptIds.length === 0 || !prompt || !questionType || !correctAnswer || !explanation || !difficultyLevel) {
    response.status(400).json({ message: "conceptIds, prompt, questionType, correctAnswer, explanation, and difficultyLevel are required." });
    return;
  }

  if (!allowedQuestionTypes.has(questionType)) {
    response.status(400).json({ message: "Unsupported questionType." });
    return;
  }

  if (optionBasedTypes.has(questionType) && (!Array.isArray(options) || options.length < 2)) {
    response.status(400).json({ message: "Option-based questions require at least two options." });
    return;
  }

  const metadata = await resolveQuestionMetadata(conceptIds);
  if (metadata.concepts.length !== conceptIds.length) {
    response.status(400).json({ message: "One or more selected concepts are invalid." });
    return;
  }

  const question = await Question.create({
    schoolId: request.auth.schoolId,
    createdByUserId: request.auth.sub,
    conceptIds,
    skillId: metadata.skillId,
    gradeLevel: metadata.gradeLevel,
    topic: topic || metadata.concepts[0]?.name || "",
    prompt: String(prompt).trim(),
    questionType,
    options: optionBasedTypes.has(questionType) ? options.map((item) => String(item).trim()).filter(Boolean) : [],
    correctAnswer: String(correctAnswer).trim(),
    explanation: String(explanation).trim(),
    difficultyLevel: Number(difficultyLevel),
    expectedTimeSec: Number(expectedTimeSec || 60),
    hintWeight: Number(hintWeight || 1),
    reviewStatus: "in_review",
    approvedForGeneration: false,
    questionSource: "teacher",
    teacherNotes: String(teacherNotes || "")
  });

  const populated = await Question.findById(question._id).populate("conceptIds").lean();
  response.status(201).json({ question: serializeQuestion(populated) });
});

app.post("/api/catalog/questions/:questionId/review", requireAuth("admin", "teacher"), async (request, response) => {
  const { reviewStatus, approvedForGeneration, teacherNotes } = request.body;
  const question = await Question.findOne({
    _id: request.params.questionId,
    schoolId: request.auth.schoolId
  });

  if (!question) {
    response.status(404).json({ message: "Question not found in this school workspace." });
    return;
  }

  if (reviewStatus) {
    question.reviewStatus = reviewStatus;
  }

  if (typeof approvedForGeneration === "boolean") {
    question.approvedForGeneration = approvedForGeneration;
  } else if (reviewStatus === "approved") {
    question.approvedForGeneration = true;
  }

  if (typeof teacherNotes === "string") {
    question.teacherNotes = teacherNotes;
  }

  await question.save();
  const populated = await Question.findById(question._id).populate("conceptIds").lean();
  response.json({ question: serializeQuestion(populated) });
});

app.post("/api/teacher/ai-packs/preview", requireAuth("teacher"), async (request, response) => {
  const {
    classroomId,
    gradeLevel = "10",
    conceptId,
    packType = "practice",
    questionCount = 8
  } = request.body;

  if (classroomId) {
    const classroom = await Classroom.findOne({
      _id: classroomId,
      schoolId: request.auth.schoolId,
      teacherId: request.auth.sub
    }).lean();

    if (!classroom) {
      response.status(404).json({ message: "Classroom not found." });
      return;
    }
  }

  const count = Math.min(Math.max(Number(questionCount) || 8, 3), 20);
  const query = {
    schoolId: request.auth.schoolId,
    gradeLevel: String(gradeLevel),
    reviewStatus: "approved",
    approvedForGeneration: true
  };

  if (conceptId) {
    query.conceptIds = conceptId;
  }

  const approvedQuestions = await Question.find(query).populate("conceptIds").lean();
  const sortedQuestions = approvedQuestions.sort((left, right) => {
    if (packType === "homework") {
      return right.difficultyLevel - left.difficultyLevel;
    }
    return left.difficultyLevel - right.difficultyLevel;
  });

  const selectedQuestions = sortedQuestions.slice(0, count);
  const coverage = [...new Set(selectedQuestions.flatMap((question) => question.conceptIds.map((concept) => concept.name)))];

  response.json({
    pack: {
      title: `${gradeLevel} ${packType === "homework" ? "Homework" : "Practice"} Draft`,
      packType,
      gradeLevel: String(gradeLevel),
      questionCount: selectedQuestions.length,
      requestedCount: count,
      readiness: approvedQuestions.length >= count ? "ready" : "partial",
      rationale:
        approvedQuestions.length >= count
          ? "Only teacher-approved questions were selected for this draft."
          : "There are not enough approved questions yet, so this draft is only partially filled.",
      coverage,
      questions: selectedQuestions.map((question) => serializeQuestion(question))
    }
  });
});

app.get("/api/teacher/tasks/recommendations", requireAuth("teacher"), async (request, response) => {
  const { classroomId, studentIds = "" } = request.query;
  if (!classroomId) {
    response.status(400).json({ message: "classroomId is required." });
    return;
  }

  const classroom = await Classroom.findOne({
    _id: classroomId,
    schoolId: request.auth.schoolId,
    teacherId: request.auth.sub
  }).lean();

  if (!classroom) {
    response.status(404).json({ message: "Classroom not found." });
    return;
  }

  const selectedStudentIds = String(studentIds)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const validStudents = await getValidatedClassroomStudents({
    schoolId: request.auth.schoolId,
    classroomId,
    studentIds: selectedStudentIds
  });
  const fallbackStudents =
    selectedStudentIds.length > 0
      ? validStudents
      : await User.find({ schoolId: request.auth.schoolId, role: "student", classroomId }).select("_id").lean();

  if (selectedStudentIds.length > 0 && validStudents.length !== selectedStudentIds.length) {
    response.status(400).json({ message: "One or more selected students do not belong to this classroom." });
    return;
  }

  if (fallbackStudents.length === 0) {
    response.json({ plans: [] });
    return;
  }

  const plans = [];
  for (const student of fallbackStudents) {
    const latestAssignment = await TaskAssignment.findOne({
      schoolId: request.auth.schoolId,
      classroomId,
      studentId: student._id,
      status: { $ne: "superseded" }
    })
      .sort({ assignedAt: -1 })
      .populate({
        path: "taskPlanId",
        populate: { path: "practiceItems.variantId" }
      });

    if (latestAssignment?.taskPlanId) {
      plans.push(latestAssignment.taskPlanId);
    }
  }

  response.json({ plans: plans.map((plan) => serializeTaskPlan(plan)) });
});

app.post("/api/teacher/tasks/precompute", requireAuth("teacher"), async (request, response) => {
  const { classroomId, studentIds = [], refresh = false } = request.body;

  if (!classroomId) {
    response.status(400).json({ message: "classroomId is required." });
    return;
  }

  const classroom = await Classroom.findOne({
    _id: classroomId,
    schoolId: request.auth.schoolId,
    teacherId: request.auth.sub
  }).lean();

  if (!classroom) {
    response.status(404).json({ message: "Classroom not found." });
    return;
  }

  const validStudents = await getValidatedClassroomStudents({
    schoolId: request.auth.schoolId,
    classroomId,
    studentIds
  });

  if (Array.isArray(studentIds) && studentIds.length > 0 && validStudents.length !== studentIds.length) {
    response.status(400).json({ message: "One or more selected students do not belong to this classroom." });
    return;
  }

  const targetStudentIds =
    validStudents.length > 0
      ? validStudents.map((student) => student._id.toString())
      : (await User.find({ schoolId: request.auth.schoolId, role: "student", classroomId }).select("_id").lean()).map((student) =>
          student._id.toString()
        );

  if (targetStudentIds.length === 0) {
    response.status(400).json({ message: "No students are available for precompute in this classroom." });
    return;
  }

  const plans = await precomputeTeacherTasks({
    schoolId: request.auth.schoolId,
    classroomId,
    teacherId: request.auth.sub,
    studentIds: targetStudentIds,
    refresh: Boolean(refresh)
  });

  response.status(201).json({ plans: plans.map((plan) => serializeTaskPlan(plan)) });
});

app.post("/api/teacher/tasks/assign", requireAuth("teacher"), async (request, response) => {
  const { classroomId, studentIds = [], assignedForDate } = request.body;

  if (!classroomId || !Array.isArray(studentIds) || studentIds.length === 0) {
    response.status(400).json({ message: "classroomId and at least one studentId are required." });
    return;
  }

  const classroom = await Classroom.findOne({
    _id: classroomId,
    schoolId: request.auth.schoolId,
    teacherId: request.auth.sub
  }).lean();

  if (!classroom) {
    response.status(404).json({ message: "Classroom not found." });
    return;
  }

  const validStudents = await getValidatedClassroomStudents({
    schoolId: request.auth.schoolId,
    classroomId,
    studentIds
  });

  if (validStudents.length !== studentIds.length) {
    response.status(400).json({ message: "One or more selected students do not belong to this classroom." });
    return;
  }

  const assigned = await assignTeacherTasks({
    schoolId: request.auth.schoolId,
    classroomId,
    teacherId: request.auth.sub,
    studentIds: validStudents.map((student) => student._id.toString()),
    assignedForDate: assignedForDate || new Date().toISOString().slice(0, 10)
  });

  response.status(201).json({
    assignments: assigned.map((entry) => ({
      assignmentId: entry.assignment._id,
      studentId: entry.assignment.studentId,
      assignedForDate: entry.assignment.assignedForDate,
      plan: serializeTaskPlan(entry.plan)
    }))
  });
});

app.get("/api/teacher/insights/students", requireAuth("teacher"), async (request, response) => {
  const classroomId = request.query.classroomId ? String(request.query.classroomId) : null;

  if (classroomId) {
    const classroom = await Classroom.findOne({
      _id: classroomId,
      schoolId: request.auth.schoolId,
      teacherId: request.auth.sub
    }).lean();

    if (!classroom) {
      response.status(404).json({ message: "Classroom not found." });
      return;
    }
  }

  const insights = await buildTeacherStudentInsights({
    schoolId: request.auth.schoolId,
    teacherId: request.auth.sub,
    classroomId
  });

  response.json(insights);
});

app.get("/api/teacher/path-status", requireAuth("teacher"), async (request, response) => {
  const classroomId = request.query.classroomId ? String(request.query.classroomId) : null;

  if (classroomId) {
    const classroom = await Classroom.findOne({
      _id: classroomId,
      schoolId: request.auth.schoolId,
      teacherId: request.auth.sub
    }).lean();

    if (!classroom) {
      response.status(404).json({ message: "Classroom not found." });
      return;
    }
  }

  const payload = await getTeacherPathStatuses({
    schoolId: request.auth.schoolId,
    teacherId: request.auth.sub,
    classroomId
  });

  response.json(payload);
});

app.post("/api/teachers", requireAuth("admin"), async (request, response) => {
  const { fullName, email, password } = request.body;

  if (!fullName || !email || !password) {
    response.status(400).json({ message: "fullName, email, and password are required." });
    return;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    response.status(409).json({ message: "A user with this email already exists." });
    return;
  }

  const teacher = await User.create({
    schoolId: request.auth.schoolId,
    role: "teacher",
    fullName,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password)
  });

  response.status(201).json({ teacher });
});

app.get("/api/teachers", requireAuth("admin"), async (request, response) => {
  const teachers = await User.find({ schoolId: request.auth.schoolId, role: "teacher" }).sort({ createdAt: -1 }).lean();
  response.json({ teachers });
});

app.post("/api/classrooms", requireAuth("admin", "teacher"), async (request, response) => {
  const { name, gradeLevel, teacherId } = request.body;

  if (!name || !gradeLevel) {
    response.status(400).json({ message: "name and gradeLevel are required." });
    return;
  }

  const owningTeacherId =
    request.auth.role === "teacher"
      ? request.auth.sub
      : teacherId;

  if (!owningTeacherId) {
    response.status(400).json({ message: "teacherId is required when admin creates a classroom." });
    return;
  }

  const classroom = await Classroom.create({
    schoolId: request.auth.schoolId,
    teacherId: owningTeacherId,
    name,
    gradeLevel
  });

  response.status(201).json({ classroom });
});

app.get("/api/classrooms", requireAuth("admin", "teacher"), async (request, response) => {
  const query =
    request.auth.role === "teacher"
      ? { schoolId: request.auth.schoolId, teacherId: request.auth.sub }
      : { schoolId: request.auth.schoolId };

  const classrooms = await Classroom.find(query).sort({ createdAt: -1 }).lean();
  response.json({ classrooms });
});

app.post("/api/students", requireAuth("admin", "teacher"), async (request, response) => {
  const { fullName, email, password, gradeLevel, classroom, classroomId } = request.body;

  if (!fullName || !email || !password || !classroomId) {
    response.status(400).json({ message: "fullName, email, password, and classroomId are required." });
    return;
  }

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    response.status(409).json({ message: "A user with this email already exists." });
    return;
  }

  const classroomRecord = await Classroom.findOne({
    _id: classroomId,
    schoolId: request.auth.schoolId,
    ...(request.auth.role === "teacher" ? { teacherId: request.auth.sub } : {})
  }).lean();

  if (!classroomRecord) {
    response.status(404).json({ message: "Selected classroom was not found." });
    return;
  }

  const resolvedGradeLevel = gradeLevel || classroomRecord.gradeLevel;
  const resolvedClassroomName = classroom || classroomRecord.name;

  if (!resolvedGradeLevel) {
    response.status(400).json({ message: "gradeLevel is required or must be available from the selected classroom." });
    return;
  }

  const student = await User.create({
    schoolId: request.auth.schoolId,
    role: "student",
    fullName,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    gradeLevel: resolvedGradeLevel,
    classroom: resolvedClassroomName,
    classroomId
  });

  response.status(201).json({ student });
});

app.get("/api/students", requireAuth("admin", "teacher"), async (request, response) => {
  let classroomIds = null;
  if (request.auth.role === "teacher") {
    const ownedClassrooms = await Classroom.find({ schoolId: request.auth.schoolId, teacherId: request.auth.sub }).select("_id").lean();
    classroomIds = ownedClassrooms.map((classroom) => classroom._id);
  }

  const query = {
    schoolId: request.auth.schoolId,
    role: "student",
    ...(request.auth.role === "teacher" ? { classroomId: { $in: classroomIds } } : {})
  };

  const students = await User.find(query).sort({ createdAt: -1 }).lean();
  response.json({ students });
});

app.post("/api/assessments", requireAuth("teacher"), async (request, response) => {
  const { classroomId, title, assessmentType = "diagnostic", questionIds } = request.body;

  if (!classroomId || !title || !Array.isArray(questionIds) || questionIds.length === 0) {
    response.status(400).json({ message: "classroomId, title, and questionIds are required." });
    return;
  }

  const classroom = await Classroom.findOne({
    _id: classroomId,
    schoolId: request.auth.schoolId,
    teacherId: request.auth.sub
  });

  if (!classroom) {
    response.status(404).json({ message: "Classroom not found." });
    return;
  }

  const assessment = await Assessment.create({
    schoolId: request.auth.schoolId,
    classroomId,
    teacherId: request.auth.sub,
    title,
    assessmentType,
    questionIds
  });

  response.status(201).json({ assessment });
});

app.get("/api/assessments", requireAuth("teacher", "student"), async (request, response) => {
  const query =
    request.auth.role === "teacher"
      ? { schoolId: request.auth.schoolId, teacherId: request.auth.sub }
      : {
          schoolId: request.auth.schoolId,
          assignedStudentIds: request.auth.sub
        };

  const assessments = await Assessment.find(query).sort({ createdAt: -1 }).lean();
  response.json({ assessments });
});

app.post("/api/assessments/:assessmentId/assign", requireAuth("teacher"), async (request, response) => {
  const { studentIds } = request.body;
  const assessment = await Assessment.findOne({
    _id: request.params.assessmentId,
    schoolId: request.auth.schoolId,
    teacherId: request.auth.sub
  });

  if (!assessment) {
    response.status(404).json({ message: "Assessment not found." });
    return;
  }

  assessment.assignedStudentIds = studentIds;
  assessment.status = "assigned";
  await assessment.save();

  response.json({ assessment });
});

app.get("/api/assessments/:assessmentId", requireAuth("teacher", "student"), async (request, response) => {
  const query =
    request.auth.role === "student"
      ? {
          _id: request.params.assessmentId,
          schoolId: request.auth.schoolId,
          assignedStudentIds: request.auth.sub
        }
      : {
          _id: request.params.assessmentId,
          schoolId: request.auth.schoolId
        };

  const assessment = await Assessment.findOne(query)
    .populate("questionIds")
    .lean();

  if (!assessment) {
    response.status(404).json({ message: "Assessment not found." });
    return;
  }

  response.json({ assessment });
});

app.post("/api/assessments/:assessmentId/submit", requireAuth("student"), async (request, response) => {
  const { answers } = request.body;
  const sessionId = getSessionId(request);

  const assessment = await Assessment.findOne({
    _id: request.params.assessmentId,
    schoolId: request.auth.schoolId,
    assignedStudentIds: request.auth.sub
  }).lean();

  if (!assessment) {
    response.status(404).json({ message: "Assigned assessment not found." });
    return;
  }

  await logActivityEvent({
    schoolId: request.auth.schoolId,
    userId: request.auth.sub,
    userRole: request.auth.role,
    eventType: "student_submission_started",
    sessionId,
    context: {
      assessmentId: assessment._id,
      classroomId: assessment.classroomId
    },
    metadata: {
      userAgent: request.headers["user-agent"]
    }
  });

  const student = await User.findById(request.auth.sub).lean();
  const startedAt = Date.now();
  const result = await scoreAssessmentSubmission({
    schoolId: request.auth.schoolId,
    classroomId: assessment.classroomId,
    studentId: request.auth.sub,
    assessmentId: assessment._id,
    rawAnswers: answers ?? [],
    sourceType: assessment.assessmentType
  });

  await logActivityEvent({
    schoolId: request.auth.schoolId,
    userId: request.auth.sub,
    userRole: request.auth.role,
    eventType: "student_submission_completed",
    sessionId,
    context: {
      assessmentId: assessment._id,
      classroomId: assessment.classroomId,
      submissionId: result.submission._id,
      scorePercent: result.scorePercent,
      durationSeconds: Math.round((Date.now() - startedAt) / 1000)
    },
    metadata: {
      userAgent: request.headers["user-agent"]
    }
  });

  response.status(201).json({
    submission: result.submission,
    scorePercent: result.scorePercent,
    mastery: result.masteries,
    skillMastery: result.skillMasteries,
    struggling: result.struggling,
    nextSkillRecommendation: result.nextSkillRecommendation,
    classroomId: student?.classroomId
  });
});

app.get("/api/teacher/dashboard", requireAuth("teacher"), async (request, response) => {
  await logActivityEvent({
    schoolId: request.auth.schoolId,
    userId: request.auth.sub,
    userRole: request.auth.role,
    eventType: "teacher_dashboard_viewed",
    sessionId: getSessionId(request)
  });

  const payload = await buildTeacherDashboardData({
    schoolId: request.auth.schoolId,
    teacherId: request.auth.sub
  });
  response.json(payload);
});

app.get("/api/student/recommendations", requireAuth("student"), async (request, response) => {
  const recommendations = await getStudentRecommendations(request.auth.sub);

  await logActivityEvent({
    schoolId: request.auth.schoolId,
    userId: request.auth.sub,
    userRole: request.auth.role,
    eventType: "student_recommendations_viewed",
    sessionId: getSessionId(request),
    context: {
      details: `returned=${recommendations.length}`
    }
  });

  response.json({ recommendations });
});

app.get("/api/student/tasks/today", requireAuth("student"), async (request, response) => {
  const task = await getStudentTodayTask({
    schoolId: request.auth.schoolId,
    studentId: request.auth.sub
  });

  response.json({ task });
});

app.post("/api/student/tasks/continue", requireAuth("student"), async (request, response) => {
  try {
    const task = await continueStudentTask({
      schoolId: request.auth.schoolId,
      studentId: request.auth.sub
    });
    response.status(201).json({ task });
  } catch (error) {
    response.status(error.statusCode || 500).json({ message: error.message || "Could not open the next practice batch." });
  }
});

app.get("/api/student/path", requireAuth("student"), async (request, response) => {
  const path = await getStudentPathView({
    schoolId: request.auth.schoolId,
    studentId: request.auth.sub
  });

  response.json({ path });
});

app.post("/api/student/tasks/:taskAssignmentId/submit", requireAuth("student"), async (request, response) => {
  const { answers = [] } = request.body;
  if (!Array.isArray(answers) || answers.length === 0) {
    response.status(400).json({ message: "answers are required." });
    return;
  }

  let result;
  try {
    result = await submitStudentTask({
      schoolId: request.auth.schoolId,
      studentId: request.auth.sub,
      taskAssignmentId: request.params.taskAssignmentId,
      rawAnswers: answers
    });
  } catch (error) {
    response.status(error.statusCode || 500).json({ message: error.message || "Could not submit this batch." });
    return;
  }

  await logActivityEvent({
    schoolId: request.auth.schoolId,
    userId: request.auth.sub,
    userRole: "student",
    eventType: "student_task_submission",
    sessionId: getSessionId(request),
    context: {
      classroomId: result.submission.classroomId,
      submissionId: result.submission._id,
      scorePercent: result.scorePercent,
      details: `task_assignment_id=${request.params.taskAssignmentId}`
    },
    metadata: {
      userAgent: request.headers["user-agent"]
    }
  });

  response.status(201).json({
    scorePercent: result.scorePercent,
    mastery: result.mastery,
    conceptState: result.conceptState,
    nextAction: result.nextAction,
    chapterUnlocked: result.chapterUnlocked,
    dailyGoalReached: result.dailyGoalReached,
    pathStatus: result.pathStatus,
    currentChapterNumber: result.currentChapterNumber,
    nextTask: result.nextTask
  });
});

app.get("/api/student/practice/:conceptId", requireAuth("student"), async (request, response) => {
  const runner = await getStudentPracticeRunner(request.auth.sub, request.params.conceptId);
  response.json(runner);
});

app.post("/api/student/practice/:conceptId/submit", requireAuth("student"), async (request, response) => {
  const startedAt = Date.now();
  const student = await User.findById(request.auth.sub).lean();
  const result = await scoreAssessmentSubmission({
    schoolId: request.auth.schoolId,
    classroomId: student?.classroomId,
    studentId: request.auth.sub,
    assessmentId: null,
    rawAnswers: request.body.answers ?? [],
    sourceType: request.body.sourceType || "practice"
  });

  await logActivityEvent({
    schoolId: request.auth.schoolId,
    userId: request.auth.sub,
    userRole: request.auth.role,
    eventType: "student_practice_submission_completed",
    sessionId: getSessionId(request),
    context: {
      conceptId: request.params.conceptId,
      classroomId: student?.classroomId,
      submissionId: result.submission._id,
      scorePercent: result.scorePercent,
      durationSeconds: Math.round((Date.now() - startedAt) / 1000)
    }
  });

  response.status(201).json({
    scorePercent: result.scorePercent,
    mastery: result.masteries,
    skillMastery: result.skillMasteries,
    struggling: result.struggling,
    nextSkillRecommendation: result.nextSkillRecommendation
  });
});

app.get("/api/student/skills/timeline", requireAuth("student"), async (request, response) => {
  const { skillId } = request.query;
  if (!skillId) {
    response.status(400).json({ message: "skillId query parameter is required." });
    return;
  }

  const timeline = await getStudentSkillTimeline({
    schoolId: request.auth.schoolId,
    studentId: request.auth.sub,
    skillId: String(skillId)
  });
  response.json(timeline);
});

app.get("/api/student/skills/next", requireAuth("student"), async (request, response) => {
  const { skillId } = request.query;
  if (!skillId) {
    response.status(400).json({ message: "skillId query parameter is required." });
    return;
  }

  const student = await User.findById(request.auth.sub).lean();
  const recommendation = await getStudentNextSkillRecommendation({
    schoolId: request.auth.schoolId,
    classroomId: student?.classroomId,
    studentId: request.auth.sub,
    skillId: String(skillId)
  });
  response.json(recommendation);
});

app.get("/api/student/skills/prerequisites", requireAuth("student"), async (request, response) => {
  const { skillId } = request.query;
  if (!skillId) {
    response.status(400).json({ message: "skillId query parameter is required." });
    return;
  }

  const student = await User.findById(request.auth.sub).lean();
  const diagnostics = await getPrerequisiteGapDiagnostics({
    schoolId: request.auth.schoolId,
    classroomId: student?.classroomId,
    studentId: request.auth.sub,
    skillId: String(skillId)
  });
  response.json(diagnostics);
});

app.get("/api/skills", requireAuth("admin", "teacher", "student", "parent"), async (_request, response) => {
  const skills = await Skill.find().sort({ gradeLevel: 1, name: 1 }).lean();
  response.json({ skills });
});

app.post("/api/interventions", requireAuth("teacher"), async (request, response) => {
  const { studentId, classroomId, conceptId, teacherDecisionRationale } = request.body;

  if (!studentId || !classroomId || !conceptId) {
    response.status(400).json({ message: "studentId, classroomId, and conceptId are required." });
    return;
  }

  const assignment = await assignRecommendedIntervention({
    schoolId: request.auth.schoolId,
    teacherId: request.auth.sub,
    studentId,
    classroomId,
    conceptId
  });

  const studentMastery = await StudentConceptMastery.findOne({
    schoolId: request.auth.schoolId,
    studentId,
    classroomId,
    conceptId
  }).lean();

  await InterventionAssignment.updateOne(
    { _id: assignment._id },
    {
      $set: {
        teacherDecisionRationale: teacherDecisionRationale || undefined,
        masteryAtAssignment: studentMastery?.currentMastery
      },
      $push: {
        statusHistory: {
          status: "assigned",
          changedAt: new Date(),
          changedByTeacherId: request.auth.sub
        }
      }
    }
  );

  await logActivityEvent({
    schoolId: request.auth.schoolId,
    userId: request.auth.sub,
    userRole: request.auth.role,
    eventType: "teacher_intervention_assigned",
    sessionId: getSessionId(request),
    context: {
      studentId,
      classroomId,
      conceptId,
      interventionAssignmentId: assignment._id,
      mastery: studentMastery?.currentMastery,
      riskLevel: studentMastery?.riskLevel,
      details: teacherDecisionRationale || ""
    }
  });

  response.status(201).json({ assignment });
});

app.get("/api/admin/summary", requireAuth("admin"), async (request, response) => {
  await logActivityEvent({
    schoolId: request.auth.schoolId,
    userId: request.auth.sub,
    userRole: request.auth.role,
    eventType: "admin_summary_viewed",
    sessionId: getSessionId(request)
  });

  const summary = await buildAdminSummary({ schoolId: request.auth.schoolId });
  response.json(summary);
});

app.get("/api/admin/insights/rollup", requireAuth("admin"), async (request, response) => {
  const rollup = await buildAdminRollupInsights({ schoolId: request.auth.schoolId });
  response.json(rollup);
});

app.get("/api/admin/path-rollup", requireAuth("admin"), async (request, response) => {
  const rollup = await getAdminPathRollup({ schoolId: request.auth.schoolId });
  response.json(rollup);
});

app.get("/api/teacher/reports", requireAuth("teacher"), async (request, response) => {
  await logActivityEvent({
    schoolId: request.auth.schoolId,
    userId: request.auth.sub,
    userRole: request.auth.role,
    eventType: "teacher_reports_viewed",
    sessionId: getSessionId(request)
  });

  const report = await buildTeacherReportData({
    schoolId: request.auth.schoolId,
    teacherId: request.auth.sub
  });
  response.json(report);
});

app.post("/api/events", requireAuth("admin", "teacher", "student", "parent"), async (request, response) => {
  const { eventType, context } = request.body;

  if (!eventType || typeof eventType !== "string") {
    response.status(400).json({ message: "eventType is required." });
    return;
  }

  const event = await logActivityEvent({
    schoolId: request.auth.schoolId,
    userId: request.auth.sub,
    userRole: request.auth.role,
    eventType,
    sessionId: getSessionId(request),
    context: context ?? {},
    metadata: {
      userAgent: request.headers["user-agent"]
    }
  });

  response.status(201).json({ ok: true, id: event?._id ?? null });
});

app.get("/api/admin/activity-events", requireAuth("admin"), async (request, response) => {
  const limit = Math.min(Number(request.query.limit || 200), 1000);
  const events = await ActivityEvent.find({ schoolId: request.auth.schoolId })
    .sort({ occurredAt: -1 })
    .limit(limit)
    .lean();
  response.json({ events });
});

app.get("/api/dashboard/:role", requireAuth("admin", "teacher", "student", "parent"), async (request, response) => {
  if (request.auth.role !== request.params.role) {
    response.status(403).json({ message: "Forbidden for this portal." });
    return;
  }

  const payload = await buildDashboard(request.params.role, request.auth);
  response.json(payload);
});

app.use((request, response) => {
  response.status(404).json({ message: "Route not found." });
});

app.use((error, request, response, next) => {
  const statusCode = error.statusCode || 500;
  if (response.headersSent) {
    next(error);
    return;
  }

  if (config.nodeEnv !== "production") {
    console.error(error);
  }

  response.status(statusCode).json({
    message: error.message || "Internal server error.",
    statusCode,
    code: error.code || "internal_error"
  });
});

export async function readyApp() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      validateRuntimeConfig();
      await connectDatabase();
      if (config.startupBootstrapEnabled) {
        await ensureLearningSeedData();
        await ensureQuestionTemplateCatalog();
      }
      return app;
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
}
