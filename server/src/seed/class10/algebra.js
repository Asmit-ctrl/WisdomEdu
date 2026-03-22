import { createChapter, mcqQuestion, numericQuestion, formatFraction } from "./helpers.js";

function buildRealNumbersQuestions() {
  const euclidCases = [
    [245, 24, 5],
    [367, 15, 7],
    [518, 21, 14],
    [629, 18, 17],
    [742, 16, 6],
    [853, 19, 17],
    [914, 22, 12],
    [1007, 27, 8],
    [1125, 23, 21],
    [1289, 31, 18]
  ];
  const decimalCases = [
    ["3/8", true],
    ["7/12", false],
    ["9/20", true],
    ["11/18", false],
    ["13/25", true],
    ["17/30", false],
    ["21/125", true],
    ["19/45", false],
    ["27/40", true],
    ["14/33", false]
  ];
  const hcfCases = [
    [96, 144, 48],
    [84, 126, 42],
    [72, 90, 18],
    [108, 180, 36],
    [54, 81, 27],
    [132, 154, 22],
    [150, 225, 75],
    [160, 240, 80],
    [119, 161, 7],
    [168, 252, 84]
  ];

  return [
    ...euclidCases.map(([value, divisor, remainder]) =>
      numericQuestion(
        "Euclid division lemma",
        `Using Euclid's division lemma, write ${value} in the form ${divisor}q + r. What is r?`,
        remainder,
        `${value} = ${divisor} x ${Math.floor(value / divisor)} + ${remainder}.`,
        2,
        80
      )
    ),
    ...decimalCases.map(([fraction, terminating]) =>
      mcqQuestion(
        "Decimal expansion",
        `Which statement about ${fraction} is correct?`,
        ["Its decimal expansion terminates", "Its decimal expansion is non-terminating recurring", "It is irrational", "It is not a rational number"],
        terminating ? "Its decimal expansion terminates" : "Its decimal expansion is non-terminating recurring",
        terminating
          ? `${fraction} simplifies to a denominator with only 2s and/or 5s, so its decimal form terminates.`
          : `${fraction} does not simplify to a denominator of the form 2^m5^n, so its decimal form is recurring.`,
        2,
        70
      )
    ),
    ...hcfCases.map(([a, b, answer]) =>
      numericQuestion(
        "HCF and LCM",
        `What is the HCF of ${a} and ${b}?`,
        answer,
        `Using prime factorization or Euclid's algorithm gives HCF = ${answer}.`,
        2,
        75
      )
    )
  ];
}

function buildPolynomialsQuestions() {
  const sumCases = [
    ["x^2 - 7x + 10", 7],
    ["x^2 - 11x + 24", 11],
    ["2x^2 - 9x + 4", formatFraction(9, 2)],
    ["3x^2 - 12x + 9", 4],
    ["x^2 + 5x + 6", -5],
    ["x^2 - x - 12", 1],
    ["4x^2 - 20x + 21", 5],
    ["x^2 - 13x + 40", 13],
    ["2x^2 + x - 3", formatFraction(-1, 2)],
    ["5x^2 - 15x + 10", 3]
  ];
  const productCases = [
    ["x^2 - 7x + 10", 10],
    ["x^2 - 11x + 24", 24],
    ["2x^2 - 9x + 4", 2],
    ["3x^2 - 12x + 9", 3],
    ["x^2 + 5x + 6", 6],
    ["x^2 - x - 12", -12],
    ["4x^2 - 20x + 21", formatFraction(21, 4)],
    ["x^2 - 13x + 40", 40],
    ["2x^2 + x - 3", formatFraction(-3, 2)],
    ["5x^2 - 15x + 10", 2]
  ];
  const rootPairs = [
    [4, -1, "x^2 - 3x - 4"],
    [2, 5, "x^2 - 7x + 10"],
    [-3, -4, "x^2 + 7x + 12"],
    [1, -6, "x^2 + 5x - 6"],
    [3, 3, "x^2 - 6x + 9"],
    [7, -2, "x^2 - 5x - 14"],
    [5, 6, "x^2 - 11x + 30"],
    [-1, 8, "x^2 - 7x - 8"],
    [2, -3, "x^2 + x - 6"],
    [4, 4, "x^2 - 8x + 16"]
  ];

  return [
    ...sumCases.map(([poly, answer]) =>
      numericQuestion(
        "Sum of zeros",
        `For the polynomial ${poly}, what is the sum of the zeros?`,
        answer,
        `For ax^2 + bx + c, sum of zeros = -b/a.`,
        1,
        55
      )
    ),
    ...productCases.map(([poly, answer]) =>
      numericQuestion(
        "Product of zeros",
        `For the polynomial ${poly}, what is the product of the zeros?`,
        answer,
        `For ax^2 + bx + c, product of zeros = c/a.`,
        1,
        55
      )
    ),
    ...rootPairs.map(([alpha, beta, polynomial]) =>
      mcqQuestion(
        "Forming polynomial",
        `A quadratic polynomial has zeros ${alpha} and ${beta}. Which polynomial matches this?`,
        [
          polynomial,
          `x^2 + ${alpha + beta}x + ${alpha * beta}`,
          `x^2 - ${alpha - beta}x + ${alpha * beta}`,
          `x^2 + ${beta - alpha}x - ${alpha * beta}`
        ],
        polynomial,
        `A monic quadratic with zeros alpha and beta is x^2 - (alpha + beta)x + alphabeta.`,
        2,
        80
      )
    )
  ];
}

