require('dotenv').config()
const { startWorker } = require("./queueWorker");

console.log("Starting dedicated queue worker...");
startWorker(1000);
