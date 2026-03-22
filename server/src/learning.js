import {
  Assessment,
  Classroom,
  Concept,
  ContentItem,
  InterventionAssignment,
  Question,
  Skill,
  SkillPrerequisite,
  StudentConceptMastery,
  StudentSkillMastery,
  Submission,
  TaskAssignment,
  User
} from "./models.js";
import { logMasteryChange } from "./eventCapture.js";
import { RULES, computeRiskLevel, explainRecommendation } from "./rules.js";

const starterConcepts = [
  {
    gradeLevel: "6",
    code: "G6-FRACTIONS",
    name: "Fractions",
    description: "Understand, compare, and operate on fractions."
  },
  {
    gradeLevel: "7",
    code: "G7-RATIOS",
    name: "Ratios",
    description: "Solve ratio and proportion problems."
  },
  {
    gradeLevel: "8",
    code: "G8-LINEAR-EQ",
    name: "Linear Equations",
    description: "Solve one-variable linear equations."
  },
  {
    gradeLevel: "10",
    code: "G10-REAL-NUMBERS",
    name: "Real Numbers",
    description: "Apply Euclid's division lemma, irrational numbers, and decimal expansions."
  },
  {
    gradeLevel: "10",
    code: "G10-POLYNOMIALS",
    name: "Polynomials",
    description: "Work with zeros of polynomials and relationships among coefficients."
  },
  {
    gradeLevel: "10",
    code: "G10-LINEAR-PAIRS",
    name: "Pair of Linear Equations",
    description: "Solve pair of linear equations graphically and algebraically."
  },
  {
    gradeLevel: "10",
    code: "G10-QUADRATICS",
    name: "Quadratic Equations",
    description: "Solve quadratic equations by factorization and formula methods."
  },
  {
    gradeLevel: "10",
    code: "G10-AP",
    name: "Arithmetic Progressions",
    description: "Find nth terms and sums of arithmetic progressions."
  },
  {
    gradeLevel: "10",
    code: "G10-TRIGONOMETRY",
    name: "Trigonometry",
    description: "Use trigonometric ratios, identities, and heights-distance applications."
  },
  {
    gradeLevel: "10",
    code: "G10-STATISTICS",
    name: "Statistics",
    description: "Interpret grouped data, mean, and cumulative frequency ideas."
  },
  {
    gradeLevel: "10",
    code: "G10-PROBABILITY",
    name: "Probability",
    description: "Compute theoretical probability for simple events."
  }
];

const starterContent = {
  "G6-FRACTIONS": [
    { type: "lesson", title: "Fraction explainer", body: "Visual introduction to numerators and denominators.", difficultyLevel: 1 },
    { type: "practice_set", title: "Fraction practice set", body: "Equivalent fractions and operations drill.", difficultyLevel: 2 },
    { type: "checkpoint", title: "Fraction checkpoint", body: "Short quiz for mastery validation.", difficultyLevel: 2 }
  ],
  "G7-RATIOS": [
    { type: "lesson", title: "Ratio explainer", body: "Interpret ratios and proportions in context.", difficultyLevel: 1 },
    { type: "practice_set", title: "Ratio practice set", body: "Word problems and equivalent ratio tables.", difficultyLevel: 2 },
    { type: "checkpoint", title: "Ratio checkpoint", body: "Quick proportion mastery quiz.", difficultyLevel: 2 }
  ],
  "G8-LINEAR-EQ": [
    { type: "lesson", title: "Equation explainer", body: "Balancing and isolating variables.", difficultyLevel: 1 },
    { type: "practice_set", title: "Equation practice set", body: "One-step and two-step equation drill.", difficultyLevel: 2 },
    { type: "checkpoint", title: "Equation checkpoint", body: "Short checkpoint on solving linear equations.", difficultyLevel: 2 }
  ],
  "G10-REAL-NUMBERS": [
    { type: "lesson", title: "Real numbers explainer", body: "Review Euclid's division lemma, irrational numbers, and decimal expansion ideas.", difficultyLevel: 1 },
    { type: "practice_set", title: "Real numbers practice set", body: "Use HCF/LCM and decimal expansion questions for class 10 revision.", difficultyLevel: 2 },
    { type: "checkpoint", title: "Real numbers checkpoint", body: "Short checkpoint on class 10 real number concepts.", difficultyLevel: 2 }
  ],
  "G10-POLYNOMIALS": [
    { type: "lesson", title: "Polynomials explainer", body: "Connect zeros, factorization, and coefficient relationships.", difficultyLevel: 1 },
    { type: "practice_set", title: "Polynomials practice set", body: "Work through factor and zero-based class 10 polynomial questions.", difficultyLevel: 2 },
    { type: "checkpoint", title: "Polynomials checkpoint", body: "Quick checkpoint on polynomial roots and identities.", difficultyLevel: 2 }
  ],
  "G10-LINEAR-PAIRS": [
    { type: "lesson", title: "Linear equations explainer", body: "Break down substitution, elimination, and graphical interpretations.", difficultyLevel: 1 },
    { type: "practice_set", title: "Linear equations practice set", body: "Solve pair-of-linear-equation problems with increasing complexity.", difficultyLevel: 2 },
    { type: "checkpoint", title: "Linear equations checkpoint", body: "Checkpoint on solving simultaneous equations accurately.", difficultyLevel: 2 }
  ],
  "G10-QUADRATICS": [
    { type: "lesson", title: "Quadratic equations explainer", body: "Understand standard form, factorization, and formula use.", difficultyLevel: 1 },
    { type: "practice_set", title: "Quadratic equations practice set", body: "Build accuracy on roots of class 10 quadratic equations.", difficultyLevel: 2 },
    { type: "checkpoint", title: "Quadratic equations checkpoint", body: "Checkpoint on selecting the right solving method and finding roots.", difficultyLevel: 2 }
  ],
  "G10-AP": [
    { type: "lesson", title: "Arithmetic progressions explainer", body: "Review common difference, nth term, and sum formulas.", difficultyLevel: 1 },
    { type: "practice_set", title: "Arithmetic progressions practice set", body: "Use nth-term and sum problems for arithmetic progressions.", difficultyLevel: 2 },
    { type: "checkpoint", title: "Arithmetic progressions checkpoint", body: "Short checkpoint on sequence pattern recognition and formulas.", difficultyLevel: 2 }
  ],
  "G10-TRIGONOMETRY": [
    { type: "lesson", title: "Trigonometry explainer", body: "Introduce ratios, standard values, and simple identities.", difficultyLevel: 1 },
    { type: "practice_set", title: "Trigonometry practice set", body: "Practice standard value, identity, and height-distance problems.", difficultyLevel: 2 },
    { type: "checkpoint", title: "Trigonometry checkpoint", body: "Checkpoint on trigonometric ratios and applications.", difficultyLevel: 2 }
  ],
  "G10-STATISTICS": [
    { type: "lesson", title: "Statistics explainer", body: "Summarize grouped data, mean, and cumulative frequency ideas.", difficultyLevel: 1 },
    { type: "practice_set", title: "Statistics practice set", body: "Interpret data tables and compute representative values.", difficultyLevel: 2 },
    { type: "checkpoint", title: "Statistics checkpoint", body: "Short checkpoint on grouped data interpretation.", difficultyLevel: 2 }
  ],
  "G10-PROBABILITY": [
    { type: "lesson", title: "Probability explainer", body: "Introduce theoretical probability and equally likely outcomes.", difficultyLevel: 1 },
    { type: "practice_set", title: "Probability practice set", body: "Solve single-event and simple experiment probability questions.", difficultyLevel: 2 },
    { type: "checkpoint", title: "Probability checkpoint", body: "Checkpoint on class 10 theoretical probability.", difficultyLevel: 2 }
  ]
};