function buildLinearPairsQuestions() {
  const solveCases = [
    [[1, 1, 9], [1, -1, 1], 5, 4],
    [[2, 1, 11], [1, -1, 1], 4, 3],
    [[3, 1, 13], [1, -1, 1], 3.5, 2.5],
    [[1, 2, 12], [1, -1, 0], 4, 4],
    [[2, 3, 18], [1, -1, 1], 3, 2],
    [[4, 1, 21], [1, -1, 3], 4.8, 1.8],
    [[5, 2, 24], [1, -1, 2], 4, 2],
    [[3, 2, 19], [1, -1, 1], 4.2, 3.2],
    [[2, 5, 24], [1, -1, 0], 24/7, 24/7],
    [[6, 1, 31], [1, -1, 3], 34/7, 13/7]
  ];
  const classificationCases = [
    ["x + y = 4 and x + y = 6", "No solution"],
    ["x + y = 4 and 2x + 2y = 8", "Infinitely many solutions"],
    ["x - y = 2 and 2x - 2y = 4", "Infinitely many solutions"],
    ["2x + y = 7 and x + y = 5", "Unique solution"],
    ["3x - y = 4 and 3x - y = 9", "No solution"],
    ["x + 2y = 8 and 2x + 4y = 16", "Infinitely many solutions"],
    ["x + 2y = 8 and 2x + 4y = 20", "No solution"],
    ["2x - 3y = 5 and x + y = 7", "Unique solution"],
    ["4x + y = 9 and 8x + 2y = 18", "Infinitely many solutions"],
    ["4x + y = 9 and 8x + 2y = 20", "No solution"]
  ];
  const wordCases = [
    [70, 50, 20],
    [85, 60, 25],
    [96, 66, 30],
    [110, 75, 35],
    [125, 85, 40],
    [140, 95, 45],
    [155, 105, 50],
    [168, 114, 54],
    [182, 122, 60],
    [196, 131, 65]
  ];

  return [
    ...solveCases.map(([[a1, b1, c1], [a2, b2, c2], x]) =>
      numericQuestion(
        "Solving pair of equations",
        `Solve the system ${a1}x + ${b1}y = ${c1} and ${a2}x + ${b2}y = ${c2}. What is x?`,
        x,
        `Solve using elimination or substitution to obtain x = ${x}.`,
        2,
        90
      )
    ),
    ...classificationCases.map(([text, answer]) =>
      mcqQuestion(
        "Consistency of pair of equations",
        `The pair ${text} has:`,
        ["Unique solution", "No solution", "Infinitely many solutions", "Exactly three solutions"],
        answer,
        `Compare the coefficients and constants to classify the pair.`,
        2,
        80
      )
    ),
    ...wordCases.map(([twoPensOneNotebook, onePenOneNotebook, penCost]) =>
      numericQuestion(
        "Word problem on pair of equations",
        `Two pens and one notebook cost ${twoPensOneNotebook}. One pen and one notebook cost ${onePenOneNotebook}. What is the cost of one pen?`,
        penCost,
        `Subtract the second equation from the first to isolate the pen cost.`,
        2,
        85
      )
    )
  ];
}

