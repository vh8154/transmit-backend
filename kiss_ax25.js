const FEND = 0xc0;
const FESC = 0xdb;
const TFEND = 0xdc;
const TFESC = 0xdd;

function parseCallsign(input) {
  const upper = input.toUpperCase().trim();
  const [call, ssidPart] = upper.split("-");
  const ssid = ssidPart ? parseInt(ssidPart, 10) : 0;
  return { call, ssid: Number.isNaN(ssid) ? 0 : ssid };
}

function encodeAddress(addr, last) {
  const { call, ssid } = parseCallsign(addr);
  const bytes = Buffer.alloc(7, 0x40);

  for (let i = 0; i < 6; i++) {
    const ch = i < call.length ? call.charCodeAt(i) : 0x20;
    bytes[i] = ch << 1;
  }

  // SSID byte:
  // bits: 7..1 shifted format, set reserved bits, set end-of-address bit if last
  bytes[6] = 0x60 | ((ssid & 0x0f) << 1) | (last ? 0x01 : 0x00);
  return bytes;
}

function buildAx25UiFrame({ source, destination, path = [], info }) {
  const addresses = [];

  const all = [destination, source, ...path];
  for (let i = 0; i < all.length; i++) {
    addresses.push(encodeAddress(all[i], i === all.length - 1));
  }

  const control = Buffer.from([0x03]); // UI frame
  const pid = Buffer.from([0xf0]);     // no layer 3 protocol
  const infoBytes = Buffer.from(info, "ascii");

  return Buffer.concat([...addresses, control, pid, infoBytes]);
}

function kissEscape(buf) {
  const out = [];
  for (const b of buf) {
    if (b === FEND) {
      out.push(FESC, TFEND);
    } else if (b === FESC) {
      out.push(FESC, TFESC);
    } else {
      out.push(b);
    }
  }
  return Buffer.from(out);
}

function buildKissFrame(ax25Frame, port = 0) {
  const command = port & 0x0f; // data frame on KISS port
  const escaped = kissEscape(ax25Frame);
  return Buffer.concat([
    Buffer.from([FEND, command]),
    escaped,
    Buffer.from([FEND]),
  ]);
}

module.exports = {
  buildAx25UiFrame,
  buildKissFrame,
};

