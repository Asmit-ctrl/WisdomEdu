import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });
process.env.OPENAI_ENABLE_ENHANCED_GENERATION = "false";

const mongoose = (await import("mongoose")).default;
const { connectDatabase } = await import("./db.js");
const { hashPassword } = await import("./auth.js");
const {
  School,
  User,
  Classroom,
  Concept,
  Submission,
  StudentConceptMastery,
  StudentConceptState,
  StudentSkillMastery,
  InterventionAssignment,
  StudentTaskPlan,
  StudentLearningPath,
  TaskAssignment,
  InsightSnapshot,
  AttemptFeatureSnapshot,
  AIGenerationLog,
  ActivityEvent,
  MasteryAuditLog,
  Assessment,
  Question,
  QuestionVariant
} = await import("./models.js");
const { assignTeacherTasks, continueStudentTask, getStudentTodayTask, submitStudentTask } = await import("./taskEngine.js");

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

const PHASE_PATTERNS = {
  foundation: {
    chapterOneAccuracy: [0.34, 0.5, 0.34, 0.5, 0.5, 0.67, 0.5, 0.67, 0.67, 0.5],
    chapterTwoAccuracy: [0.34, 0.5, 0.5, 0.34],
    responseRatio: 1.45,
    hintsBase: 2,
    retriesBase: 1
  },
  rebound: {
    chapterOneAccuracy: [0.34, 0.34, 0.5, 0.67, 0.5, 0.67, 0.67, 0.67, 0.5, 0.67],
    chapterTwoAccuracy: [0.34, 0.5, 0.5, 0.5],
    responseRatio: 1.25,
    hintsBase: 1,
    retriesBase: 1
  },
  steady: {
    chapterOneAccuracy: [0.5, 0.67, 0.67, 0.67, 0.83, 0.67, 0.83, 0.67, 0.83, 0.67],
    chapterTwoAccuracy: [0.5, 0.67, 0.67, 0.5],
    responseRatio: 1.05,
    hintsBase: 1,
    retriesBase: 0
  },
  breakthrough: {
    chapterOneAccuracy: [0.67, 0.83, 0.83, 0.83, 1, 0.83, 1, 0.83, 1, 0.83],
    chapterTwoAccuracy: [0.5, 0.67, 0.5, 0.67],
    responseRatio: 0.85,
    hintsBase: 0,
    retriesBase: 0
  }
};

function isTransientMongoError(error) {
  const code = error?.code ?? error?.cause?.code;
  const name = error?.name ?? "";
  return (
    code === "ECONNRESET" ||
    code === "ETIMEDOUT" ||
    code === "ECONNREFUSED" ||
    name === "MongoNetworkError" ||
    name === "MongoServerSelectionError"
  );
}

async function reconnectDatabase() {
  try {
    await mongoose.disconnect();
  } catch {
    // Ignore disconnect failures during retry recovery.
  }
  await connectDatabase();
}

async function withRetries(label, callback, attempts = 4) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;
      if (!isTransientMongoError(error) || attempt === attempts) {
        throw error;
      }
      console.warn(`${label} failed on attempt ${attempt}/${attempts}. Reconnecting and retrying...`);
      await reconnectDatabase();
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
  throw lastError;
}

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

function buildSchoolDayWindow(dayOffset, timeZone) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - dayOffset);
  return toDateOnlyInTimezone(date, timeZone);
}

function makeIstDate(dateOnly, hour, minute) {
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");
  return new Date(`${dateOnly}T${hh}:${mm}:00+05:30`);
}

function chooseWrongAnswer(variant, offset = 1) {
  const correctAnswer = String(variant.correctAnswer ?? "").trim();
  if (variant.questionType === "true_false") {
    return correctAnswer.toLowerCase() === "true" ? "False" : "True";
  }

  const differentOption = (variant.options ?? []).find((option) => String(option).trim() !== correctAnswer);
  if (differentOption) {
    return String(differentOption);
  }

  if (/^-?\d+(\.\d+)?$/.test(correctAnswer)) {
    return String(Number(correctAnswer) + offset + 1);
  }

  if (/^[a-z]$/i.test(correctAnswer)) {
    return correctAnswer.toLowerCase() === "d" ? "a" : "d";
  }

  return `wrong-${offset}`;
}

