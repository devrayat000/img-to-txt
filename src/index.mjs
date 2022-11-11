import { createWorker } from "tesseract.js";
import express from "express";
import logger from "morgan";
import multer from "multer";
import fetch, { Headers } from "node-fetch";

const app = express();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const worker = createWorker({
  logger: (m) => console.log(m),
});

app.use(logger("tiny"));

app.post("/ocr/image", isAuthorized, upload.single("img"), async (req, res) => {
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
});

const port = process.env.PORT || 3001;

app.listen(port);

async function isAuthorized(req, res, next) {
  const headers = new Headers(req.headers);
  headers.set("Content-Type", "application/json");

  console.log("headers", Object.fromEntries(headers.entries()));

  const resp = await fetch("http://localhost:8000/api/authorize/", {
    headers,
  });

  if (resp.ok) {
    return next();
  }

  const data = await resp.json();
  res.send(data).end();
  return;
}
