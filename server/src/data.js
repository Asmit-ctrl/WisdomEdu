export const dashboardData = {
  admin: {
    metrics: [
      { label: "Pilot schools", value: "01", change: "One active institutional customer in rollout." },
      { label: "Students live", value: "32", change: "28 completed diagnostics in the first cycle.", tone: "success" },
      { label: "Teacher action rate", value: "78%", change: "Up 17 points from last week.", tone: "accent" },
      { label: "Weak concept lift", value: "+14%", change: "Measured across flagged concepts after intervention." }
    ],
    pulse: [
      {
        title: "Diagnostic adoption is strong",
        detail: "Completion is high enough to trust the first concept-gap map for buyer review."
      },
      {
        title: "Teacher workflow is the product moat",
        detail: "Usage is concentrated around the intervention panel, not generic reporting."
      },
      {
        title: "Expansion case is emerging",
        detail: "Principal can already see improvement in weak concepts instead of raw activity only."
      }
    ],
    coverage: [
      { label: "Diagnostics complete", value: 87 },
      { label: "Interventions assigned", value: 78 },
      { label: "Practice completion", value: 69 }
    ],
    schools: [
      {
        name: "Northfield Public School",
        owner: "Ritu Malhotra",
        stage: "Live pilot",
        diagnostics: "28/32 done",
        nextStep: "Review week-two intervention outcomes"
      }
    ],
    readiness: [
      { task: "Teacher onboarding completed", owner: "Owner: School admin", done: true },
      { task: "Diagnostic for entire class assigned", owner: "Owner: Teacher", done: true },
      { task: "Week-two parent communication drafted", owner: "Owner: Ops", done: false },
      { task: "Scale-up proposal deck prepared", owner: "Owner: Founder", done: false }
    ],
    buyerNotes: [
      "Lead the sales story with concept improvement, not just student login counts.",
      "Principal value comes from seeing which teacher actions produced measurable gains.",
      "Next upsell path is additional classes after two successful intervention cycles."
    ]
  },
  teacher: {
    metrics: [
      { label: "Students at risk", value: "12", change: "4 are high risk and need action today.", tone: "accent" },
      { label: "Assignments active", value: "18", change: "6 new remediation packs were issued this week." },
      { label: "Diagnostic completion", value: "87%", change: "Only 4 students still need to finish.", tone: "success" },
      { label: "Class mastery average", value: "61%", change: "Fractions remains the weakest cluster." }
    ],
    flaggedStudents: [
      {
        studentId: "stu-001",
        name: "Anaya Sharma",
        risk: "High",
        weakConcepts: ["Fractions", "Ratios"],
        nextAction: "Assign fractions recovery path and 1 checkpoint"
      },
      {
        studentId: "stu-002",
        name: "Kabir Das",
        risk: "Medium",
        weakConcepts: ["Linear Equations"],
        nextAction: "Approve guided practice pack with worked examples"
      },
      {
        studentId: "stu-003",
        name: "Meera Singh",
        risk: "High",
        weakConcepts: ["Fractions", "Linear Equations"],
        nextAction: "Follow up on inactivity, then assign low-load restart pack"
      }
    ],
    classConcepts: [
      {
        name: "Fractions",
        band: "Critical",
        summary: "Equivalent fractions and transfer questions are breaking down under pressure.",
        studentsFlagged: 14
      },
      {
        name: "Linear Equations",
        band: "Watchlist",
        summary: "Students lose steps when isolating variables in two-step equations.",
        studentsFlagged: 9
      },
      {
        name: "Ratios",
        band: "Developing",
        summary: "Basic recall is fine but proportional reasoning in word problems still slips.",
        studentsFlagged: 7
      }
    ],
    roster: [
      { name: "Anaya Sharma", attendance: 94, mastery: 43, status: "High support" },
      { name: "Kabir Das", attendance: 96, mastery: 58, status: "Needs intervention" },
      { name: "Meera Singh", attendance: 81, mastery: 39, status: "Inactive risk" },
      { name: "Arjun Patel", attendance: 98, mastery: 75, status: "Stable" }
    ],
    weekPlan: [
      { day: "Mon", focus: "Fractions remediation block", note: "Start with 4 high-risk learners before class practice." },
      { day: "Wed", focus: "Checkpoint review", note: "Look for mastery jump after low-load intervention pack." },
      { day: "Fri", focus: "Parent share-outs", note: "Export quick progress notes for students still below threshold." }
    ],
    assignments: [
      {
        concept: "Fractions",
        title: "Fraction Recovery Pack",
        description: "Mini lesson, equivalent fraction drill, and checkpoint set.",
        questions: 10,
        status: "Assigned to 8 students"
      },
      {
        concept: "Linear Equations",
        title: "Equation Builder Sprint",
        description: "Worked-example sequence with short guided practice.",
        questions: 6,
        status: "Assigned to 5 students"
      },
      {
        concept: "Ratios",
        title: "Ratio in Context",
        description: "Application-focused word problems with hints.",
        questions: 7,
        status: "Assigned to 4 students"
      }
    ],
    bankStatus: [
      "Fractions has 3 lessons, 24 questions, and 2 checkpoints ready.",
      "Linear equations has 2 lessons, 16 questions, and 1 checkpoint ready.",
      "Ratios has 2 lessons, 14 questions, and 1 checkpoint ready."
    ]
  },
  student: {
    metrics: [
      { label: "Today streak", value: "06", change: "You have practiced every day this week.", tone: "success" },
      { label: "Concepts improving", value: "02", change: "Fractions and linear equations are moving up." },
      { label: "Tasks due", value: "03", change: "Finish your next checkpoint to unlock the next stage.", tone: "accent" },
      { label: "Mastery average", value: "57%", change: "You are 13 points away from the next target band." }
    ],
    recommendations: [
      {
        concept: "Fractions",
        lesson: "Rebuild equivalent fractions using visual models before practice.",
        questions: 8,
        duration: "18 min"
      },
      {
        concept: "Ratios",
        lesson: "Use ratio tables to solve real-world word problems.",
        questions: 6,
        duration: "14 min"
      },
      {
        concept: "Linear Equations",
        lesson: "Short checkpoint after guided balancing examples.",
        questions: 5,
        duration: "11 min"
      }
    ],
    coachNote:
      "You are not behind everywhere. Your path is focused on just the concepts where your answers show confusion, so every set you finish has a clear reason.",
    practiceQueue: [
      {
        concept: "Fractions",
        title: "Equivalent Fractions Studio",
        description: "Visual warm-up followed by scaffolded question blocks.",
        questions: 8,
        difficulty: "Starter"
      },
      {
        concept: "Ratios",
        title: "Ratio Table Quest",
        description: "Short scenario-based practice with hints and retries.",
        questions: 6,
        difficulty: "Core"
      },
      {
        concept: "Linear Equations",
        title: "Checkpoint: Balance Both Sides",
        description: "Mastery gate before moving into harder equations.",
        questions: 5,
        difficulty: "Checkpoint"
      }
    ],
    checkpoints: [
      { when: "Today", title: "Fractions checkpoint", goal: "Reach 65% mastery to unlock the next pack." },
      { when: "Tomorrow", title: "Ratio application quiz", goal: "Show correct setup on 4 out of 6 items." }
    ],
    mastery: [
      { concept: "Fractions", mastery: 42 },
      { concept: "Ratios", mastery: 58 },
      { concept: "Linear Equations", mastery: 71 }
    ],
    recentResults: [
      { title: "Equivalent fractions drill", score: "6/8 correct" },
      { title: "Ratio table challenge", score: "4/6 correct" },
      { title: "Equation checkpoint", score: "71% mastery" }
    ]
  }
};