function buildQuadraticQuestions() {
  const factorCases = [
    ["x^2 - 9x + 20 = 0", 4],
    ["x^2 - 7x + 10 = 0", 2],
    ["x^2 - 11x + 24 = 0", 3],
    ["x^2 - 8x + 12 = 0", 2],
    ["x^2 - 6x + 8 = 0", 2],
    ["x^2 - 10x + 21 = 0", 3],
    ["x^2 - 13x + 40 = 0", 5],
    ["x^2 - 12x + 35 = 0", 5],
    ["x^2 - 5x + 6 = 0", 2],
    ["x^2 - 15x + 54 = 0", 6]
  ];
  const discriminantCases = [
    ["x^2 - 6x + 9 = 0", 1],
    ["x^2 - 5x + 6 = 0", 2],
    ["x^2 + x + 1 = 0", 0],
    ["x^2 - 4x + 4 = 0", 1],
    ["x^2 - 2x - 3 = 0", 2],
    ["x^2 + 2x + 5 = 0", 0],
    ["x^2 - 8x + 16 = 0", 1],
    ["x^2 - x - 12 = 0", 2],
    ["x^2 + 4x + 4 = 0", 1],
    ["x^2 + 6x + 10 = 0", 0]
  ];
  const kCases = [
    [-2, -2],
    [3, -5],
    [4, -2],
    [-1, 7],
    [5, -6],
    [2, -1],
    [-3, 11],
    [6, -10],
    [1, 7],
    [-4, 2]
  ];

  return [
    ...factorCases.map(([equation, answer]) =>
      numericQuestion(
        "Factorization",
        `Solve ${equation}. What is the smaller root?`,
        answer,
        `Factor the quadratic and identify the smaller root.`,
        2,
        70
      )
    ),
    ...discriminantCases.map(([equation, count]) =>
      mcqQuestion(
        "Nature of roots",
        `How many distinct real roots does ${equation} have?`,
        ["0", "1", "2", "Cannot be determined"],
        String(count),
        `Use the discriminant b^2 - 4ac to determine the number of distinct real roots.`,
        2,
        75
      )
    ),
    ...kCases.map(([root, k]) =>
      numericQuestion(
        "Root verification",
        `If x = ${root} is a root of x^2 + kx - 8 = 0, what is k?`,
        k,
        `Substitute x = ${root} into the equation and solve for k.`,
        3,
        85
      )
    )
  ];
}

function buildAPQuestions() {
  const cdCases = [
    [[7, 11], 4], [[3, 8], 5], [[12, 9], -3], [[5, 15], 10], [[-2, 4], 6],
    [[20, 13], -7], [[1, 1], 0], [[9, 16], 7], [[14, 10], -4], [[25, 30], 5]
  ];
  const nthCases = [
    [3, 4, 10, 39], [5, 6, 8, 47], [12, -2, 7, 0], [1, 5, 9, 41], [9, 3, 12, 42],
    [20, -1, 15, 6], [7, 7, 5, 35], [2, 9, 6, 47], [15, -3, 10, -12], [4, 8, 11, 84]
  ];
  const sumCases = [
    [2, 3, 5, 40], [4, 5, 6, 99], [10, -1, 4, 34], [7, 7, 3, 42], [1, 2, 10, 100],
    [12, 4, 5, 100], [20, -2, 6, 90], [8, 6, 7, 182], [3, 9, 4, 66], [11, 5, 8, 228]
  ];

  return [
    ...cdCases.map(([[first, second], answer]) =>
      numericQuestion(
        "Common difference",
        `What is the common difference of the AP ${first}, ${second}, ... ?`,
        answer,
        `Subtract the first term from the second term.`,
        1,
        40
      )
    ),
    ...nthCases.map(([a, d, n, answer]) =>
      numericQuestion(
        "Nth term of AP",
        `Find the ${n}th term of the AP with first term ${a} and common difference ${d}.`,
        answer,
        `Use an = a + (n - 1)d.`,
        2,
        60
      )
    ),
    ...sumCases.map(([a, d, n, answer]) =>
      mcqQuestion(
        "Sum of AP",
        `What is the sum of the first ${n} terms of the AP with first term ${a} and common difference ${d}?`,
        [String(answer), String(answer + n), String(answer - d), String(answer + d * 2)],
        String(answer),
        `Use Sn = n/2 [2a + (n - 1)d].`,
        2,
        75
      )
    )
  ];
}

