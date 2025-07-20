import { convertTimeToTwelveHourFormat, isTimeBetween } from "./helpers.js";

async function slotParser(slots) {
  const numberOfSlots = slots.length;
  console.log(`There are ${numberOfSlots} slots available: `);
  let slotId = null;
  for (const slot of shuffle(slots)) {
    let time = convertTimeToTwelveHourFormat(slot.date.start);
    const reservationType = slot.config.type;
    let isPrime = await slotChooser(slot, time, reservationType);
    if (isPrime) {
      slotId = isPrime;
      break;
    }
  }
  let slotTimes = [];
  for (const slot of slots) {
    let time = convertTimeToTwelveHourFormat(slot.date.start);
    slotTimes.push(time);
  }
  console.log(slotTimes.join(", "));
  return slotId;
}

// Fisher-Yates shuffle
function shuffle(array) {
  const result = array.slice(); // make a copy
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

async function slotChooser(slot, time, type) {
  if (
    isTimeBetween(process.env.EARLIEST, process.env.LATEST, slot.date.start)
  ) {
    return slot.config.token;
  }
}

export { slotParser };
