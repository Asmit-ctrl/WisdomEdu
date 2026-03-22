import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const chapterDirectory = path.resolve(__dirname, "../data/class10-chapters");

let cachedLibrary = null;

export async function loadClass10ChapterLibrary() {
  if (cachedLibrary) {
    return cachedLibrary;
  }

  const files = (await readdir(chapterDirectory))
    .filter((fileName) => fileName.endsWith(".json"))
    .sort((left, right) => left.localeCompare(right));

  const payloads = await Promise.all(
    files.map(async (fileName) => {
      const raw = await readFile(path.join(chapterDirectory, fileName), "utf8");
      return JSON.parse(raw);
    })
  );

  const firstPayload = payloads[0] ?? {
    subject: "math",
    gradeLevel: "10",
    curriculum: "Class 10 General Math MVP Seed"
  };

  cachedLibrary = {
    subject: firstPayload.subject,
    gradeLevel: firstPayload.gradeLevel,
    curriculum: firstPayload.curriculum,
    chapters: payloads.flatMap((payload) => payload.chapters ?? [])
  };

  return cachedLibrary;
}
