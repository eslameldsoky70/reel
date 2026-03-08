const express = require("express");
const multer = require("multer");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } });

// Serve static files (icons, manifest, sw)
app.use('/icons', express.static(path.join(__dirname, 'icons')));
app.get('/manifest.json', (req, res) => res.sendFile(path.join(__dirname, 'manifest.json')));
app.get('/sw.js', (req, res) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.join(__dirname, 'sw.js'));
});

// Serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// MP4 conversion endpoint
app.post("/convert", upload.single("video"), async (req, res) => {
  if (!req.file) return res.status(400).send("لا يوجد ملف");

  const tmpDir = os.tmpdir();
  const inputPath  = path.join(tmpDir, `input_${Date.now()}.webm`);
  const outputPath = path.join(tmpDir, `output_${Date.now()}.mp4`);

  try {
    fs.writeFileSync(inputPath, req.file.buffer);

    await new Promise((resolve, reject) => {
      exec(
        `ffmpeg -y -i "${inputPath}" -c:v libx264 -preset fast -crf 22 -c:a aac -b:a 192k -movflags +faststart "${outputPath}"`,
        { timeout: 180000 },
        (err, stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve();
        }
      );
    });

    const mp4Buffer = fs.readFileSync(outputPath);
    res.set("Content-Type", "video/mp4");
    res.set("Content-Disposition", 'attachment; filename="islam-reels.mp4"');
    res.send(mp4Buffer);
  } catch (err) {
    console.error("[convert error]", err.message);
    res.status(500).send("فشل التحويل: " + err.message);
  } finally {
    try { fs.unlinkSync(inputPath); } catch (_) {}
    try { fs.unlinkSync(outputPath); } catch (_) {}
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ إسلام ريلز يعمل على البورت ${PORT}`));