const starterQuestions = {
  "G6-FRACTIONS": [
    { prompt: "Which fraction is equivalent to 1/2?", questionType: "mcq", options: ["2/3", "2/4", "3/5", "4/5"], correctAnswer: "2/4", explanation: "Equivalent fractions represent the same value.", difficultyLevel: 1 },
    { prompt: "What is 1/4 + 1/4?", questionType: "numeric", correctAnswer: "1/2", explanation: "Add numerators when denominators are the same.", difficultyLevel: 2 }
  ],
  "G7-RATIOS": [
    { prompt: "What is the ratio of 6 red balls to 3 blue balls?", questionType: "numeric", correctAnswer: "2:1", explanation: "Simplify 6:3 to 2:1.", difficultyLevel: 1 },
    { prompt: "If 2 notebooks cost 10, how much do 6 notebooks cost?", questionType: "numeric", correctAnswer: "30", explanation: "Multiply by 3.", difficultyLevel: 2 }
  ],
  "G8-LINEAR-EQ": [
    { prompt: "Solve: x + 5 = 9", questionType: "numeric", correctAnswer: "4", explanation: "Subtract 5 from both sides.", difficultyLevel: 1 },
    { prompt: "Solve: 2x = 14", questionType: "numeric", correctAnswer: "7", explanation: "Divide both sides by 2.", difficultyLevel: 1 }
  ]
};

