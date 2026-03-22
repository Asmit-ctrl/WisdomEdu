import { connectDatabase } from "./db.js";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Concept, ContentItem, Question, Skill } from "./models.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const class10ChapterDirectory = path.resolve(__dirname, "../data/class10-chapters");

async function loadClass10Library() {
  const chapterFiles = (await readdir(class10ChapterDirectory))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  const chapterPayloads = await Promise.all(
    chapterFiles.map(async (fileName) => {
      const filePath = path.join(class10ChapterDirectory, fileName);
      const raw = await readFile(filePath, "utf8");
      return JSON.parse(raw);
    })
  );

  const firstPayload = chapterPayloads[0] ?? {
    subject: "math",
    gradeLevel: "10",
    curriculum: "Class 10 General Math MVP Seed",
    chapters: []
  };

  return {
    subject: firstPayload.subject,
    gradeLevel: firstPayload.gradeLevel,
    curriculum: firstPayload.curriculum,
    chapters: chapterPayloads.flatMap((payload) => payload.chapters ?? [])
  };
}

function buildContentItems(chapter) {
  return [
    {
      type: "lesson",
      title: `${chapter.name} explainer`,
      body: chapter.lessonSummary,
      difficultyLevel: 1
    },
    {
      type: "practice_set",
      title: `${chapter.name} practice set`,
      body: chapter.practiceFocus,
      difficultyLevel: 2
    },
    {
      type: "checkpoint",
      title: `${chapter.name} checkpoint`,
      body: chapter.checkpointGoal,
      difficultyLevel: 2
    }
  ];
}

async function upsertClass10Library() {
  const class10MathLibrary = await loadClass10Library();
  const chapters = class10MathLibrary.chapters ?? [];

  await Skill.bulkWrite(
    chapters.map((chapter) => ({
      updateOne: {
        filter: { skillId: chapter.skillId },
        update: {
          $setOnInsert: {
            schoolId: null,
            skillId: chapter.skillId,
            name: chapter.skillName,
            gradeLevel: class10MathLibrary.gradeLevel,
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
            subject: class10MathLibrary.subject,
            gradeLevel: class10MathLibrary.gradeLevel,
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
  const conceptByCode = Object.fromEntries(concepts.map((concept) => [concept.code, concept]));

  const contentOperations = [];
  const questionOperations = [];

  for (const chapter of chapters) {
    const concept = conceptByCode[chapter.code];
    if (!concept) continue;

    for (const contentItem of buildContentItems(chapter)) {
      contentOperations.push({
        updateOne: {
          filter: {
            conceptId: concept._id,
            type: contentItem.type,
            title: contentItem.title
          },
          update: {
            $setOnInsert: {
              conceptId: concept._id,
              ...contentItem
            }
          },
          upsert: true
        }
      });
    }

    for (const question of chapter.questions ?? []) {
      questionOperations.push({
        updateOne: {
          filter: {
            schoolId: null,
            prompt: question.prompt
          },
          update: {
            $setOnInsert: {
              schoolId: null,
              createdByUserId: null,
              conceptIds: [concept._id],
              skillId: chapter.skillId,
              gradeLevel: class10MathLibrary.gradeLevel,
              topic: question.topic || chapter.name,
              prompt: question.prompt,
              questionType: question.questionType,
              options: question.options ?? [],
              correctAnswer: String(question.correctAnswer),
              explanation: question.explanation,
              difficultyLevel: question.difficultyLevel,
              expectedTimeSec: question.expectedTimeSec ?? 90,
              hintWeight: question.hintWeight ?? 1,
              reviewStatus: "approved",
              approvedForGeneration: true,
              questionSource: "seed",
              teacherNotes: `Seeded from original Class 10 library: ${chapter.name}.`
            }
          },
          upsert: true
        }
      });
    }
  }

  if (contentOperations.length > 0) {
    await ContentItem.bulkWrite(contentOperations);
  }

  if (questionOperations.length > 0) {
    await Question.bulkWrite(questionOperations);
  }

  console.log(`Seeded ${chapters.length} class 10 chapters.`);
}

connectDatabase()
  .then(() => upsertClass10Library())
  .then(() => {
    console.log("Class 10 math library import completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed to import class 10 math library", error);
    process.exit(1);
  });
