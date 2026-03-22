import mongoose from "mongoose";
import { config } from "./config.js";

let connectionPromise = null;
let legacyIndexCleanupPromise = null;

async function cleanupLegacyIndexes(connection) {
  if (legacyIndexCleanupPromise) {
    return legacyIndexCleanupPromise;
  }

  legacyIndexCleanupPromise = (async () => {
    const usersCollection = connection.collection("users");
    let indexes = [];

    try {
      indexes = await usersCollection.indexes();
    } catch (error) {
      if (error?.codeName === "NamespaceNotFound" || error?.code === 26) {
        return;
      }
      throw error;
    }

    const hasLegacyUsernameIndex = indexes.some((index) => index.name === "username_1");

    if (hasLegacyUsernameIndex) {
      await usersCollection.dropIndex("username_1");
    }
  })().catch((error) => {
    legacyIndexCleanupPromise = null;
    throw error;
  });

  return legacyIndexCleanupPromise;
}

export async function connectDatabase() {
  if (mongoose.connection.readyState === 1) {
    await cleanupLegacyIndexes(mongoose.connection);
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose
    .connect(config.mongodbUri)
    .then(async () => {
      await cleanupLegacyIndexes(mongoose.connection);
      return mongoose.connection;
    })
    .catch((error) => {
      connectionPromise = null;
      throw error;
    });

  return connectionPromise;
}
