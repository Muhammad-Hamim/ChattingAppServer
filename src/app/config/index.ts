import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env") });

export default {
  NODE_ENV: process.env.NODE_ENV,
  port: process.env.PORT,
  database_url: process.env.DATABASE_URL,
  firebase_project_id: process.env.FIREBASE_PROJECT_ID,
  firebase_client_email: process.env.FIREBASE_CLIENT_EMAIL,
  firebase_private_key: process.env.FIREBASE_PRIVATE_KEY,
};