const starterSkills = [
  {
    skillId: "addition_within_20",
    name: "Addition within 20",
    gradeLevel: "2",
    standard: "MATH-ADD-20",
    description: "Add single-digit numbers and bridge to 20."
  },
  {
    skillId: "repeated_addition",
    name: "Repeated Addition",
    gradeLevel: "3",
    standard: "MATH-REP-ADD",
    description: "Use repeated addition as a bridge to multiplication."
  },
  {
    skillId: "multiplication_tables",
    name: "Multiplication Tables",
    gradeLevel: "3",
    standard: "MATH-MULT-TABLES",
    description: "Recall multiplication facts and apply in quick calculations."
  },
  {
    skillId: "fractions_basic",
    name: "Fractions Basics",
    gradeLevel: "6",
    standard: "MATH-FRAC-BASIC",
    description: "Understand equivalence and basic fraction operations."
  },
  {
    skillId: "ratios_basic",
    name: "Ratios Basics",
    gradeLevel: "7",
    standard: "MATH-RATIO-BASIC",
    description: "Interpret and simplify ratio and proportion contexts."
  },
  {
    skillId: "linear_equations_basic",
    name: "Linear Equations Basics",
    gradeLevel: "8",
    standard: "MATH-LINEAR-BASIC",
    description: "Solve one-variable linear equations."
  },
  {
    skillId: "real_numbers_basic",
    name: "Real Numbers Basics",
    gradeLevel: "10",
    standard: "MATH-REAL-NUMBERS",
    description: "Work with Euclid's lemma, irrationality, and decimal representations."
  },
  {
    skillId: "polynomials_basic",
    name: "Polynomials Basics",
    gradeLevel: "10",
    standard: "MATH-POLYNOMIALS",
    description: "Interpret polynomial zeros and coefficient relationships."
  },
  {
    skillId: "linear_pairs_basic",
    name: "Pair of Linear Equations Basics",
    gradeLevel: "10",
    standard: "MATH-LINEAR-PAIRS",
    description: "Solve and interpret pair of linear equations."
  },
  {
    skillId: "quadratics_basic",
    name: "Quadratic Equations Basics",
    gradeLevel: "10",
    standard: "MATH-QUADRATICS",
    description: "Solve quadratic equations accurately and interpret roots."
  },
  {
    skillId: "ap_basic",
    name: "Arithmetic Progressions Basics",
    gradeLevel: "10",
    standard: "MATH-AP",
    description: "Work with arithmetic progression patterns, nth terms, and sums."
  },
  {
    skillId: "triangles_basic",
    name: "Triangles Basics",
    gradeLevel: "10",
    standard: "MATH-TRIANGLES",
    description: "Use triangle similarity and proportionality results in Class 10 contexts."
  },
  {
    skillId: "coordinate_geometry_basic",
    name: "Coordinate Geometry Basics",
    gradeLevel: "10",
    standard: "MATH-COORDINATE-GEOMETRY",
    description: "Work with section formula, distance, and coordinate representations."
  },
  {
    skillId: "trigonometry_basic",
    name: "Trigonometry Basics",
    gradeLevel: "10",
    standard: "MATH-TRIGONOMETRY",
    description: "Apply trigonometric ratios and standard identities."
  },
  {
    skillId: "trigonometry_applications_basic",
    name: "Applications of Trigonometry Basics",
    gradeLevel: "10",
    standard: "MATH-TRIG-APPLICATIONS",
    description: "Solve height and distance problems using trigonometric reasoning."
  },
  {
    skillId: "circles_basic",
    name: "Circles Basics",
    gradeLevel: "10",
    standard: "MATH-CIRCLES",
    description: "Use tangent properties and circle relationships accurately."
  },
  {
    skillId: "constructions_basic",
    name: "Constructions Basics",
    gradeLevel: "10",
    standard: "MATH-CONSTRUCTIONS",
    description: "Apply geometric construction steps with correctness and interpretation."
  },
  {
    skillId: "areas_circles_basic",
    name: "Areas Related to Circles Basics",
    gradeLevel: "10",
    standard: "MATH-AREAS-CIRCLES",
    description: "Work with sectors, segments, and area relationships in circles."
  },
  {
    skillId: "surface_areas_volumes_basic",
    name: "Surface Areas and Volumes Basics",
    gradeLevel: "10",
    standard: "MATH-SURFACE-AREAS-VOLUMES",
    description: "Solve mensuration problems using area and volume formulas."
  },
  {
    skillId: "statistics_basic",
    name: "Statistics Basics",
    gradeLevel: "10",
    standard: "MATH-STATISTICS",
    description: "Interpret grouped data and compute key statistics."
  },
  {
    skillId: "probability_basic",
    name: "Probability Basics",
    gradeLevel: "10",
    standard: "MATH-PROBABILITY",
    description: "Calculate probability for simple class 10 events."
  }
];

const starterSkillPrerequisites = [
  { skillId: "repeated_addition", prerequisiteSkillId: "addition_within_20" },
  { skillId: "multiplication_tables", prerequisiteSkillId: "repeated_addition" },
  { skillId: "fractions_basic", prerequisiteSkillId: "addition_within_20" },
  { skillId: "ratios_basic", prerequisiteSkillId: "fractions_basic" },
  { skillId: "linear_equations_basic", prerequisiteSkillId: "ratios_basic" },
  { skillId: "real_numbers_basic", prerequisiteSkillId: "linear_equations_basic" },
  { skillId: "polynomials_basic", prerequisiteSkillId: "real_numbers_basic" },
  { skillId: "linear_pairs_basic", prerequisiteSkillId: "polynomials_basic" },
  { skillId: "quadratics_basic", prerequisiteSkillId: "polynomials_basic" },
  { skillId: "ap_basic", prerequisiteSkillId: "linear_pairs_basic" },
  { skillId: "triangles_basic", prerequisiteSkillId: "quadratics_basic" },
  { skillId: "coordinate_geometry_basic", prerequisiteSkillId: "linear_pairs_basic" },
  { skillId: "trigonometry_basic", prerequisiteSkillId: "triangles_basic" },
  { skillId: "trigonometry_applications_basic", prerequisiteSkillId: "trigonometry_basic" },
  { skillId: "circles_basic", prerequisiteSkillId: "triangles_basic" },
  { skillId: "constructions_basic", prerequisiteSkillId: "triangles_basic" },
  { skillId: "areas_circles_basic", prerequisiteSkillId: "circles_basic" },
  { skillId: "surface_areas_volumes_basic", prerequisiteSkillId: "areas_circles_basic" },
  { skillId: "statistics_basic", prerequisiteSkillId: "ap_basic" },
  { skillId: "probability_basic", prerequisiteSkillId: "statistics_basic" }
];

