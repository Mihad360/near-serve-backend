import express, { Application, Request, Response } from "express";
import cors from "cors";
import globalErrorHandler from "./app/middlewares/globalErrorHandler";
import notFound from "./app/middlewares/notFound";
import router from "./app/routes";
import cookieParser from "cookie-parser";
import path from "path";
import { template } from "./rootTemplate";
import { privacyControllers } from "./app/modules/Settings/privacy/Privacy.controller";
import { logHttpRequests } from "./logger/logger";
const app: Application = express();

app.use(logHttpRequests);
app.use(express.json());
app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
// cookie parser
app.use(cookieParser());
app.use(
  "/images",
  express.static(path.join(process.cwd(), "public", "images")),
);
app.use("/audio", express.static(path.join(process.cwd(), "public", "audio")));
app.use("/docs", express.static(path.join(process.cwd(), "public", "docs")));

app.use("/api/v1", router);
app.use("/privacy-policy", privacyControllers.htmlRoute);
app.use("/app-instruction", privacyControllers.appInstruction);

app.get("/", (req: Request, res: Response) => {
  res.status(200).send(template);
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
