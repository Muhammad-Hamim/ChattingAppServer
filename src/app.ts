import cors from "cors";
import express, { Application } from "express";
import notFound from "./app/middlewares/notFound";
import router from "./app/routes";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import { createServer } from "http";

const app: Application = express();

//parsers
app.use(express.json());
app.use(
  cors({
    origin: "*",
    credentials: true,
  })
);

// application routes
app.use("/api/v1", router);

export const server = createServer(app);

//Not Found
app.use(notFound);

app.use(globalErrorHandler);

export default app;
