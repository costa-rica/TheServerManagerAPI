import mongoose from "mongoose";
import logger from "../config/logger";

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI as string;
    if (!uri) throw new Error("Missing MONGODB_URI in environment variables.");

    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 2000,
    });

    logger.info("✅ MongoDB connected successfully");
  } catch (error) {
    logger.error("❌ MongoDB connection error:", error);
    process.exit(1);
  }
};

export default connectDB;
