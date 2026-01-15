const express = require("express");
const path = require("path");
const db = require("./database");
const session = require("express-session");
const multer = require("multer");

const app = express();
const PORT = process.env.PORT || 3000;

/* =====================
   MIDDLEWARE
===================== */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    secret: "allahu-allah-secret",
    resave: false,
    saveUninitialized: true
  })
);

app.use("/audios", express.static("audios"));
app.use("/public", express.static("public"));

/* =====================
   ADMIN CREDENTIALS
===================== */
const ADMIN_USER = "admin";
const ADMIN_PASS = "1234";

/* =====================
   FILE UPLOAD (AUDIO)
===================== */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "audios");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  }
});

const upload = multer({ storage });

/* =====================
   HELPER: CURRENT AUDIO
===================== */
function getCurrentAudio(callback) {
  db.get(
    "SELECT * FROM audios ORDER BY id DESC LIMIT 1",
    [],
    (err, row) => {
      callback(row);
    }
  );
}

/* =====================
   LISTENER PAGE
===================== */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/submit-name", (req, res) => {
  const { name } = req.body;

  if (!name || name.trim() === "") {
    res.json({ success: false, message: "Name is required." });
  } else {
    res.json({ success: true, message: "You may listen now." });
  }
});

/* =====================
   CURRENT AUDIO (LISTENER)
===================== */
app.get("/current-audio", (req, res) => {
  getCurrentAudio(audio => {
    if (!audio) {
      return res.status(404).send("No audio uploaded yet");
    }
    res.sendFile(path.join(__dirname, "audios", audio.filename));
  });
});

/* =====================
   SAVE LISTENING PROGRESS
===================== */
app.post("/listen-progress", (req, res) => {
  const { name, seconds, duration, percentage, status } = req.body;

  getCurrentAudio(audio => {
    if (!audio) return;

    db.get(
      "SELECT * FROM listeners WHERE name = ? AND audio_id = ?",
      [name, audio.id],
      (err, row) => {
        if (row) {
          db.run(
            `UPDATE listeners
             SET seconds=?, duration=?, percentage=?, status=?
             WHERE id=?`,
            [seconds, duration, percentage, status, row.id]
          );
        } else {
          db.run(
            `INSERT INTO listeners
             (name, audio_id, seconds, duration, percentage, status)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [name, audio.id, seconds, duration, percentage, status]
          );
        }
      }
    );
  });

  res.json({ success: true });
});

/* =====================
   LISTENER: SELF STATUS
===================== */
app.get("/listener/me", (req, res) => {
  const { name } = req.query;
  if (!name) return res.json(null);

  getCurrentAudio(audio => {
    if (!audio) return res.json(null);

    db.get(
      "SELECT seconds, duration, status FROM listeners WHERE name = ? AND audio_id = ?",
      [name, audio.id],
      (err, row) => {
        res.json(row || null);
      }
    );
  });
});

/* =====================
   ADMIN LOGIN
===================== */
app.get("/admin/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-login.html"));
});

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.isAdmin = true;
    res.redirect("/admin/dashboard");
  } else {
    res.send("Invalid login");
  }
});

/* =====================
   ADMIN AUTH CHECK
===================== */
function requireAdmin(req, res, next) {
  if (req.session.isAdmin) next();
  else res.redirect("/admin/login");
}

/* =====================
   ADMIN DASHBOARD
===================== */
app.get("/admin/dashboard", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-dashboard.html"));
});

/* =====================
   ADMIN: TODAY LISTENERS
===================== */
app.get("/admin/today-listeners", requireAdmin, (req, res) => {
  getCurrentAudio(audio => {
    if (!audio) return res.json([]);

    db.all(
      `SELECT name, seconds, duration, status
       FROM listeners
       WHERE audio_id = ?
       ORDER BY seconds DESC`,
      [audio.id],
      (err, rows) => {
        res.json(rows || []);
      }
    );
  });
});

/* =====================
   ADMIN UPLOAD AUDIO
===================== */
app.post(
  "/admin/upload-audio",
  requireAdmin,
  upload.single("audio"),
  (req, res) => {
    const filename = req.file.filename;
    const createdAt = new Date().toISOString();

    db.run(
      "INSERT INTO audios (filename, created_at) VALUES (?, ?)",
      [filename, createdAt],
      () => {
        res.redirect("/admin/dashboard");
      }
    );
  }
);

/* =====================
   HISTORY (ADMIN + LISTENER)
===================== */
app.get("/history/audios", (req, res) => {
  db.all(
    "SELECT id, filename, created_at FROM audios ORDER BY id DESC",
    [],
    (err, rows) => {
      res.json(rows || []);
    }
  );
});

app.get("/history/audio/:audioId", (req, res) => {
  const audioId = req.params.audioId;

  db.get(
    "SELECT filename FROM audios WHERE id = ?",
    [audioId],
    (err, row) => {
      if (!row) return res.status(404).send("Not found");
      res.sendFile(path.join(__dirname, "audios", row.filename));
    }
  );
});

app.get("/admin/history/:audioId", requireAdmin, (req, res) => {
  const audioId = req.params.audioId;

  db.all(
    `SELECT name, seconds, duration, status
     FROM listeners
     WHERE audio_id = ?
     ORDER BY seconds DESC`,
    [audioId],
    (err, rows) => {
      res.json(rows || []);
    }
  );
});

app.get("/admin/history", requireAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin-history.html"));
});

app.get("/history", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "listener-history.html"));
});

/* =====================
   SERVER START
===================== */
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