function buildAnswerShape({ assignment, phase, dayIndex, currentChapterNumber }) {
  const pattern = PHASE_PATTERNS[phase] ?? PHASE_PATTERNS.steady;
  const accuracyTrack = currentChapterNumber > 1 ? pattern.chapterTwoAccuracy : pattern.chapterOneAccuracy;
  const desiredAccuracy = accuracyTrack[Math.min(dayIndex, accuracyTrack.length - 1)] ?? accuracyTrack[accuracyTrack.length - 1] ?? 0.5;
  const practiceItems = [...(assignment.taskPlanId?.practiceItems ?? [])].sort((left, right) => left.order - right.order);
  const checkpointItem = practiceItems.find((item) => item.stage === "checkpoint") ?? practiceItems[practiceItems.length - 1];
  const nonCheckpointItems = practiceItems.filter((item) => String(item._id) !== String(checkpointItem?._id));
  const targetCorrect = Math.max(1, Math.min(practiceItems.length, Math.round(practiceItems.length * desiredAccuracy)));
  const forceCheckpointCorrect =
    currentChapterNumber === 1
      ? phase === "breakthrough" && dayIndex >= 5
      : phase !== "foundation";
  const correctPracticeCount = Math.max(0, Math.min(nonCheckpointItems.length, targetCorrect - (forceCheckpointCorrect ? 1 : 0)));
  const correctPracticeIds = new Set(nonCheckpointItems.slice(0, correctPracticeCount).map((item) => String(item.variantId._id)));

  return practiceItems.map((item, index) => {
    const variant = item.variantId;
    const isCheckpoint = item.stage === "checkpoint";
    const isCorrect = isCheckpoint ? forceCheckpointCorrect : correctPracticeIds.has(String(variant._id));
    const responseTimeMs = Math.round((variant.expectedTimeSec ?? 60) * 1000 * (pattern.responseRatio + (index % 3) * 0.08));

    return {
      variantId: variant._id,
      submittedAnswer: isCorrect ? String(variant.correctAnswer ?? "") : chooseWrongAnswer(variant, index + dayIndex),
      responseTimeMs,
      hintsUsed: isCorrect ? 0 : pattern.hintsBase,
      retries: isCorrect ? 0 : pattern.retriesBase
    };
  });
}

async function backdateDocument(model, id, fields) {
  if (!id) {
    return;
  }
  await model.collection.updateOne({ _id: id }, { $set: fields });
}

async function deleteExistingDemoSchool() {
  const demoSchools = await School.find({
    $or: [{ slug: DEMO.slug }, { adminEmail: DEMO.adminEmail }]
  }).lean();

  for (const school of demoSchools) {
    const schoolId = school._id;
    await Promise.all([
      ActivityEvent.deleteMany({ schoolId }),
      MasteryAuditLog.deleteMany({ schoolId }),
      AIGenerationLog.deleteMany({ schoolId }),
      AttemptFeatureSnapshot.deleteMany({ schoolId }),
      InsightSnapshot.deleteMany({ schoolId }),
      TaskAssignment.deleteMany({ schoolId }),
      StudentTaskPlan.deleteMany({ schoolId }),
      StudentLearningPath.deleteMany({ schoolId }),
      InterventionAssignment.deleteMany({ schoolId }),
      StudentSkillMastery.deleteMany({ schoolId }),
      StudentConceptState.deleteMany({ schoolId }),
      StudentConceptMastery.deleteMany({ schoolId }),
      Submission.deleteMany({ schoolId }),
      Assessment.deleteMany({ schoolId }),
      QuestionVariant.deleteMany({ schoolId }),
      Question.deleteMany({ schoolId }),
      Classroom.deleteMany({ schoolId }),
      User.deleteMany({ schoolId }),
      School.deleteOne({ _id: schoolId })
    ]);
  }
}

async function ensureLibraryReady() {
  const conceptCount = await Concept.countDocuments({ gradeLevel: "10" });
  if (!conceptCount) {
    throw new Error("Class 10 library is missing. Run `npm run seed:class10` first.");
  }
}