export const algebraChapters = [
  createChapter({
    chapterNumber: 1,
    code: "G10-REAL-NUMBERS",
    name: "Real Numbers",
    description: "Euclid division lemma, HCF and LCM, irrational numbers, and decimal expansion.",
    skillId: "real_numbers_basic",
    skillName: "Real Numbers Basics",
    standard: "MATH-REAL-NUMBERS",
    lessonSummary: "Connect prime factorization, Euclid's lemma, and decimal expansion tests.",
    practiceFocus: "HCF, LCM, irrationality, and decimal expansion",
    checkpointGoal: "Classify and manipulate real-number forms accurately.",
    questions: buildRealNumbersQuestions()
  }),
  createChapter({
    chapterNumber: 2,
    code: "G10-POLYNOMIALS",
    name: "Polynomials",
    description: "Zeros of polynomials and relation between zeros and coefficients.",
    skillId: "polynomials_basic",
    skillName: "Polynomials Basics",
    standard: "MATH-POLYNOMIALS",
    lessonSummary: "Relate roots, factor form, and coefficient patterns.",
    practiceFocus: "Sum of zeros, product of zeros, and polynomial formation",
    checkpointGoal: "Move between equations, zeros, and coefficients confidently.",
    questions: buildPolynomialsQuestions()
  }),
  createChapter({
    chapterNumber: 3,
    code: "G10-LINEAR-PAIRS",
    name: "Pair of Linear Equations in Two Variables",
    description: "Graphical and algebraic solutions of a pair of linear equations.",
    skillId: "linear_pairs_basic",
    skillName: "Pair of Linear Equations Basics",
    standard: "MATH-LINEAR-PAIRS",
    lessonSummary: "Use elimination, substitution, and consistency checks.",
    practiceFocus: "Solving systems, consistency, and word problems",
    checkpointGoal: "Solve and classify a pair of equations correctly.",
    questions: buildLinearPairsQuestions()
  }),
  createChapter({
    chapterNumber: 4,
    code: "G10-QUADRATICS",
    name: "Quadratic Equations",
    description: "Solving quadratic equations by factorization and formula methods.",
    skillId: "quadratics_basic",
    skillName: "Quadratic Equations Basics",
    standard: "MATH-QUADRATICS",
    lessonSummary: "Choose the right method and interpret roots accurately.",
    practiceFocus: "Factorization, nature of roots, and root checks",
    checkpointGoal: "Solve quadratics correctly and reason about their roots.",
    questions: buildQuadraticQuestions()
  }),
  createChapter({
    chapterNumber: 5,
    code: "G10-AP",
    name: "Arithmetic Progressions",
    description: "Nth term and sum of arithmetic progressions.",
    skillId: "ap_basic",
    skillName: "Arithmetic Progressions Basics",
    standard: "MATH-AP",
    lessonSummary: "Use difference, nth-term, and sum formulas fluently.",
    practiceFocus: "Common difference, nth term, and finite sums",
    checkpointGoal: "Recognize and solve arithmetic progression patterns accurately.",
    questions: buildAPQuestions()
  })
];
