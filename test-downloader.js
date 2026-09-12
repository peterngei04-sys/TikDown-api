const { execFile } = require("child_process");

const tiktokUrl = process.argv[2];

if (!tiktokUrl) {
  console.log("Usage:");
  console.log('node test-downloader.js "TIKTOK_URL"');
  process.exit(1);
}

console.log("Testing TikTok downloader...");
console.log("URL:", tiktokUrl);

execFile(
  "yt-dlp",
  [
    "--simulate",
    "--dump-single-json",
    "--no-warnings",
    tiktokUrl,
  ],
  { maxBuffer: 10 * 1024 * 1024 },
  (error, stdout, stderr) => {
    if (error) {
      console.error("\n❌ Downloader failed");
      console.error(stderr || error.message);
      process.exit(1);
    }

    try {
      const info = JSON.parse(stdout);

      console.log("\n✅ Downloader works!");
      console.log("--------------------------------");
      console.log("Title:", info.title || "Unknown");
      console.log("Uploader:", info.uploader || "Unknown");
      console.log("Duration:", info.duration || "Unknown");
      console.log("Thumbnail:", info.thumbnail || "None");
      console.log("Video ID:", info.id || "Unknown");
      console.log("--------------------------------");
    } catch (parseError) {
      console.error("❌ Could not read yt-dlp result");
      console.error(stdout);
    }
  }
);
