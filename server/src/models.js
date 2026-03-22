import mongoose from "mongoose";
import { config } from "./config.js";

const schoolSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    adminName: { type: String, required: true },
    adminEmail: { type: String, required: true, unique: true },
    timezone: { type: String, default: "Asia/Kolkata" }
  },
  { timestamps: true }
);

const userSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    role: { type: String, enum: ["admin", "teacher", "student", "parent"], required: true },
    fullName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    passwordHash: { type: String, required: true },
    gradeLevel: { type: String },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom" },
    classroom: { type: String },
    status: { type: String, default: "active" },
    parentStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

const skillSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
    skillId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    gradeLevel: { type: String },
    standard: { type: String },
    description: { type: String, required: true }
  },
  { timestamps: true }
);

const skillPrerequisiteSchema = new mongoose.Schema(
  {
    skillId: { type: String, required: true },
    prerequisiteSkillId: { type: String, required: true }
  },
  { timestamps: true }
);

const classroomSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    gradeLevel: { type: String, required: true }
  },
  { timestamps: true }
);

const conceptSchema = new mongoose.Schema(
  {
    subject: { type: String, required: true, default: "math" },
    gradeLevel: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true }
  },
  { timestamps: true }
);

const contentItemSchema = new mongoose.Schema(
  {
    conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true },
    type: { type: String, enum: ["lesson", "practice_set", "checkpoint"], required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    difficultyLevel: { type: Number, required: true, min: 1, max: 5 }
  },
  { timestamps: true }
);

const questionSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
    createdByUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: "QuestionTemplate" },
    variantOfQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
    conceptIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true }],
    skillId: { type: String },
    gradeLevel: { type: String },
    topic: { type: String, default: "" },
    prompt: { type: String, required: true },
    questionType: {
      type: String,
      enum: ["mcq", "numeric", "short_answer", "fill_blank", "true_false", "case_study"],
      required: true
    },
    options: [{ type: String }],
    correctAnswer: { type: String, required: true },
    explanation: { type: String, required: true },
    difficultyLevel: { type: Number, required: true, min: 1, max: 5 },
    expectedTimeSec: { type: Number, default: 60 },
    hintWeight: { type: Number, default: 1 },
    reviewStatus: {
      type: String,
      enum: ["draft", "in_review", "approved", "changes_requested"],
      default: "draft"
    },
    approvedForGeneration: { type: Boolean, default: false },
    questionSource: {
      type: String,
      enum: ["seed", "teacher", "imported", "ai_assisted"],
      default: "teacher"
    },
    teacherNotes: { type: String, default: "" },
    generationMethod: {
      type: String,
      enum: ["manual", "template_copy", "deterministic_variant", "teacher_copy", "openai_rewrite"],
      default: "manual"
    },
    parameterSignature: { type: String, default: "" },
    noveltyHash: { type: String, default: "" },
    allowedAnswerPatterns: [{ type: String }]
  },
  { timestamps: true }
);

