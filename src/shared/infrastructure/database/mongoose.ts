import mongoose from "mongoose";

import { env } from "../../../config/env";

export async function connectDatabase(): Promise<void> {
  try {
    await mongoose.connect(
      env.MONGODB_URI
    );

    console.log(
      `MongoDB connected: ${mongoose.connection.host}`
    );
  } catch (error) {
    console.error(
      "MongoDB connection failed:",
      error
    );

    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
}