async function createPresentationSchool() {
  const school = await School.create({
    name: DEMO.schoolName,
    slug: DEMO.slug,
    adminName: DEMO.adminName,
    adminEmail: DEMO.adminEmail,
    timezone: DEMO.timezone
  });

  const passwordHash = await hashPassword(DEMO.password);
  const admin = await User.create({
    schoolId: school._id,
    role: "admin",
    fullName: DEMO.adminName,
    email: DEMO.adminEmail,
    passwordHash,
    status: "active"
  });

  const teacherDocs = [];
  const classroomDocs = [];
  for (const teacherProfile of TEACHERS) {
    const teacher = await User.create({
      schoolId: school._id,
      role: "teacher",
      fullName: teacherProfile.fullName,
      email: teacherProfile.email,
      passwordHash,
      status: "active"
    });
    teacherDocs.push({ ...teacherProfile, doc: teacher });

    const classroom = await Classroom.create({
      schoolId: school._id,
      teacherId: teacher._id,
      name: teacherProfile.classroomName,
      gradeLevel: "10"
    });
    classroomDocs.push({ key: teacherProfile.key, doc: classroom, teacher });
  }

  const classroomMap = new Map(classroomDocs.map((entry) => [entry.key, entry]));
  const studentDocs = [];
  for (const [index, blueprint] of STUDENT_BLUEPRINTS.entries()) {
    const classroomEntry = classroomMap.get(blueprint.classroomKey);
    const student = await User.create({
      schoolId: school._id,
      role: "student",
      fullName: blueprint.fullName,
      email: `student${String(index + 1).padStart(2, "0")}.${slugify(blueprint.fullName)}@wisdomedu.demo`,
      passwordHash,
      gradeLevel: "10",
      classroomId: classroomEntry.doc._id,
      classroom: classroomEntry.doc.name,
      status: "active"
    });
    studentDocs.push({
      ...blueprint,
      doc: student,
      teacher: classroomEntry.teacher,
      classroom: classroomEntry.doc
    });
  }

  const startDate = buildSchoolDayWindow(11, DEMO.timezone);
  const startStamp = makeIstDate(startDate, 8, 0);
  await Promise.all([
    backdateDocument(School, school._id, { createdAt: startStamp, updatedAt: startStamp }),
    backdateDocument(User, admin._id, { createdAt: startStamp, updatedAt: startStamp }),
    ...teacherDocs.map((entry, index) => backdateDocument(User, entry.doc._id, { createdAt: makeIstDate(startDate, 8, 10 + index * 5), updatedAt: makeIstDate(startDate, 8, 10 + index * 5) })),
    ...classroomDocs.map((entry, index) => backdateDocument(Classroom, entry.doc._id, { createdAt: makeIstDate(startDate, 8, 20 + index * 5), updatedAt: makeIstDate(startDate, 8, 20 + index * 5) })),
    ...studentDocs.map((entry, index) => backdateDocument(User, entry.doc._id, { createdAt: makeIstDate(startDate, 8, 30 + (index % 20)), updatedAt: makeIstDate(startDate, 8, 30 + (index % 20)) }))
  ]);

  return { school, admin, teacherDocs, studentDocs };
}

async function loadOpenAssignment({ schoolId, studentId }) {
  const task = await getStudentTodayTask({ schoolId, studentId });
  if (!task?.assignmentId) {
    return null;
  }

  return TaskAssignment.findOne({ _id: task.assignmentId, schoolId, studentId }).populate({
    path: "taskPlanId",
    populate: { path: "practiceItems.variantId" }
  });
}

