import dotenv from "dotenv";
dotenv.config({
  path: "./.env",
  override: true, // 🔥 VERY IMPORTANT
});
import app from "./app.js";

// ✅ Load env


/**
 * PORT config
 */
console.log("ENV CHECK:");
console.log("AWS_REGION:", process.env.AWS_REGION);
console.log("BUCKET:", process.env.AWSS3_BUCKET_NAME);
const PORT = process.env.PORT || 5000;
console.log("AWS KEY:", process.env.AWS_ACCESS_KEY_ID);
console.log("AWS SECRET:", process.env.AWS_SECRET_ACCESS_KEY);
/**
 * Start server
 */
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});