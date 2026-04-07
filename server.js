require('dotenv').config();
const express = require("express");
const db = require("./db");
const validator = require("validator");

const app = express();
const PORT = 3001;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function queuedPage() {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Queued</title>
    <style>
      body {
        font-family: sans-serif;
        text-align: center;
        padding: 2rem;
      }
      .ok {
        color: #2e7d32;
        font-size: 1.5rem;
      }
    </style>
  </head>
  <body>
    <div class="ok">Message queued successfully</div>
    <p>Your message has been added to the queue.</p>
    <a href="/">Back</a>
  </body>
  </html>
  `;
}

app.get("/", (req, res) => {
  res.send("portal-backend alive");
});

app.post("/submit", (req, res) => {
  const { email, message } = req.body;

  if (!email || !message) {
    return res.status(400).send("Missing fields");
  }

  if (!validator.isEmail(email)) {
    return res.status(400).send("Invalid email");
  }

  const job = {
    transport: "aprs",
    destination: process.env.APRS_DESTINATION || "KF8EZE-10",
    recipient_email: email,
    message,
    transport_meta: JSON.stringify({
      path: "",
      frequency_mhz: "144.390",
    }),
  };

  db.run(
    `INSERT INTO submissions
     (transport, destination, recipient_email, message, status, transport_meta)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
    [
      job.transport,
      job.destination,
      job.recipient_email,
      job.message,
      job.transport_meta,
    ],
    function (err) {
      if (err) {
        console.error("Database insert error:", err);
        return res.status(500).send("Database error");
      }

      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Queued</title>
        </head>
        <body>
          <h2>Message queued for APRS transport</h2>
          <p>Your message has been added to the queue.</p>
          <a href="/">Back</a>
        </body>
        </html>
      `);
    }
  );
});

app.get("/api/messages", (req, res) => {
  db.all(
    `SELECT * FROM submissions ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ ok: false, error: "db_error" });
      }
      res.json({ ok: true, rows });
    }
  );
});

app.get("/api/queue", (req, res) => {
  db.all(
    `SELECT
      id,
      transport,
      destination,
      recipient_email,
      message,
      status,
      created_at,
      processed_at,
      error,
      transport_meta
     FROM submissions
     ORDER BY created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error("Queue API error:", err);
        return res.status(500).json({ ok: false, error: "db_error" });
      }
      res.json({ ok: true, rows });
    }
  );
});

app.get("/api/queue-length", (req, res) => {
  db.get(
    `SELECT COUNT(*) AS count
     FROM submissions
     WHERE status = 'pending'`,
    [],
    (err, row) => {
      if (err) {
        console.error("Queue length API error:", err);
        return res.status(500).json({ ok: false, error: "db_error" });
      }
      res.json({ ok: true, pending: row.count });
    }
  );
});


app.listen(PORT, "0.0.0.0", () => {
  console.log(`Backend running on http://0.0.0.0:${PORT}`);
});
