import { isModuleSource } from "./data-source";
import { config } from "dotenv";
import { resolve } from "node:path";

// Load the workspace env file even when the backend command is launched from backend/.
config({ path: resolve(__dirname, "../../../.env") });
config();

export const isModuleDataSource = isModuleSource(process.env.DATA_SOURCE);