const questionTemplateSchema = new mongoose.Schema(
  {
    templateKey: { type: String, required: true, unique: true },
    source: { type: String, default: "class10-json" },
    chapterNumber: { type: Number, required: true },
    code: { type: String, required: true },
    chapterName: { type: String, required: true },
    standard: { type: String },
    skillId: { type: String },
    gradeLevel: { type: String, required: true },
    topic: { type: String, default: "" },
    questionIndex: { type: Number, required: true },
    prompt: { type: String, required: true },
    questionType: {
      type: String,
      enum: ["mcq", "numeric", "short_answer", "fill_blank", "true_false", "case_study"],
      required: true
    },
    options: [{ type: String }],
    correctAnswer: { type: String, required: true },
    explanation: { type: String, required: true },
    difficultyLevel: { type: Number, required: true, min: 1, max: 5 },
    expectedTimeSec: { type: Number, default: 60 },
    hintWeight: { type: Number, default: 1 },
    lessonSummary: { type: String, default: "" },
    practiceFocus: { type: String, default: "" },
    checkpointGoal: { type: String, default: "" },
    retrievalText: { type: String, default: "" },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

const questionVariantSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
    templateQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: "QuestionTemplate" },
    sourceQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
    conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true },
    skillId: { type: String },
    chapterCode: { type: String },
    gradeLevel: { type: String, required: true },
    topic: { type: String, default: "" },
    prompt: { type: String, required: true },
    questionType: {
      type: String,
      enum: ["mcq", "numeric", "short_answer", "fill_blank", "true_false", "case_study"],
      required: true
    },
    options: [{ type: String }],
    correctAnswer: { type: String, required: true },
    explanation: { type: String, required: true },
    difficultyLevel: { type: Number, required: true, min: 1, max: 5 },
    expectedTimeSec: { type: Number, default: 60 },
    hintWeight: { type: Number, default: 1 },
    generationMethod: {
      type: String,
      enum: ["template_copy", "deterministic_variant", "teacher_copy", "openai_rewrite"],
      default: "template_copy"
    },
    variantType: { type: String, default: "base" },
    parameterSignature: { type: String, default: "" },
    noveltyHash: { type: String, default: "" },
    allowedAnswerPatterns: [{ type: String }],
    aiSupport: {
      hint: { type: String, default: "" },
      explanation: { type: String, default: "" },
      rewriteRationale: { type: String, default: "" }
    }
  },
  { timestamps: true }
);

const assessmentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    assessmentType: { type: String, enum: ["diagnostic", "checkpoint"], required: true },
    questionIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true }],
    assignedStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    status: { type: String, enum: ["draft", "assigned", "closed"], default: "draft" }
  },
  { timestamps: true }
);

const submissionSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment" },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    answers: [
      {
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
        submittedAnswer: { type: String, required: true },
        isCorrect: { type: Boolean, required: true },
        responseTimeMs: { type: Number, min: 0, default: 0 },
        hintsUsed: { type: Number, min: 0, default: 0 },
        retries: { type: Number, min: 0, default: 0 }
      }
    ],
    scorePercent: { type: Number, required: true },
    sourceType: { type: String, enum: ["diagnostic", "practice", "checkpoint"], required: true }
  },
  { timestamps: true }
);

const masterySchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true },
    baselineMastery: { type: Number, required: true, min: 0, max: 1 },
    currentMastery: { type: Number, required: true, min: 0, max: 1 },
    riskLevel: { type: String, enum: ["low", "medium", "high"], required: true },
    attemptsCount: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const studentSkillMasterySchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    skillId: { type: String, required: true },
    masteryScore: { type: Number, required: true, min: 0, max: 1, default: 0 },
    lastAttempt: { type: Date },
    attempts: [
      {
        questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
        isCorrect: { type: Boolean, required: true },
        responseTimeMs: { type: Number, min: 0, default: 0 },
        hintsUsed: { type: Number, min: 0, default: 0 },
        retries: { type: Number, min: 0, default: 0 },
        performanceScore: { type: Number, min: 0, max: 1, required: true },
        masteryAfter: { type: Number, min: 0, max: 1, required: true },
        createdAt: { type: Date, default: Date.now }
      }
    ],
    confidence: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    consecutiveWrong: { type: Number, default: 0 },
    learningStreakDays: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const interventionAssignmentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true },
    contentItemIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "ContentItem", required: true }],
    status: { type: String, enum: ["assigned", "in_progress", "completed"], default: "assigned" },
    statusHistory: [
      {
        status: { type: String, enum: ["assigned", "in_progress", "completed"], required: true },
        changedAt: { type: Date, default: Date.now },
        changedByTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
      }
    ],
    teacherDecisionRationale: { type: String, maxlength: 500 },
    masteryAtAssignment: { type: Number, min: 0, max: 1 },
    masteryAtCompletion: { type: Number, min: 0, max: 1 }
  },
  { timestamps: true }
);

const studentConceptStateSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true },
    masteryScore: { type: Number, min: 0, max: 1, default: 0 },
    confidenceBand: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    paceBand: { type: String, enum: ["slow", "on_track", "fast"], default: "on_track" },
    checkpointPassed: { type: Boolean, default: false },
    conceptCompletedAt: { type: Date },
    lastAssignedAt: { type: Date },
    lastPracticedAt: { type: Date },
    recentFirstAttemptAccuracy: { type: Number, min: 0, max: 1, default: 0 },
    averageResponseRatio: { type: Number, min: 0, default: 1 },
    totalHintsUsed: { type: Number, min: 0, default: 0 },
    totalRetries: { type: Number, min: 0, default: 0 },
    consecutiveCorrect: { type: Number, min: 0, default: 0 },
    consecutiveWrong: { type: Number, min: 0, default: 0 },
    lastDifficultyLevel: { type: Number, min: 1, max: 5, default: 1 },
    latestBlocker: { type: String, default: "" },
    prerequisiteFallbackSkillId: { type: String, default: "" }
  },
  { timestamps: true }
);

const studentTaskPlanSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    pathId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentLearningPath" },
    conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true },
    conceptCode: { type: String, required: true },
    conceptName: { type: String, required: true },
    chapterNumber: { type: Number, required: true, min: 1 },
    cycleIndex: { type: Number, required: true, min: 1, default: 1 },
    autoAssigned: { type: Boolean, default: false },
    masteryTarget: { type: Number, min: 0, max: 1, default: 0.8 },
    unlocksNextChapter: { type: Boolean, default: false },
    status: { type: String, enum: ["planned", "assigned", "in_progress", "completed", "superseded"], default: "planned" },
    paceBand: { type: String, enum: ["slow", "on_track", "fast"], default: "on_track" },
    confidenceBand: { type: String, enum: ["low", "medium", "high"], default: "medium" },
    targetDifficulty: { type: Number, min: 1, max: 5, default: 2 },
    rationale: [{ type: String }],
    rationaleTags: [{ type: String }],
    narrativeSummary: { type: String, default: "" },
    generatedAt: { type: Date, default: Date.now },
    coveredTopics: [{ type: String }],
    coverageScore: { type: Number, min: 0, max: 1, default: 0 },
    conceptQueue: [
      {
        conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true },
        code: { type: String, required: true },
        name: { type: String, required: true },
        mastery: { type: Number, min: 0, max: 1, required: true }
      }
    ],
    lesson: {
      title: { type: String },
      body: { type: String }
    },
    practiceItems: [
      {
        variantId: { type: mongoose.Schema.Types.ObjectId, ref: "QuestionVariant", required: true },
        order: { type: Number, required: true },
        stage: { type: String, enum: ["practice", "checkpoint"], default: "practice" },
        difficultyLevel: { type: Number, min: 1, max: 5 },
        sourceKind: { type: String, enum: ["template", "teacher"], required: true }
      }
    ],
    completedAt: { type: Date }
  },
  { timestamps: true }
);

const studentLearningPathSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    status: { type: String, enum: ["not_started", "active", "completed", "paused"], default: "not_started" },
    currentChapterNumber: { type: Number, min: 1, default: 1 },
    currentConceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept" },
    currentChapterCode: { type: String, default: "" },
    activatedByTeacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    activatedAt: { type: Date },
    completedChapterCodes: [{ type: String }],
    currentCycleIndex: { type: Number, min: 0, default: 0 },
    lastAutoAssignedAt: { type: Date },
    lastMasteryAt: { type: Date },
    dailyTargetStatus: { type: String, enum: ["in_progress", "reached"], default: "in_progress" },
    dailyMasteryStart: { type: Number, min: 0, max: 100, default: 0 },
    dailyMasteryGoal: { type: Number, min: 0, max: 100, default: 0 },
    dailyTargetDate: { type: String, default: "" },
    dailyGoalReachedAt: { type: Date }
  },
  { timestamps: true }
);

const taskAssignmentSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    pathId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentLearningPath" },
    taskPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentTaskPlan", required: true },
    chapterNumber: { type: Number, min: 1 },
    cycleIndex: { type: Number, min: 1, default: 1 },
    autoAssigned: { type: Boolean, default: false },
    status: { type: String, enum: ["assigned", "started", "completed", "superseded"], default: "assigned" },
    assignedForDate: { type: String, required: true },
    assignedAt: { type: Date, default: Date.now },
    startedAt: { type: Date },
    completedAt: { type: Date },
    submittedAt: { type: Date },
    supersededByAssignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "TaskAssignment" }
  },
  { timestamps: true }
);

const insightSnapshotSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    role: { type: String, enum: ["teacher", "student", "admin", "parent"], required: true },
    snapshotType: { type: String, enum: ["task", "progress", "rollup"], default: "task" },
    summary: { type: String, required: true },
    highlights: [{ type: String }],
    signalSummary: {
      weakestConcepts: [{ type: String }],
      paceProfile: { type: String, default: "" },
      confidenceProfile: { type: String, default: "" },
      nextBlocker: { type: String, default: "" },
      masteryLiftPercent: { type: Number, default: 0 }
    },
    context: {
      classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom" },
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept" },
      taskPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentTaskPlan" }
    }
  },
  { timestamps: true }
);

const attemptFeatureSnapshotSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true },
    taskPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentTaskPlan" },
    taskAssignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "TaskAssignment" },
    submissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Submission" },
    accuracy: { type: Number, min: 0, max: 1, required: true },
    responseRatio: { type: Number, min: 0, required: true },
    hintRatio: { type: Number, min: 0, required: true },
    retries: { type: Number, min: 0, default: 0 },
    checkpointPassed: { type: Boolean, default: false },
    difficultyChange: { type: String, enum: ["up", "stay", "down"], default: "stay" },
    nextAction: { type: String, default: "" }
  },
  { timestamps: true }
);

const aiGenerationLogSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School" },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom" },
    taskPlanId: { type: mongoose.Schema.Types.ObjectId, ref: "StudentTaskPlan" },
    templateQuestionId: { type: mongoose.Schema.Types.ObjectId, ref: "QuestionTemplate" },
    questionVariantId: { type: mongoose.Schema.Types.ObjectId, ref: "QuestionVariant" },
    generationPath: {
      type: String,
      enum: ["deterministic_variant", "teacher_copy", "template_copy", "openai_rewrite", "rules_summary"],
      required: true
    },
    model: { type: String, default: "" },
    promptVersion: { type: String, default: "v1" },
    retrievalCandidates: [{ type: String }],
    selectedCandidate: { type: String, default: "" },
    auditStatus: { type: String, enum: ["ok", "fallback", "skipped"], default: "ok" },
    notes: { type: String, default: "" }
  },
  { timestamps: true }
);

const activityEventSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userRole: { type: String, enum: ["admin", "teacher", "student", "parent"], required: true },
    eventType: { type: String, required: true },
    occurredAt: { type: Date, required: true, default: Date.now },
    sessionId: { type: String, required: true },
    context: {
      classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom" },
      studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept" },
      assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment" },
      submissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Submission" },
      interventionAssignmentId: { type: mongoose.Schema.Types.ObjectId, ref: "InterventionAssignment" },
      ruleId: { type: String },
      decision: { type: String },
      scorePercent: { type: Number, min: 0, max: 100 },
      riskLevel: { type: String },
      mastery: { type: Number, min: 0, max: 1 },
      durationSeconds: { type: Number, min: 0 },
      details: { type: String }
    },
    metadata: {
      userAgent: { type: String },
      apiVersion: { type: String, default: "v1" }
    }
  },
  { timestamps: true }
);

const masteryAuditLogSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: "School", required: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classroomId: { type: mongoose.Schema.Types.ObjectId, ref: "Classroom", required: true },
    conceptId: { type: mongoose.Schema.Types.ObjectId, ref: "Concept", required: true },
    previousMastery: { type: Number, required: true, min: 0, max: 1 },
    newMastery: { type: Number, required: true, min: 0, max: 1 },
    previousRiskLevel: { type: String, enum: ["low", "medium", "high"], required: true },
    newRiskLevel: { type: String, enum: ["low", "medium", "high"], required: true },
    sourceSubmissionId: { type: mongoose.Schema.Types.ObjectId, ref: "Submission", required: true },
    sourceType: { type: String, enum: ["diagnostic", "practice", "checkpoint"], required: true },
    scorePercent: { type: Number, min: 0, max: 100 },
    attemptCountBefore: { type: Number, min: 0, required: true },
    attemptCountAfter: { type: Number, min: 1, required: true },
    changedAt: { type: Date, required: true, default: Date.now }
  },
  { timestamps: true }
);

