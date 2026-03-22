import dotenv from "dotenv";

dotenv.config();

export const config = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: process.env.PORT || 5000,
  mongodbUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/elder-bro-lms",
  jwtSecret: process.env.JWT_SECRET || "change-me",
  corsOrigin: process.env.CORS_ORIGIN || "",
  activityEventRetentionDays: Number(process.env.ACTIVITY_EVENT_RETENTION_DAYS || 365),
  startupBootstrapEnabled:
    process.env.ENABLE_STARTUP_BOOTSTRAP === "true" ||
    ((process.env.ENABLE_STARTUP_BOOTSTRAP ?? "") !== "false" && (process.env.NODE_ENV || "development") !== "production"),
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  openaiVariantModel: process.env.OPENAI_VARIANT_MODEL || "gpt-5-mini",
  openaiInsightModel: process.env.OPENAI_INSIGHT_MODEL || "gpt-5-mini",
  openaiEmbeddingModel: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small",
  openaiEnableEnhancedGeneration: process.env.OPENAI_ENABLE_ENHANCED_GENERATION === "true"
};