const conceptSkillMap = {
  "G6-FRACTIONS": "fractions_basic",
  "G7-RATIOS": "ratios_basic",
  "G8-LINEAR-EQ": "linear_equations_basic",
  "G10-REAL-NUMBERS": "real_numbers_basic",
  "G10-POLYNOMIALS": "polynomials_basic",
  "G10-LINEAR-PAIRS": "linear_pairs_basic",
  "G10-QUADRATICS": "quadratics_basic",
  "G10-AP": "ap_basic",
  "G10-TRIANGLES": "triangles_basic",
  "G10-COORDINATE-GEOMETRY": "coordinate_geometry_basic",
  "G10-TRIGONOMETRY": "trigonometry_basic",
  "G10-TRIG-APPLICATIONS": "trigonometry_applications_basic",
  "G10-CIRCLES": "circles_basic",
  "G10-CONSTRUCTIONS": "constructions_basic",
  "G10-AREAS-CIRCLES": "areas_circles_basic",
  "G10-SURFACE-AREAS-VOLUMES": "surface_areas_volumes_basic",
  "G10-STATISTICS": "statistics_basic",
  "G10-PROBABILITY": "probability_basic"
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function confidenceFromPerformance(performanceScore) {
  if (performanceScore >= 0.75) return "high";
  if (performanceScore >= 0.45) return "medium";
  return "low";
}

function computePerformanceScore(answer) {
  const accuracy = answer.isCorrect ? 1 : 0;
  const speedScore = clamp(1 - (answer.responseTimeMs || 0) / 120000, 0, 1);
  const hintPenalty = clamp((answer.hintsUsed || 0) * 0.15, 0, 0.6);
  const retryPenalty = clamp((answer.retries || 0) * 0.15, 0, 0.6);
  const confidence = clamp(1 - hintPenalty - retryPenalty, 0, 1);
  return Number((accuracy * 0.6 + speedScore * 0.2 + confidence * 0.2).toFixed(3));
}

function computeMasteryDelta(isCorrect, performanceScore) {
  if (isCorrect) {
    return Number((0.05 + performanceScore * 0.05).toFixed(3));
  }
  return Number((-(0.05 + (1 - performanceScore) * 0.1)).toFixed(3));
}

async function getPrerequisiteSkill(skillId) {
  const edge = await SkillPrerequisite.findOne({ skillId }).lean();
  return edge?.prerequisiteSkillId ?? null;
}

async function getDependentSkill(skillId) {
  const edge = await SkillPrerequisite.findOne({ prerequisiteSkillId: skillId }).lean();
  return edge?.skillId ?? null;
}

export function getSkillIdForConceptCode(code) {
  return conceptSkillMap[code] ?? null;
}

export async function resolveQuestionMetadata(conceptIds) {
  const concepts = await Concept.find({ _id: { $in: conceptIds } }).lean();
  const gradeLevel = concepts[0]?.gradeLevel ?? "";
  const skillId = concepts.map((concept) => getSkillIdForConceptCode(concept.code)).find(Boolean) ?? null;

  return {
    concepts,
    gradeLevel,
    skillId
  };
}

export async function getNextSkillDecision(studentSkillMastery) {
  if (!studentSkillMastery) {
    return {
      nextSkillId: null,
      action: "continue",
      reason: "No skill mastery record exists yet."
    };
  }

  const { skillId, masteryScore, consecutiveWrong } = studentSkillMastery;

  if (consecutiveWrong >= 3 || masteryScore < 0.4) {
    const prerequisiteSkillId = await getPrerequisiteSkill(skillId);
    return {
      nextSkillId: prerequisiteSkillId || skillId,
      action: prerequisiteSkillId ? "fallback" : "continue",
      reason: prerequisiteSkillId
        ? "Mastery is low or student is struggling; move to prerequisite skill."
        : "No prerequisite skill exists; continue current skill."
    };
  }

  if (masteryScore > 0.8) {
    const harderSkillId = await getDependentSkill(skillId);
    return {
      nextSkillId: harderSkillId || skillId,
      action: harderSkillId ? "advance" : "continue",
      reason: harderSkillId
        ? "Mastery is above 0.8; move to the next dependent skill."
        : "No harder dependent skill exists; continue current skill."
    };
  }

  return {
    nextSkillId: skillId,
    action: "continue",
    reason: "Mastery is between 0.4 and 0.8; continue current skill."
  };
}

export async function updateSkillMasteryFromAnswers({ schoolId, classroomId, studentId, answers }) {
  const skillUpdates = [];

  for (const answer of answers) {
    const question = await Question.findById(answer.questionId).lean();
    if (!question?.skillId) continue;

    let mastery = await StudentSkillMastery.findOne({
      schoolId,
      classroomId,
      studentId,
      skillId: question.skillId
    });

    if (!mastery) {
      mastery = await StudentSkillMastery.create({
        schoolId,
        classroomId,
        studentId,
        skillId: question.skillId,
        masteryScore: 0,
        confidence: "medium",
        attempts: [],
        consecutiveWrong: 0
      });
    }

    const performanceScore = computePerformanceScore(answer);
    const delta = computeMasteryDelta(answer.isCorrect, performanceScore);
    mastery.masteryScore = Number(clamp(mastery.masteryScore + delta, 0, 1).toFixed(3));
    mastery.lastAttempt = new Date();
    mastery.consecutiveWrong = answer.isCorrect ? 0 : mastery.consecutiveWrong + 1;
    mastery.confidence = confidenceFromPerformance(performanceScore);
    mastery.attempts.push({
      questionId: answer.questionId,
      isCorrect: answer.isCorrect,
      responseTimeMs: answer.responseTimeMs || 0,
      hintsUsed: answer.hintsUsed || 0,
      retries: answer.retries || 0,
      performanceScore,
      masteryAfter: mastery.masteryScore,
      createdAt: new Date()
    });

    if (mastery.attempts.length > 200) {
      mastery.attempts = mastery.attempts.slice(-200);
    }

    await mastery.save();
    const decision = await getNextSkillDecision(mastery.toObject());
    skillUpdates.push({
      skillId: mastery.skillId,
      masteryScore: mastery.masteryScore,
      confidence: mastery.confidence,
      lastAttempt: mastery.lastAttempt,
      consecutiveWrong: mastery.consecutiveWrong,
      struggling: mastery.consecutiveWrong >= 3,
      nextSkill: decision,
      performanceScore
    });
  }

  return skillUpdates;
}

export async function ensureLearningSeedData() {
  await Skill.bulkWrite(
    starterSkills.map((skill) => ({
      updateOne: {
        filter: { skillId: skill.skillId },
        update: { $setOnInsert: skill },
        upsert: true
      }
    }))
  );

  await SkillPrerequisite.bulkWrite(
    starterSkillPrerequisites.map((edge) => ({
      updateOne: {
        filter: edge,
        update: { $setOnInsert: edge },
        upsert: true
      }
    }))
  );

  await Concept.bulkWrite(
    starterConcepts.map((concept) => ({
      updateOne: {
        filter: { code: concept.code },
        update: { $setOnInsert: { subject: "math", ...concept } },
        upsert: true
      }
    }))
  );

  const concepts = await Concept.find({ code: { $in: starterConcepts.map((concept) => concept.code) } }).lean();
  const conceptByCode = Object.fromEntries(concepts.map((concept) => [concept.code, concept]));

  const contentOperations = [];
  for (const [code, items] of Object.entries(starterContent)) {
    const concept = conceptByCode[code];
    if (!concept) continue;
    items.forEach((item) =>
      contentOperations.push({
        updateOne: {
          filter: { conceptId: concept._id, type: item.type, title: item.title },
          update: { $setOnInsert: { conceptId: concept._id, ...item } },
          upsert: true
        }
      })
    );
  }
  if (contentOperations.length > 0) {
    await ContentItem.bulkWrite(contentOperations);
  }

  const questionOperations = [];
  for (const [code, items] of Object.entries(starterQuestions)) {
    const concept = conceptByCode[code];
    if (!concept) continue;
    items.forEach((item) =>
      questionOperations.push({
        updateOne: {
          filter: { schoolId: null, prompt: item.prompt },
          update: {
            $setOnInsert: {
              schoolId: null,
              createdByUserId: null,
              conceptIds: [concept._id],
              skillId: conceptSkillMap[code],
              gradeLevel: concept.gradeLevel,
              topic: concept.name,
              options: item.options ?? [],
              expectedTimeSec: 60,
              hintWeight: 1,
              questionSource: "seed",
              reviewStatus: "approved",
              approvedForGeneration: true,
              teacherNotes: "",
              ...item
            }
          },
          upsert: true
        }
      })
    );
  }
  if (questionOperations.length > 0) {
    await Question.bulkWrite(questionOperations);
  }

  const allQuestions = await Question.find({ $or: [{ skillId: null }, { skillId: { $exists: false } }, { gradeLevel: null }, { gradeLevel: { $exists: false } }] })
    .populate("conceptIds");
  for (const question of allQuestions) {
    const firstConcept = question.conceptIds?.[0];
    if (!firstConcept) continue;

    if (!question.skillId) {
      const skillId = getSkillIdForConceptCode(firstConcept.code);
      if (skillId) {
        question.skillId = skillId;
      }
    }

    if (!question.gradeLevel) {
      question.gradeLevel = firstConcept.gradeLevel;
    }

    if (!question.topic) {
      question.topic = firstConcept.name;
    }

    if (!question.questionSource) {
      question.questionSource = question.schoolId ? "teacher" : "seed";
    }

    if (!question.reviewStatus) {
      question.reviewStatus = question.schoolId ? "draft" : "approved";
    }

    if (typeof question.approvedForGeneration !== "boolean") {
      question.approvedForGeneration = !question.schoolId;
    }

    await question.save();
  }
}

export async function updateMasteryFromAnswers({
  schoolId,
  classroomId,
  studentId,
  answers,
  sourceType,
  sourceSubmissionId,
  scorePercent
}) {
  const conceptBuckets = new Map();

  for (const answer of answers) {
    const question = await Question.findById(answer.questionId).lean();
    if (!question) continue;

    for (const conceptId of question.conceptIds) {
      const bucket = conceptBuckets.get(conceptId.toString()) ?? { conceptId, total: 0, correct: 0 };
      bucket.total += 1;
      if (answer.isCorrect) bucket.correct += 1;
      conceptBuckets.set(conceptId.toString(), bucket);
    }
  }

  const updatedMasteries = [];

  for (const bucket of conceptBuckets.values()) {
    const score = bucket.total ? bucket.correct / bucket.total : 0;
    const existing = await StudentConceptMastery.findOne({
      schoolId,
      classroomId,
      studentId,
      conceptId: bucket.conceptId
    });

    if (!existing) {
      const mastery = await StudentConceptMastery.create({
        schoolId,
        classroomId,
        studentId,
        conceptId: bucket.conceptId,
        baselineMastery: sourceType === "diagnostic" ? score : score,
        currentMastery: score,
        riskLevel: computeRiskLevel(score),
        attemptsCount: 1
      });
      await logMasteryChange({
        schoolId,
        studentId,
        classroomId,
        conceptId: bucket.conceptId,
        previousMastery: 0,
        newMastery: mastery.currentMastery,
        previousRiskLevel: "high",
        newRiskLevel: mastery.riskLevel,
        sourceSubmissionId,
        sourceType,
        scorePercent,
        attemptCountBefore: 0,
        attemptCountAfter: mastery.attemptsCount
      });
      updatedMasteries.push(mastery);
      continue;
    }

    if (sourceType === "diagnostic" && existing.attemptsCount === 0) {
      existing.baselineMastery = score;
    }

    const previousMastery = existing.currentMastery;
    const previousRiskLevel = existing.riskLevel;
    const attemptCountBefore = existing.attemptsCount;

    existing.currentMastery = Number(((existing.currentMastery * existing.attemptsCount + score) / (existing.attemptsCount + 1)).toFixed(3));
    existing.attemptsCount += 1;
    existing.riskLevel = computeRiskLevel(existing.currentMastery);
    await existing.save();
    await logMasteryChange({
      schoolId,
      studentId,
      classroomId,
      conceptId: bucket.conceptId,
      previousMastery,
      newMastery: existing.currentMastery,
      previousRiskLevel,
      newRiskLevel: existing.riskLevel,
      sourceSubmissionId,
      sourceType,
      scorePercent,
      attemptCountBefore,
      attemptCountAfter: existing.attemptsCount
    });
    updatedMasteries.push(existing);
  }

  return updatedMasteries;
}

export async function scoreAssessmentSubmission({ schoolId, classroomId, studentId, assessmentId, rawAnswers, sourceType }) {
  const questions = await Question.find({ _id: { $in: rawAnswers.map((answer) => answer.questionId) } }).lean();
  const questionMap = new Map(questions.map((question) => [question._id.toString(), question]));

  const answers = rawAnswers.map((answer) => {
    const question = questionMap.get(answer.questionId);
    const submittedAnswer = String(answer.submittedAnswer).trim();
    const correctAnswer = String(question?.correctAnswer ?? "").trim();

    return {
      questionId: answer.questionId,
      submittedAnswer,
      isCorrect: submittedAnswer.toLowerCase() === correctAnswer.toLowerCase(),
      responseTimeMs: Number(answer.responseTimeMs || 0),
      hintsUsed: Number(answer.hintsUsed || 0),
      retries: Number(answer.retries || 0)
    };
  });

  const correctCount = answers.filter((answer) => answer.isCorrect).length;
  const scorePercent = answers.length ? Number(((correctCount / answers.length) * 100).toFixed(2)) : 0;

  const submission = await Submission.create({
    schoolId,
    assessmentId,
    studentId,
    classroomId,
    answers,
    scorePercent,
    sourceType
  });

  const masteries = await updateMasteryFromAnswers({
    schoolId,
    classroomId,
    studentId,
    answers,
    sourceType,
    sourceSubmissionId: submission._id,
    scorePercent
  });

  const skillMasteries = await updateSkillMasteryFromAnswers({
    schoolId,
    classroomId,
    studentId,
    answers
  });

  const nextSkillRecommendation = skillMasteries[skillMasteries.length - 1]?.nextSkill ?? null;
  const struggling = skillMasteries.some((item) => item.struggling);

  return { submission, masteries, scorePercent, skillMasteries, nextSkillRecommendation, struggling };
}

export async function getStudentRecommendations(studentId) {
  const masteries = await StudentConceptMastery.find({ studentId }).sort({ currentMastery: 1 }).lean();
  const topWeakConcepts = masteries
    .filter((item) => item.currentMastery < RULES.risk.medium)
    .slice(0, RULES.recommendations.maxWeakConcepts);

  const recommendations = [];

  for (const [index, mastery] of topWeakConcepts.entries()) {
    const concept = await Concept.findById(mastery.conceptId).lean();
    const content = await ContentItem.find({ conceptId: mastery.conceptId }).sort({ difficultyLevel: 1 }).lean();

    recommendations.push({
      conceptId: mastery.conceptId,
      concept: concept?.name ?? "Concept",
      mastery: mastery.currentMastery,
      rationale: explainRecommendation({ mastery: mastery.currentMastery, rank: index + 1 }),
      items: content.map((item) => ({
        id: item._id,
        type: item.type,
        title: item.title,
        body: item.body
      }))
    });
  }

  return recommendations;
}

export async function getStudentPracticeRunner(studentId, conceptId) {
  const concept = await Concept.findById(conceptId).lean();
  const contentItems = await ContentItem.find({ conceptId }).sort({ difficultyLevel: 1 }).lean();
  const questions = await Question.find({ conceptIds: conceptId }).lean();
  const mastery = await StudentConceptMastery.findOne({ studentId, conceptId }).lean();

  return {
    concept: {
      id: concept?._id,
      name: concept?.name ?? "Concept",
      description: concept?.description ?? ""
    },
    mastery: mastery ? Math.round(mastery.currentMastery * 100) : 0,
    lesson: contentItems.find((item) => item.type === "lesson") ?? null,
    practiceSet: contentItems.find((item) => item.type === "practice_set") ?? null,
    checkpoint: contentItems.find((item) => item.type === "checkpoint") ?? null,
    questions: questions.map((question) => ({
      _id: question._id,
      prompt: question.prompt,
      questionType: question.questionType,
      options: question.options,
      difficultyLevel: question.difficultyLevel
    }))
  };
}

export async function getStudentSkillTimeline({ schoolId, studentId, skillId }) {
  const mastery = await StudentSkillMastery.findOne({ schoolId, studentId, skillId }).lean();
  if (!mastery) {
    return { skillId, attempts: [], masteryScore: 0, confidence: "medium", lastAttempt: null };
  }

  return {
    skillId,
    masteryScore: mastery.masteryScore,
    confidence: mastery.confidence,
    lastAttempt: mastery.lastAttempt,
    attempts: mastery.attempts.map((attempt) => ({
      questionId: attempt.questionId,
      isCorrect: attempt.isCorrect,
      responseTimeMs: attempt.responseTimeMs,
      hintsUsed: attempt.hintsUsed,
      retries: attempt.retries,
      performanceScore: attempt.performanceScore,
      masteryAfter: attempt.masteryAfter,
      createdAt: attempt.createdAt
    }))
  };
}

export async function getStudentNextSkillRecommendation({ schoolId, classroomId, studentId, skillId }) {
  const mastery = await StudentSkillMastery.findOne({ schoolId, classroomId, studentId, skillId }).lean();
  const decision = await getNextSkillDecision(mastery);
  return {
    currentSkillId: skillId,
    masteryScore: mastery?.masteryScore ?? 0,
    confidence: mastery?.confidence ?? "medium",
    consecutiveWrong: mastery?.consecutiveWrong ?? 0,
    recommendation: {
      ...decision,
      rationale: {
        ruleId: "skill-next-step-v1",
        inputs: {
          masteryScore: mastery?.masteryScore ?? 0,
          consecutiveWrong: mastery?.consecutiveWrong ?? 0
        },
        decision: decision.action
      }
    }
  };
}

export async function getPrerequisiteGapDiagnostics({ schoolId, classroomId, studentId, skillId }) {
  const prerequisites = await SkillPrerequisite.find({ skillId }).lean();
  if (prerequisites.length === 0) {
    return {
      skillId,
      prerequisites: [],
      message: "No prerequisite skill configured."
    };
  }

  const prerequisiteIds = prerequisites.map((item) => item.prerequisiteSkillId);
  const masteries = await StudentSkillMastery.find({
    schoolId,
    classroomId,
    studentId,
    skillId: { $in: prerequisiteIds }
  }).lean();
  const masteryMap = new Map(masteries.map((item) => [item.skillId, item]));

  const diagnostics = prerequisiteIds.map((id) => {
    const entry = masteryMap.get(id);
    const masteryScore = entry?.masteryScore ?? 0;
    return {
      prerequisiteSkillId: id,
      masteryScore,
      requiredMastery: 0.4,
      gap: Number((0.4 - masteryScore).toFixed(3)),
      ready: masteryScore >= 0.4
    };
  });

  return {
    skillId,
    prerequisites: diagnostics,
    message: diagnostics.every((item) => item.ready)
      ? "All prerequisites satisfied."
      : "Some prerequisites are below the required mastery threshold."
  };
}

async function buildTeacherSkillInsights({ schoolId, studentIds }) {
  const records = await StudentSkillMastery.find({ schoolId, studentId: { $in: studentIds } }).lean();
  const heatmapBySkill = new Map();
  const alerts = [];

  for (const record of records) {
    const current = heatmapBySkill.get(record.skillId) ?? { skillId: record.skillId, red: 0, yellow: 0, green: 0 };
    if (record.masteryScore > 0.8) current.green += 1;
    else if (record.masteryScore >= 0.5) current.yellow += 1;
    else current.red += 1;
    heatmapBySkill.set(record.skillId, current);

    if (record.consecutiveWrong >= 3) {
      alerts.push({
        studentId: record.studentId,
        skillId: record.skillId,
        level: "warning",
        message: "Student is struggling on this skill (3 or more wrong in a row)."
      });
    }
  }

  return {
    skillHeatmap: [...heatmapBySkill.values()],
    skillAlerts: alerts
  };
}

export async function assignRecommendedIntervention({ schoolId, teacherId, studentId, classroomId, conceptId }) {
  const content = await ContentItem.find({ conceptId }).sort({ difficultyLevel: 1 }).lean();
  const contentIds = content.slice(0, 3).map((item) => item._id);

  return InterventionAssignment.create({
    schoolId,
    teacherId,
    studentId,
    classroomId,
    conceptId,
    contentItemIds: contentIds
  });
}

export async function buildTeacherDashboardData({ schoolId, teacherId }) {
  const classrooms = await Classroom.find({ schoolId, teacherId }).lean();
  const classroomIds = classrooms.map((classroom) => classroom._id);
  const students = await User.find({ schoolId, role: "student", classroomId: { $in: classroomIds } }).lean();
  const studentIds = students.map((student) => student._id);
  const masteries = await StudentConceptMastery.find({ schoolId, studentId: { $in: studentIds } }).lean();
  const concepts = await Concept.find().lean();
  const conceptMap = new Map(concepts.map((concept) => [concept._id.toString(), concept]));
  const interventions = await InterventionAssignment.find({ schoolId, teacherId }).lean();
  const skillInsights = await buildTeacherSkillInsights({ schoolId, studentIds });

  const masteryByStudent = new Map();
  for (const mastery of masteries) {
    const key = mastery.studentId.toString();
    const list = masteryByStudent.get(key) ?? [];
    list.push(mastery);
    masteryByStudent.set(key, list);
  }

  const flaggedStudents = students
    .map((student) => {
      const studentMasteries = (masteryByStudent.get(student._id.toString()) ?? []).sort(
        (a, b) => a.currentMastery - b.currentMastery
      );
      const weakConcepts = studentMasteries.filter((item) => item.currentMastery < RULES.risk.medium);
      const highRiskCount = weakConcepts.filter((item) => item.riskLevel === "high").length;
      const risk =
        highRiskCount >= 2 || (highRiskCount >= 1 && student.status === "inactive")
          ? "High"
          : weakConcepts.length > 0
            ? "Medium"
            : "Low";

      return {
        studentId: student._id,
        name: student.fullName,
        risk,
        classroomId: student.classroomId,
        primaryConceptId: weakConcepts[0]?.conceptId ?? null,
        weakConcepts: weakConcepts.map((item) => conceptMap.get(item.conceptId.toString())?.name ?? "Concept"),
        lastActive: student.updatedAt,
        nextAction: weakConcepts.length > 0 ? `Assign ${conceptMap.get(weakConcepts[0].conceptId.toString())?.name ?? "remediation"} pack` : "Monitor progress"
      };
    })
    .sort((a, b) => ["High", "Medium", "Low"].indexOf(a.risk) - ["High", "Medium", "Low"].indexOf(b.risk));

  const conceptStats = new Map();
  for (const mastery of masteries) {
    if (mastery.currentMastery >= RULES.risk.medium) continue;
    const concept = conceptMap.get(mastery.conceptId.toString());
    const current = conceptStats.get(mastery.conceptId.toString()) ?? {
      name: concept?.name ?? "Concept",
      band: mastery.riskLevel === "high" ? "Critical" : "Watchlist",
      summary: concept?.description ?? "",
      studentsFlagged: 0
    };
    current.studentsFlagged += 1;
    conceptStats.set(mastery.conceptId.toString(), current);
  }

  return {
    classrooms,
    flaggedStudents,
    classConcepts: [...conceptStats.values()],
    interventionsCount: interventions.length,
    skillHeatmap: skillInsights.skillHeatmap,
    skillAlerts: skillInsights.skillAlerts
  };
}

export async function buildAdminSummary({ schoolId }) {
  const teacherCount = await User.countDocuments({ schoolId, role: "teacher" });
  const studentCount = await User.countDocuments({ schoolId, role: "student" });
  const classroomCount = await Classroom.countDocuments({ schoolId });
  const assignmentsCompletedCount = await TaskAssignment.countDocuments({ schoolId, status: "completed" });
  const submissions = await Submission.find({ schoolId }).lean();
  const flaggedCount = await StudentConceptMastery.countDocuments({
    schoolId,
    currentMastery: { $lt: RULES.risk.medium }
  });

  const averageImprovement = await StudentConceptMastery.aggregate([
    { $match: { schoolId } },
    {
      $project: {
        improvement: { $subtract: ["$currentMastery", "$baselineMastery"] }
      }
    },
    {
      $group: {
        _id: null,
        averageImprovement: { $avg: "$improvement" }
      }
    }
  ]);

  return {
    metrics: [
      { label: "Teachers active", value: String(teacherCount) },
      { label: "Students onboarded", value: String(studentCount) },
      { label: "Classrooms live", value: String(classroomCount) },
      { label: "Assignments completed", value: String(assignmentsCompletedCount) }
    ],
    participation: {
      assignmentCompletionPercent:
        studentCount === 0 ? 0 : Math.round((assignmentsCompletedCount / Math.max(studentCount, 1)) * 100),
      flaggedStudentsCount: flaggedCount,
      averageImprovement: Number((((averageImprovement[0]?.averageImprovement ?? 0) * 100)).toFixed(1))
    }
  };
}

export async function buildTeacherReportData({ schoolId, teacherId }) {
  const dashboard = await buildTeacherDashboardData({ schoolId, teacherId });
  const classrooms = dashboard.classrooms.map((item) => item._id);
  const students = await User.find({ schoolId, role: "student", classroomId: { $in: classrooms } }).lean();
  const studentIds = students.map((student) => student._id);
  const interventions = await InterventionAssignment.find({ schoolId, teacherId }).lean();
  const submissions = await Submission.find({ schoolId, studentId: { $in: studentIds } }).lean();
  const masteries = await StudentConceptMastery.find({ schoolId, studentId: { $in: studentIds } }).lean();

  const improvement = masteries.map((item) => item.currentMastery - item.baselineMastery);
  const averageImprovement = improvement.length
    ? Number(((improvement.reduce((sum, value) => sum + value, 0) / improvement.length) * 100).toFixed(1))
    : 0;

  return {
    metrics: [
      { label: "Interventions assigned", value: String(interventions.length) },
      { label: "Active flagged students", value: String(dashboard.flaggedStudents.filter((item) => item.risk !== "Low").length) },
      { label: "Average improvement", value: `${averageImprovement}%` },
      { label: "Assignment submissions", value: String(submissions.length) }
    ],
    interventionBreakdown: dashboard.classConcepts.map((concept) => ({
      concept: concept.name,
      flagged: concept.studentsFlagged
    })),
    studentGrowth: dashboard.flaggedStudents.slice(0, 6).map((student) => {
      const studentMasteries = masteries.filter((item) => item.studentId.toString() === student.studentId.toString());
      const avgGrowth = studentMasteries.length
        ? Number((((studentMasteries.reduce((sum, item) => sum + (item.currentMastery - item.baselineMastery), 0)) / studentMasteries.length) * 100).toFixed(1))
        : 0;
      return {
        name: student.name,
        risk: student.risk,
        improvement: avgGrowth
      };
    })
  };
}
