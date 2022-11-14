import { URL } from "node:url";
import { createServer } from "node:http";
import fs from "node:fs";
import { createWorker } from "tesseract.js";
import express from "express";
import logger from "morgan";
import multer from "multer";
import cors from "cors";
import { Headers } from "node-fetch";
import axios from "axios";

const app = express();

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const worker = createWorker({
  logger: (m) => console.log(m),
});

app.set("trust proxy", true);
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
const dashboardUrl =
  "https://rononbd.up.railway.app" || "http://localhost:8000";
const publicUrl = process.env.PUBLIC_URL || `http://localhost:${port}`;

const options = {
  key: fs.readFileSync("key.pem"),
  cert: fs.readFileSync("cert.pem"),
  rejectUnauthorized: false,
};

const server = createServer({}, app).listen(port);

server.on("error", (error) => {
  console.log(error.message);
});
server.on("listening", async () => {
  console.log("listening at >_ %s", publicUrl);
  await worker.load();
  await worker.loadLanguage("eng");
  await worker.initialize("eng");
  await worker.loadLanguage("ben");
  await worker.initialize("ben");
});
server.on("close", async () => {
  await worker.terminate();
});

process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});

const authorizeUrl = new URL("/api/authorize/", dashboardUrl);
console.log("authorizeUrl:", authorizeUrl.toString());

async function isAuthorized(req, res, next) {
  try {
    const headers = new Headers(req.headers);
    headers.set("Content-Type", "application/json");
    headers.set("host", "img-to-txt-production.up.railway.app");

    await axios.get(authorizeUrl.toString(), {
      headers: {
        Authorization: req.headers.authorization,
      },
    });
    console.log("completed fetch");
    return next();
  } catch (error) {
    res.send(error.response.data).end();
  }
}

async function recognizeImage(req, res) {
  const {
    data: { text },
  } = await worker.recognize(req.file.buffer);

  res.json({ text }).end();
}
