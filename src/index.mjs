import { createWorker } from "tesseract.js";
import express from "express";
import logger from "morgan";
import multer from "multer";
import cors from "cors";
import fetch, { Headers } from "node-fetch";

const app = express();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const worker = createWorker({
  logger: (m) => console.log(m),
});

app.use(logger("tiny"));
app.use(
  cors({
    credentials: true,
    origin: ["localhost", "rononbd.com", "www.rononbd.com"],
    methods: ["POST", "GET"],
  })
);

app.post("/ocr/image", isAuthorized, upload.single("img"), recognizeImage);

app.get("/health", (req, res) => {
  const data = {
    uptime: process.uptime(),
    message: "Ok",
    date: new Date(),
  };

  res.status(200).send(data);
});

const port = process.env.PORT || 3001;
const dashboardUrl = process.env.DASHBOARD_URL || "http://localhost:8000";

app.listen(port);

async function isAuthorized(req, res, next) {
  const headers = new Headers(req.headers);
  headers.set("Content-Type", "application/json");

  const resp = await fetch(`${dashboardUrl}/api/authorize/`, {
    headers,
  });

  if (resp.ok) {
    return next();
  }

  const data = await resp.json();
  res.send(data).end();
  return;
}

async function recognizeImage(req, res) {
  await worker.load();
  await worker.loadLanguage("eng");
  await worker.initialize("eng");
  await worker.loadLanguage("ben");
  await worker.initialize("ben");

  const {
    data: { text },
  } = await worker.recognize(req.file.buffer);

  res.json({ text }).end(async () => {
    await worker.terminate();
  });
}
