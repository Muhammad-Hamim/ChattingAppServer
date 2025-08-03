/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import cors from "cors";
import express, { Application, Request, Response } from "express";
import notFound from "./app/middlewares/notFound";
import router from "./app/routes";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import { createServer } from "http";
import { Server } from "socket.io";

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

export const io = new Server(server, {
  cors: {
    origin: "*", // For development - restrict in production
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  },
});

//Not Found
app.use(notFound);

app.use(globalErrorHandler);

export default app;