async function stampIterationArtifacts({
  schoolId,
  studentId,
  teacherId,
  assignment,
  submissionId,
  dayString,
  dayIndex
}) {
  const assignedAt = makeIstDate(dayString, 7 + (dayIndex % 2), 20 + (dayIndex % 15));
  const startedAt = makeIstDate(dayString, 18, 5 + (dayIndex % 12));
  const completedAt = new Date(startedAt.getTime() + (14 + dayIndex) * 60000);

  await Promise.all([
    backdateDocument(TaskAssignment, assignment._id, {
      assignedForDate: dayString,
      assignedAt,
      startedAt,
      completedAt,
      submittedAt: completedAt,
      createdAt: assignedAt,
      updatedAt: completedAt
    }),
    backdateDocument(StudentTaskPlan, assignment.taskPlanId?._id, {
      generatedAt: new Date(assignedAt.getTime() - 7 * 60000),
      completedAt,
      createdAt: assignedAt,
      updatedAt: completedAt
    }),
    backdateDocument(Submission, submissionId, {
      createdAt: completedAt,
      updatedAt: completedAt
    })
  ]);

  const [submission] = await Submission.find({ _id: submissionId }).lean();
  const [attemptSnapshot] = await AttemptFeatureSnapshot.find({ schoolId, studentId, taskAssignmentId: assignment._id }).sort({ createdAt: -1 }).limit(1).lean();
  const [masteryAudit] = await MasteryAuditLog.find({ schoolId, studentId, sourceSubmissionId: submissionId }).sort({ createdAt: -1 }).limit(1).lean();
  const insightSnapshots = await InsightSnapshot.find({
    schoolId,
    $or: [{ userId: studentId }, { userId: teacherId }]
  })
    .sort({ createdAt: -1 })
    .limit(4)
    .lean();
  const aiLogs = await AIGenerationLog.find({ schoolId, taskPlanId: assignment.taskPlanId?._id }).sort({ createdAt: -1 }).limit(12).lean();

  await Promise.all([
    attemptSnapshot ? backdateDocument(AttemptFeatureSnapshot, attemptSnapshot._id, { createdAt: completedAt, updatedAt: completedAt }) : Promise.resolve(),
    masteryAudit ? backdateDocument(MasteryAuditLog, masteryAudit._id, { changedAt: completedAt, createdAt: completedAt, updatedAt: completedAt }) : Promise.resolve(),
    ...insightSnapshots.map((snapshot, index) =>
      backdateDocument(InsightSnapshot, snapshot._id, {
        createdAt: new Date(completedAt.getTime() - index * 60000),
        updatedAt: new Date(completedAt.getTime() - index * 60000)
      })
    ),
    ...aiLogs.map((log, index) =>
      backdateDocument(AIGenerationLog, log._id, {
        createdAt: new Date(assignedAt.getTime() - index * 60000),
        updatedAt: new Date(assignedAt.getTime() - index * 60000)
      })
    )
  ]);

  if (submission) {
    await ActivityEvent.collection.updateMany(
      {
        schoolId,
        userId: studentId,
        "context.submissionId": submission._id
      },
      {
        $set: {
          occurredAt: completedAt,
          createdAt: completedAt,
          updatedAt: completedAt
        }
      }
    );
  }

  await StudentLearningPath.collection.updateOne(
    { schoolId, studentId },
    {
      $set: {
        lastAutoAssignedAt: assignedAt,
        updatedAt: completedAt,
        ...(masteryAudit ? { lastMasteryAt: completedAt } : {})
      }
    }
  );

  await StudentConceptState.collection.updateMany(
    { schoolId, studentId },
    {
      $set: {
        lastAssignedAt: assignedAt,
        lastPracticedAt: completedAt,
        updatedAt: completedAt
      }
    }
  );

  await StudentConceptMastery.collection.updateMany(
    { schoolId, studentId },
    {
      $set: {
        updatedAt: completedAt
      }
    }
  );

  await StudentSkillMastery.collection.updateMany(
    { schoolId, studentId },
    {
      $set: {
        lastAttempt: completedAt,
        updatedAt: completedAt
      }
    }
  );
}

