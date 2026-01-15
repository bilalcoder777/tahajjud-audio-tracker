const sqlite3 = require("sqlite3").verbose();

// Create / open database file
const db = new sqlite3.Database("listening_data.db");

// Create tables
db.serialize(() => {

  // LISTENERS TABLE (per audio session)
  db.run(`
    CREATE TABLE IF NOT EXISTS listeners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      audio_id INTEGER,
      seconds INTEGER,
      duration INTEGER,
      percentage INTEGER,
      status TEXT
    )
  `);

  // AUDIOS TABLE (each upload = one session)
  db.run(`
    CREATE TABLE IF NOT EXISTS audios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT,
      created_at TEXT
    )
  `);

}); // ✅ MISSING CLOSING WAS HERE

module.exports = db;
