import {
  checkForExistingBooking,
  getBookingConfig,
  makeBooking,
  fetchDataAndParseSlots,
  makeReservation,
} from "./utils/bookingLogic.js";

import cluster from "cluster";
import os from "os";

import { checkTokenExpiration } from "./utils/helpers.js";

// Run the script
let token = await checkTokenExpiration(process.env.AUTH_TOKEN);
if (!token) {
  process.exit(0);
}

const numCPUs = os.cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  const workers = [];

  // Spawn workers staggered by 1000ms
  for (let i = 0; i < numCPUs; i++) {
    setTimeout(() => {
      const worker = cluster.fork({ WORKER_ID: i });
      workers.push(worker);

      worker.on("message", (msg) => {
        if (msg === "reservation_found") {
          // Tell all workers to stop
          for (const w of workers) {
            if (w.isConnected()) {
              w.send("terminate");
            }
          }
        }
      });
    }, i * 1292); // 1000ms delay between each worker start
  }

  cluster.on("exit", (worker) => {
    console.log(`Worker ${worker.process.pid} exited`);
  });
} else {
  console.log(`Worker ${process.pid} started`);

  await makeReservation();
}