async function simulateStudentHistory({ school, studentRecord, dayStrings }) {
  const schoolId = school._id;
  const studentId = studentRecord.doc._id;
  const teacherId = studentRecord.teacher._id;
  const classroomId = studentRecord.classroom._id;

  for (const [dayIndex, dayString] of dayStrings.entries()) {
    const path = await StudentLearningPath.findOne({ schoolId, studentId });
    if (!path) {
      await assignTeacherTasks({
        schoolId,
        classroomId,
        teacherId,
        studentIds: [studentId.toString()],
        assignedForDate: dayString
      });
    } else {
      path.dailyTargetDate = dayIndex === 0 ? "" : dayStrings[Math.max(0, dayIndex - 1)];
      await path.save();
    }

    let assignment = await loadOpenAssignment({ schoolId, studentId });
    if (!assignment) {
      try {
        await continueStudentTask({ schoolId, studentId });
      } catch {
        await assignTeacherTasks({
          schoolId,
          classroomId,
          teacherId,
          studentIds: [studentId.toString()],
          assignedForDate: dayString
        });
      }
      assignment = await loadOpenAssignment({ schoolId, studentId });
    }

    if (!assignment?.taskPlanId) {
      throw new Error(`Could not create an assignment for ${studentRecord.doc.fullName} on ${dayString}.`);
    }

    const currentChapterNumber = Number(assignment.chapterNumber ?? assignment.taskPlanId.chapterNumber ?? 1);
    const rawAnswers = buildAnswerShape({
      assignment,
      phase: studentRecord.phase,
      dayIndex,
      currentChapterNumber
    });

    const result = await submitStudentTask({
      schoolId,
      studentId,
      taskAssignmentId: assignment._id,
      rawAnswers
    });

    await stampIterationArtifacts({
      schoolId,
      studentId,
      teacherId,
      assignment,
      submissionId: result.submission._id,
      dayString,
      dayIndex
    });
  }

  const path = await StudentLearningPath.findOne({ schoolId, studentId });
  if (path?.status === "active") {
    const openAssignment = await loadOpenAssignment({ schoolId, studentId });
    if (!openAssignment) {
      const continuedTask = await continueStudentTask({ schoolId, studentId });
      const continuedAssignment = await TaskAssignment.findById(continuedTask.assignmentId).populate({
        path: "taskPlanId",
        populate: { path: "practiceItems.variantId" }
      });
      const today = dayStrings[dayStrings.length - 1];
      const assignedAt = makeIstDate(today, 19, 10);
      await Promise.all([
        backdateDocument(TaskAssignment, continuedAssignment._id, {
          assignedForDate: today,
          assignedAt,
          createdAt: assignedAt,
          updatedAt: assignedAt
        }),
        backdateDocument(StudentTaskPlan, continuedAssignment.taskPlanId?._id, {
          generatedAt: new Date(assignedAt.getTime() - 5 * 60000),
          createdAt: assignedAt,
          updatedAt: assignedAt
        })
      ]);
    }
  }
}

async function summarizeDemoSchool(schoolId) {
  const [studentCount, teacherCount, submissionCount, pathDocs, chapterTwoCount] = await Promise.all([
    User.countDocuments({ schoolId, role: "student" }),
    User.countDocuments({ schoolId, role: "teacher" }),
    Submission.countDocuments({ schoolId }),
    StudentLearningPath.find({ schoolId }).lean(),
    StudentLearningPath.countDocuments({ schoolId, currentChapterNumber: 2 })
  ]);

  return {
    studentCount,
    teacherCount,
    submissionCount,
    chapterOneStudents: pathDocs.filter((path) => Number(path.currentChapterNumber ?? 1) === 1).length,
    chapterTwoStudents: chapterTwoCount
  };
}

async function main() {
  await connectDatabase();
  await withRetries("ensureLibraryReady", () => ensureLibraryReady());
  await withRetries("deleteExistingDemoSchool", () => deleteExistingDemoSchool());

  const { school, admin, teacherDocs, studentDocs } = await withRetries("createPresentationSchool", () => createPresentationSchool());
  const dayStrings = Array.from({ length: 10 }, (_item, index) => buildSchoolDayWindow(9 - index, DEMO.timezone));

  for (const [index, studentRecord] of studentDocs.entries()) {
    console.log(`Seeding ${index + 1}/${studentDocs.length}: ${studentRecord.doc.fullName}`);
    await withRetries(`simulateStudentHistory:${studentRecord.doc.email}`, () =>
      simulateStudentHistory({
        school,
        studentRecord,
        dayStrings
      })
    );
  }

  const summary = await withRetries("summarizeDemoSchool", () => summarizeDemoSchool(school._id));

  console.log("");
  console.log("Presentation demo data created successfully.");
  console.log(JSON.stringify(summary, null, 2));
  console.log("");
  console.log("Demo school:");
  console.log(`  ${school.name}`);
  console.log("");
  console.log("Login credentials:");
  console.log(`  Admin:   ${admin.email} / ${DEMO.password}`);
  for (const teacher of teacherDocs) {
    console.log(`  Teacher: ${teacher.email} / ${DEMO.password}`);
  }
  console.log("");
  console.log("Student password:");
  console.log(`  All demo students use: ${DEMO.password}`);
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
