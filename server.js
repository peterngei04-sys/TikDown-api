const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { execFile } = require("child_process");

dotenv.config();

const app = express();
const PORT = 5000;

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(cors());
app.use(express.json());

// --------------------------------------------------
// Downloads folder
// --------------------------------------------------

const downloadsDir = path.join(__dirname, "downloads");

if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

app.use("/downloads", express.static(downloadsDir));

// --------------------------------------------------
// Helper: run yt-dlp
// --------------------------------------------------

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

// --------------------------------------------------
// Root
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "TikDown API is running",
  });
});

// --------------------------------------------------
// API test
// --------------------------------------------------

app.get("/api/test", (req, res) => {
  res.json({
    success: true,
    message: "TikDown API test successful",
  });
});

// --------------------------------------------------
// PREVIEW
// --------------------------------------------------

app.post("/api/preview", (req, res) => {
  const { url } = req.body;

  console.log("");
  console.log("========================================");
  console.log("Preview request");
  console.log("URL:", url);
  console.log("========================================");

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
      console.log("Preview failed");

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

      console.log("Preview successful:", data.id);

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
      console.log("Preview JSON parse error:", parseError);

      return res.status(500).json({
        success: false,
        error: "Unable to read TikTok information",
      });
    }
  });
});

// --------------------------------------------------
// DOWNLOAD
// --------------------------------------------------

app.post("/api/download", (req, res) => {
  const { url } = req.body;

  console.log("");
  console.log("========================================");
  console.log("Download request");
  console.log("URL:", url);
  console.log("========================================");

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

  // IMPORTANT:
  // This intentionally matches the minimal
  // yt-dlp command that successfully downloaded
  // the TikTok from Termux.
  const args = [
    url,
    "-o",
    outputTemplate,
  ];

  console.log("Job ID:", jobId);
  console.log("Output template:", outputTemplate);

  runYtDlp(args, (error, stdout, stderr) => {
    if (error) {
      console.log("");
      console.log("Download failed");
      console.log("========================================");

      return res.status(500).json({
        success: false,
        error:
          stderr ||
          stdout ||
          error.message ||
          "Unable to download TikTok video",
      });
    }

    // Find the file created by this download
    let downloadedFile = null;

    try {
      const files = fs.readdirSync(downloadsDir);

      downloadedFile = files.find((file) =>
        file.startsWith(`${jobId}.`)
      );
    } catch (fileError) {
      console.log("Unable to inspect downloads folder");

      return res.status(500).json({
        success: false,
        error: "Unable to find downloaded video",
      });
    }

    if (!downloadedFile) {
      console.log("yt-dlp finished but no output file was found");

      return res.status(500).json({
        success: false,
        error: "Download completed but video file was not found",
      });
    }

    const filePath = path.join(
      downloadsDir,
      downloadedFile
    );

    console.log("");
    console.log("Download successful!");
    console.log("File:", downloadedFile);
    console.log("Path:", filePath);
    console.log("========================================");

    return res.json({
      success: true,
      id: jobId,
      videoUrl: `/downloads/${encodeURIComponent(
        downloadedFile
      )}`,
    });
  });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

app.listen(PORT, "0.0.0.0", () => {
  console.log("");
  console.log("========================================");
  console.log(`TikDown API running on port ${PORT}`);
  console.log("========================================");
});
