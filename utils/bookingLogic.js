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
async function checkForExistingBooking(venue_id) {
  let config = existingReservationConfig(process.env.AUTH_TOKEN);
  let venueId = venue_id;
  try {
    const response = await axios.request(config);
    if (response.data.reservations[0]?.venue?.id == venueId) {
      log(`You already have a reservation for tonight!`);
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.log(error);
  }
}

// Then, we'll check to see if there are any reservations available
async function fetchDataAndParseSlots(date, venueConfig) {
  const config = slotConfig(date, venueConfig.VENUE_ID);
  try {
    const response = await axios.request(config);
    if (response.data.results.venues.length === 0) {
      console.log(
        "No slots available. Please run again after reservations open."
      );
      return false;
    }
    console.log(
      `Checking for reservations at ${response.data.results.venues[0].venue.name
      } on ${convertDateToLongFormat(date)} for ${process.env.PARTY_SIZE
      } people...`
    );
    let slots = response.data.results.venues[0].slots;
    const slotId = await slotParser(slots, venueConfig);
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

async function makeReservation(venueConfig) {
  let killed = false;
  const { dropDate, reservationDate } = getNextDropAndReservationDate(venueConfig);
  let drop_time = dropDate.getTime();
  let date = reservationDate.toISOString().slice(0, 10);

  process.on("message", (msg) => {
    if (msg === "reservation_found") {
      log(`terminating...`);
      killed = true;
    }
    return;
  });

  let now = (new Date()).getTime();

  while (!killed) {
    log(`attempting... ${venueConfig.NAME} on ${date}`);
    let existingBooking = await checkForExistingBooking(venueConfig.VENUE_ID);
    if (existingBooking) {
      process.send("reservation_found");
      killed = true;
      return;
    }
    let slots = await fetchDataAndParseSlots(date, venueConfig);
    if (slots) {
      let bookToken = await getBookingConfig(date, slots);
      let booking = await makeBooking(bookToken);
      if (booking?.resy_token) {
        process.send("reservation_found");
        killed = true;
        log(`Worker ${process.pid} found the reservation!`);
        return;
      } else {
        log(`Worker ${process.pid} Something went to 💩`);
      }
    }

    var delay = 0;
    // Delay based on DROP_TIME
    now = new Date();
  if (now.getTime() > dropDate.getTime() + 4000) {
      process.send("reservation_found");
      log(`No reservation found`);
      break;
    } else if (now.getTime() < dropDate.getTime() - 1000) {
      delay = (dropDate.getTime() - now.getTime()) / 2;
    } else {
      delay = 200;
    }
    log(`Sleeping for ${delay}ms...`);
    await new Promise((res) => setTimeout(res, delay));
  }
}

function log(message) {
  const time = new Date().toLocaleTimeString("en-US", {
    hour12: false, // use 24-hour format
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  console.log(`[${time}] Worker ${process.pid} ${message}`);
}

/**
 * Finds the next drop time and reservation date for a venue.
 * @param {Object} venueConfig - The venue configuration object.
 * @param {Date} [now=new Date()] - The current date/time (optional, defaults to now).
 * @returns {{dropDate: Date, reservationDate: Date}}
 */
function getNextDropAndReservationDate(venueConfig, now = new Date()) {
  // Parse drop time from venueConfig (e.g., "23:59")
  const [dropHour, dropMinute] = venueConfig.DROP_TIME.split(":").map(Number);
  let dropDate = new Date(now);
  dropDate.setHours(dropHour, dropMinute, 58, 0);

  // If drop time is before current time, set dropDate to next day
  if (dropDate <= now) {
    dropDate.setDate(dropDate.getDate() + 1);
  }

  // Reservation date is DAYS_OUT from today
  let reservationDate = new Date(dropDate);
  reservationDate.setDate(reservationDate.getDate() + venueConfig.DAYS_OUT);

  return { dropDate, reservationDate };
 }

export {
  checkForExistingBooking,
  fetchDataAndParseSlots,
  getBookingConfig,
  makeBooking,
  makeReservation,
};
