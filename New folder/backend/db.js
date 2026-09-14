const path = require('path');
const Database = require('better-sqlite3');

const db = new Database(path.join(__dirname, 'database.sqlite'));

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS submissions (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL,
    company         TEXT,
    email           TEXT NOT NULL,
    phone           TEXT,
    subject         TEXT,
    message         TEXT NOT NULL,
    ip_address      TEXT,
    country         TEXT,
    region          TEXT,
    city            TEXT,
    browser         TEXT,
    browser_version TEXT,
    os              TEXT,
    os_version      TEXT,
    device_type     TEXT,
    user_agent_raw  TEXT,
    referrer        TEXT,
    submitted_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const insertSubmission = db.prepare(`
  INSERT INTO submissions (
    name, company, email, phone, subject, message,
    ip_address, country, region, city,
    browser, browser_version, os, os_version, device_type,
    user_agent_raw, referrer
  ) VALUES (
    @name, @company, @email, @phone, @subject, @message,
    @ip_address, @country, @region, @city,
    @browser, @browser_version, @os, @os_version, @device_type,
    @user_agent_raw, @referrer
  )
`);

function saveSubmission(data) {
  const result = insertSubmission.run(data);
  return result.lastInsertRowid;
}

function listSubmissions({ limit = 50, offset = 0 } = {}) {
  return db
    .prepare('SELECT * FROM submissions ORDER BY id DESC LIMIT ? OFFSET ?')
    .all(limit, offset);
}

module.exports = { db, saveSubmission, listSubmissions };
