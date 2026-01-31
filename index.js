import fs from "fs";
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

const venues = [
  // {
  //   "NAME": "Beekman -- Test",
  //   "VENUE_ID": "40703",
  //   "EARLIEST": "19:00",
  //   "LATEST": "23:30",
  //   "DROP_TIME": "01:54",
  //   "DAYS_OUT": 6
  // },
  // {
  //   "NAME": "Double Chicken Please",
  //   "VENUE_ID": "42534", 
  //   "EARLIEST": "20:00",
  //   "LATEST": "23:30",
  //   "DROP_TIME": "23:59",
  //   "DAYS_OUT": 6
  // },
  //   {
  //   "NAME": "4 Horseman",
  //   "VENUE_ID": "2492",
  //   "EARLIEST": "18:00",
  //   "LATEST": "21:00",
  //   "DROP_TIME": "06:59",
  //   "DAYS_OUT": 29
  // },
  {
    "NAME": "4 Charles",
    "VENUE_ID": "929",
    "EARLIEST": "17:00",
    "LATEST": "21:00",
    "DROP_TIME": "08:59",
    "DAYS_OUT": 20
  },
  // {
  //   "NAME": "Torrisi",
  //   "VENUE_ID": "64593",
  //   "EARLIEST": "17:00",
  //   "LATEST": "21:00",
  //   "DROP_TIME": "09:59",
  //   "DAYS_OUT": 30
  // }
  {
    "NAME": "Misi",
    "VENUE_ID": "3015",
    "EARLIEST": "18:00",
    "LATEST": "20:00",
    "DROP_TIME": "09:59",
    "DAYS_OUT": 27
  }
];
const numCPUs = os.cpus().length;


if (cluster.isPrimary) {
  console.log(`Primary ${process.pid} is running`);

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
  for (const venue of venues) {
    await makeReservation(venue);
  }
}
