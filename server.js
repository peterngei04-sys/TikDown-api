const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execFile } = require("child_process");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const downloadsDir = path.join(__dirname, "downloads");

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

app.use("/downloads", express.static(downloadsDir));

function runYtDlp(args, callback) {
  console.log("");
  console.log("========================================");
  console.log("Starting yt-dlp");
  console.log("Arguments:", args);
  console.log("========================================");

  execFile(
    "yt-dlp",
    args,
    {
      maxBuffer: 50 * 1024 * 1024,
      timeout: 180000,
    },
    (error, stdout, stderr) => {
      console.log("");
      console.log("========== yt-dlp stdout ==========");
      console.log(stdout);

      console.log("");
      console.log("========== yt-dlp stderr ==========");
      console.log(stderr);

      if (error) {
        console.log("");
        console.log("========== yt-dlp error ==========");
        console.log(error.message);
        console.log("===================================");
      }

      callback(error, stdout, stderr);
    }
  );
}

/* ================================
   API STATUS
================================ */

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "TikDown API is running",
  });
});

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "TikDown API test successful",
  });
});

/* ================================
   YT-DLP VERSION
================================ */

app.get("/api/yt-dlp-version", (req, res) => {
  execFile(
    "yt-dlp",
    ["--version"],
    {
      timeout: 30000,
    },
    (error, stdout, stderr) => {
      if (error) {
        return res.status(500).json({
          success: false,
          error: error.message,
          stderr: stderr || "",
        });
      }

      return res.json({
        success: true,
        version: stdout.trim(),
      });
    }
  );
});

/* ================================
   PREVIEW
================================ */

app.post("/api/preview", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "TikTok URL is required",
    });
  }

  const args = [
    url,
    "--simulate",
    "--dump-single-json",
    "--no-warnings",
    "--no-playlist",
    "--no-check-certificates",
  ];

  runYtDlp(args, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        success: false,
        error:
          stderr ||
          stdout ||
          error.message ||
          "Unable to get TikTok information",
      });
    }

    try {
      const data = JSON.parse(stdout);

      return res.json({
        success: true,
        id: data.id || null,
        title: data.title || "TikTok Video",
        uploader: data.uploader || data.uploader_id || "",
        thumbnail: data.thumbnail || null,
        duration:
          typeof data.duration === "number"
            ? data.duration
            : null,
      });
    } catch (parseError) {
      console.log("JSON parse error:", parseError);

      return res.status(500).json({
        success: false,
        error: "Unable to read TikTok information",
      });
    }
  });
});

/* ================================
   DOWNLOAD
================================ */

app.post("/api/download", (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({
      success: false,
      error: "TikTok URL is required",
    });
  }

  const jobId = crypto.randomUUID();

  const outputTemplate = path.join(
    downloadsDir,
    `${jobId}.%(ext)s`
  );

  const args = [
    url,
    "-o",
    outputTemplate,
  ];

  runYtDlp(args, (error, stdout, stderr) => {
    if (error) {
      return res.status(500).json({
        success: false,
        error:
          stderr ||
          stdout ||
          error.message ||
          "Unable to download TikTok video",
      });
    }

    let downloadedFile = null;

    try {
      const files = fs.readdirSync(downloadsDir);

      downloadedFile = files.find((file) =>
        file.startsWith(`${jobId}.`)
      );
    } catch (fileError) {
      console.log("File search error:", fileError);

      return res.status(500).json({
        success: false,
        error: "Unable to find downloaded video",
      });
    }

    if (!downloadedFile) {
      return res.status(500).json({
        success: false,
        error: "Download completed but video file was not found",
      });
    }

    return res.json({
      success: true,
      id: jobId,
      videoUrl: `/downloads/${encodeURIComponent(
        downloadedFile
      )}`,
    });
  });
});

/* ================================
   START SERVER
================================ */

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("========================================");
  console.log(`TikDown API running on port ${PORT}`);
  console.log(`Port: ${PORT}`);
  console.log("========================================");
});
