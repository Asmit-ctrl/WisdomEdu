export function numericQuestion(topic, prompt, correctAnswer, explanation, difficultyLevel = 2, expectedTimeSec = 75) {
  return {
    topic,
    prompt,
    questionType: "numeric",
    options: [],
    correctAnswer: String(correctAnswer),
    explanation,
    difficultyLevel,
    expectedTimeSec,
    hintWeight: 1
  };
}

export function mcqQuestion(topic, prompt, options, correctAnswer, explanation, difficultyLevel = 2, expectedTimeSec = 75) {
  return {
    topic,
    prompt,
    questionType: "mcq",
    options,
    correctAnswer: String(correctAnswer),
    explanation,
    difficultyLevel,
    expectedTimeSec,
    hintWeight: 1
  };
}

export function createChapter(definition) {
  return {
    ...definition,
    questions: definition.questions.slice(0, 50)
  };
}

export function formatFraction(numerator, denominator) {
  return `${numerator}/${denominator}`;
}

export function square(value) {
  return value * value;
}
