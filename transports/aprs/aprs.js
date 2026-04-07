const net = require("net");
const { buildAprsMessage, chunkPayload } = require("./packet_aprs");
const { buildAx25UiFrame, buildKissFrame } = require("./kiss_ax25");

const DIREWOLF_HOST = process.env.DIREWOLF_HOST || "127.0.0.1";
const DIREWOLF_PORT = parseInt(process.env.DIREWOLF_PORT || "8001", 10);
const APRS_SOURCE_CALLSIGN = process.env.APRS_SOURCE_CALLSIGN || "KF8EZE-7";
const APRS_TOCALL = process.env.APRS_TOCALL || "APDW18";

function parsePath(meta) {
  if (!meta || !meta.path) return [];
  if (Array.isArray(meta.path)) return meta.path.filter(Boolean);
  return String(meta.path)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function sendKissFrame(frame) {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(
      { host: DIREWOLF_HOST, port: DIREWOLF_PORT },
      () => {
        socket.write(frame, (err) => {
          if (err) {
            socket.destroy();
            reject(err);
            return;
          }
          socket.end();
          resolve();
        });
      }
    );

    socket.on("error", reject);
  });
}

async function send(job) {
  const meta = JSON.parse(job.transport_meta || "{}");
  const path = parsePath(meta);

  // Chunk ONLY the message body
  const messageChunks = chunkPayload(job.message, 45);

  for (let i = 0; i < messageChunks.length; i++) {
    const text = `ID=${job.id}|PART=${i + 1}/${messageChunks.length}|TO=${job.recipient_email}|MSG=${messageChunks[i]}`;

    const aprsInfo = buildAprsMessage({
      destinationCallsign: job.destination,
      text,
      lineNumber: `${job.id}${i + 1}`,
    });

    const ax25 = buildAx25UiFrame({
      source: APRS_SOURCE_CALLSIGN,
      destination: APRS_TOCALL,
      path,
      info: aprsInfo,
    });

    const kiss = buildKissFrame(ax25);

    console.log(
      `[APRS SEND] ${APRS_SOURCE_CALLSIGN} -> ${job.destination} via ${
        path.length ? path.join(",") : "direct"
      } :: ${aprsInfo}`
    );

    await sendKissFrame(kiss);
  }

  return { ok: true };
}

module.exports = { send };