activityEventSchema.index({ schoolId: 1, userId: 1, occurredAt: -1 });
activityEventSchema.index({ schoolId: 1, eventType: 1, occurredAt: -1 });
activityEventSchema.index(
  { occurredAt: 1 },
  {
    expireAfterSeconds: config.activityEventRetentionDays * 24 * 60 * 60
  }
);
masteryAuditLogSchema.index({ schoolId: 1, studentId: 1, conceptId: 1, changedAt: -1 });
studentSkillMasterySchema.index({ schoolId: 1, studentId: 1, skillId: 1 }, { unique: true });
skillPrerequisiteSchema.index({ skillId: 1, prerequisiteSkillId: 1 }, { unique: true });
questionTemplateSchema.index({ code: 1, difficultyLevel: 1, questionType: 1 });
questionVariantSchema.index({ conceptId: 1, skillId: 1, createdAt: -1 });
studentConceptStateSchema.index({ schoolId: 1, studentId: 1, conceptId: 1 }, { unique: true });
studentTaskPlanSchema.index({ schoolId: 1, studentId: 1, status: 1, createdAt: -1 });
studentLearningPathSchema.index({ schoolId: 1, studentId: 1 }, { unique: true });
taskAssignmentSchema.index({ schoolId: 1, studentId: 1, assignedForDate: -1 });
attemptFeatureSnapshotSchema.index({ schoolId: 1, studentId: 1, createdAt: -1 });
aiGenerationLogSchema.index({ schoolId: 1, taskPlanId: 1, createdAt: -1 });

export const School = mongoose.model("School", schoolSchema);
export const User = mongoose.model("User", userSchema);
export const Classroom = mongoose.model("Classroom", classroomSchema);
export const Skill = mongoose.model("Skill", skillSchema);
export const SkillPrerequisite = mongoose.model("SkillPrerequisite", skillPrerequisiteSchema);
export const Concept = mongoose.model("Concept", conceptSchema);
export const ContentItem = mongoose.model("ContentItem", contentItemSchema);
export const Question = mongoose.model("Question", questionSchema);
export const QuestionTemplate = mongoose.model("QuestionTemplate", questionTemplateSchema);
export const QuestionVariant = mongoose.model("QuestionVariant", questionVariantSchema);
export const Assessment = mongoose.model("Assessment", assessmentSchema);
export const Submission = mongoose.model("Submission", submissionSchema);
export const StudentConceptMastery = mongoose.model("StudentConceptMastery", masterySchema);
export const StudentSkillMastery = mongoose.model("StudentSkillMastery", studentSkillMasterySchema);
export const InterventionAssignment = mongoose.model("InterventionAssignment", interventionAssignmentSchema);
export const StudentConceptState = mongoose.model("StudentConceptState", studentConceptStateSchema);
export const StudentTaskPlan = mongoose.model("StudentTaskPlan", studentTaskPlanSchema);
export const StudentLearningPath = mongoose.model("StudentLearningPath", studentLearningPathSchema);
export const TaskAssignment = mongoose.model("TaskAssignment", taskAssignmentSchema);
export const InsightSnapshot = mongoose.model("InsightSnapshot", insightSnapshotSchema);
export const AttemptFeatureSnapshot = mongoose.model("AttemptFeatureSnapshot", attemptFeatureSnapshotSchema);
export const AIGenerationLog = mongoose.model("AIGenerationLog", aiGenerationLogSchema);
export const ActivityEvent = mongoose.model("ActivityEvent", activityEventSchema);
export const MasteryAuditLog = mongoose.model("MasteryAuditLog", masteryAuditLogSchema);
