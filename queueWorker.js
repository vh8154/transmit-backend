const db = require("./db");
const { getTransport } = require("./transportRegistry");

const POLL_IDLE_MS = 1000;
const PRE_SEND_DELAY_MS = 1000;
const MESSAGE_GAP_MS = 3000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNextPendingJob() {
  return new Promise((resolve, reject) => {
    db.get(
      `SELECT id, transport, destination, recipient_email, message, transport_meta
       FROM submissions
       WHERE status = 'pending'
       ORDER BY created_at ASC
       LIMIT 1`,
      [],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });
}

function claimJob(id) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE submissions
       SET status = 'processing'
       WHERE id = ? AND status = 'pending'`,
      [id],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes > 0);
      }
    );
  });
}

function markDone(id) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE submissions
       SET status = 'done',
           processed_at = CURRENT_TIMESTAMP,
           error = NULL
       WHERE id = ?`,
      [id],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

function markFailed(id, errorMsg) {
  return new Promise((resolve, reject) => {
    db.run(
      `UPDATE submissions
       SET status = 'failed',
           error = ?
       WHERE id = ?`,
      [errorMsg, id],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });
}

async function processQueueOnce() {
  const row = await getNextPendingJob();
  if (!row) return false;

  const claimed = await claimJob(row.id);
  if (!claimed) return true;

  try {
    const transport = getTransport(row.transport);
    if (!transport) {
      throw new Error(`Unknown transport: ${row.transport}`);
    }

    await sleep(PRE_SEND_DELAY_MS);
    await transport.send(row);
    await sleep(MESSAGE_GAP_MS);

    await markDone(row.id);
    console.log(`Completed submission ${row.id} via ${row.transport}`);
  } catch (err) {
    console.error("Transport send error:", err);
    await markFailed(row.id, String(err.message || err));
    console.log(`Failed submission ${row.id}`);
  }

  return true;
}

function startWorker() {
  console.log("Queue worker started");

  let stopped = false;

  (async function loop() {
    while (!stopped) {
      try {
        const didWork = await processQueueOnce();
        if (!didWork) {
          await sleep(POLL_IDLE_MS);
        }
      } catch (err) {
        console.error("Worker loop error:", err);
        await sleep(POLL_IDLE_MS);
      }
    }
  })();

  return {
    stop() {
      stopped = true;
    },
  };
}

module.exports = { processQueueOnce, startWorker };

