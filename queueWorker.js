const db = require("./db");
const { getTransport } = require("./transportRegistry");

const PROCESSING_TIME_MS = 1000;

function processQueue() {
  db.get(
    `SELECT id, transport, destination, recipient_email, message, transport_meta
     FROM submissions
     WHERE status = 'pending'
     ORDER BY created_at ASC
     LIMIT 1`,
    [],
    (err, row) => {
      if (err) {
        console.error("Queue read error:", err);
        return;
      }

      if (!row) return;

      db.run(
        `UPDATE submissions
         SET status = 'processing'
         WHERE id = ? AND status = 'pending'`,
        [row.id],
        async function (updateErr) {
          if (updateErr) {
            console.error("Queue claim error:", updateErr);
            return;
          }

          if (this.changes === 0) return;

          try {
            const transport = getTransport(row.transport);
            if (!transport) {
              throw new Error(`Unknown transport: ${row.transport}`);
            }

            await new Promise((resolve) => setTimeout(resolve, PROCESSING_TIME_MS));
            await transport.send(row);

            db.run(
              `UPDATE submissions
               SET status = 'done',
                   processed_at = CURRENT_TIMESTAMP,
                   error = NULL
               WHERE id = ?`,
              [row.id],
              (doneErr) => {
                if (doneErr) {
                  console.error("Queue complete error:", doneErr);
                } else {
                  console.log(`Completed submission ${row.id} via ${row.transport}`);
                }
              }
            );
          } catch (sendErr) {
            console.error("Transport send error:", sendErr);

            db.run(
              `UPDATE submissions
               SET status = 'failed',
                   error = ?
               WHERE id = ?`,
              [String(sendErr.message || sendErr), row.id],
              (failErr) => {
                if (failErr) {
                  console.error("Queue fail error:", failErr);
                } else {
                  console.log(`Failed submission ${row.id}`);
                }
              }
            );
          }
        }
      );
    }
  );
}

function startWorker(intervalMs = 1000) {
  console.log(`Queue worker polling every ${intervalMs} ms`);
  return setInterval(processQueue, intervalMs);
}

module.exports = { processQueue, startWorker };


