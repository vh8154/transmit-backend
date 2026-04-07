const aprsTransport = require("./transports/aprs/aprs");

const registry = {
  aprs: aprsTransport,
};

function getTransport(name) {
  return registry[name];
}

module.exports = { getTransport };
