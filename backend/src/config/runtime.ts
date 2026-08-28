import { config } from "dotenv";
import { resolve } from "node:path";

// Load the workspace env file even when the backend command is launched from backend/.
config({ path: resolve(__dirname, "../../../.env") });
config();

export const isFirebaseDataSource = process.env.DATA_SOURCE === "firebase";
