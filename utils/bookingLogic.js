import axios from "axios";
import FormData from "form-data";
import { slotParser } from "./slotParser.js";
import { convertDateToLongFormat } from "./helpers.js";
import {
  existingReservationConfig,
  slotConfig,
  bookingConfig,
  finalConfig,
} from "../config.js";

// First, we'll see if we already have a reservation
async function checkForExistingBooking() {
  let config = existingReservationConfig(process.env.AUTH_TOKEN);
  let venueId = process.env.VENUE_ID;
  try {
    const response = await axios.request(config);
    if (response.data.reservations[0]?.venue?.id == venueId) {
      console.log(`You already have a reservation for tonight!`);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.log(error);
  }
}

// Then, we'll check to see if there are any reservations available
async function fetchDataAndParseSlots(date) {
  const config = slotConfig(date);
  try {
    const response = await axios.request(config);
    if (response.data.results.venues.length === 0) {
      console.log(
        "No slots available. Please run again after reservations open."
      );
      return false;
    }
    console.log(
      `Checking for reservations at ${
        response.data.results.venues[0].venue.name
      } on ${convertDateToLongFormat(date)} for ${
        process.env.PARTY_SIZE
      } people...`
    );
    let slots = response.data.results.venues[0].slots;
    const slotId = await slotParser(slots);
    return slotId;
  } catch (error) {
    console.log(error);
  }
}

// If there are reservations available, we'll grab the booking token
async function getBookingConfig(date, slotId) {
  const config = bookingConfig(date, slotId);
  try {
    const response = await axios.request(config);
    return response.data.book_token.value;
  } catch (error) {
    console.log(error);
  }
}

// Finally, we'll make the reservation
async function makeBooking(book_token) {
  let config = finalConfig(process.env.AUTH_TOKEN);
  const formData = new FormData();
  formData.append(
    "struct_payment_method",
    JSON.stringify({ id: process.env.PAYMENT_ID })
  );
  formData.append("book_token", book_token);
  formData.append("source_id", "resy.com-venue-details");

  try {
    const response = await axios.post(config.url, formData, {
      headers: {
        ...config.headers,
        ...formData.getHeaders(),
      },
    });
    return response.data;
  } catch (error) {
    console.log(error.response.data);
  }
}

async function makeReservation() {
  let killed = false;
  const drop_time = new Date();
  const [dropHour, dropMinute] = process.env.DROP_TIME.split(":").map(Number);
  drop_time.setHours(dropHour, dropMinute, 55, 0);

  process.on("message", (msg) => {
    if (msg === "terminate") {
      console.log(`Worker ${process.pid} terminating...`);
      killed = true;
    }
  });

  let date = process.env.DATE;
  while (!killed) {
    log(`Worker ${process.pid} attempting...`);
    let existingBooking = await checkForExistingBooking();
    if (existingBooking) {
      process.send("reservation_found");
      killed = true;
    }
    let slots = await fetchDataAndParseSlots(date);
    if (slots) {
      let bookToken = await getBookingConfig(date, slots);
      let booking = await makeBooking(bookToken);
      if (booking?.resy_token) {
        process.send("reservation_found");
        log(`Worker ${process.pid} found the reservation!`);
      } else {
        log(`Worker ${process.pid} Something went to 💩`);
      }
    } else {
      var delay = 0;
      // Delay based on DROP_TIME
      const now = new Date();
      if (now > drop_time + 8000) {
        process.send("reservation_found");
        log(`No reservation found`);
      } else if (now < drop_time - 10000) {
        delay = 10000;
      } else if (now < drop_time) {
        delay = 5000;
      } else {
        delay = 200;
      }
      log(`Sleeping for ${delay}ms...`);
      await new Promise((res) => setTimeout(res, delay));
    }
  }
}

function log(message) {
  const time = new Date().toLocaleTimeString("en-US", {
    hour12: false, // use 24-hour format
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  console.log(`[${time}] ${message}`);
}

export {
  checkForExistingBooking,
  fetchDataAndParseSlots,
  getBookingConfig,
  makeBooking,
  makeReservation,
};
