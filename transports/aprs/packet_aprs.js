function padAddressee(callsign) {
  return callsign.toUpperCase().padEnd(9, " ").slice(0, 9);
}

function buildAprsMessage({ destinationCallsign, text, lineNumber }) {
  const addressee = padAddressee(destinationCallsign);
  const suffix = lineNumber ? `{${lineNumber}` : "";
  return `:${addressee}:${text}${suffix}`;
}

function chunkPayload(payload, maxLen = 60) {
  const chunks = [];
  for (let i = 0; i < payload.length; i += maxLen) {
    chunks.push(payload.slice(i, i + maxLen));
  }
  return chunks;
}

module.exports = { buildAprsMessage, chunkPayload };


