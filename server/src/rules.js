export const RULES = {
  risk: {
    high: 0.4,
    medium: 0.7
  },
  recommendations: {
    maxWeakConcepts: 3
  }
};

export function computeRiskLevel(mastery) {
  if (mastery < RULES.risk.high) return "high";
  if (mastery < RULES.risk.medium) return "medium";
  return "low";
}

export function explainRisk(mastery) {
  const riskLevel = computeRiskLevel(mastery);
  return {
    ruleId: "risk-threshold-v1",
    riskLevel,
    thresholds: RULES.risk,
    input: { mastery }
  };
}

export function explainRecommendation({ mastery, rank }) {
  const riskExplanation = explainRisk(mastery);
  return {
    ruleId: "recommendation-priority-v1",
    decision: "recommend-concept",
    rank,
    input: {
      mastery,
      maxWeakConcepts: RULES.recommendations.maxWeakConcepts
    },
    risk: riskExplanation
  };
}
