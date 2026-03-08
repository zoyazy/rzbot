# Lazy Resy

I'm hungry and like to eat well. What can I say? 🤷‍♂️

This script allows you to make a reservation at a restaurant on Resy. It's ideally run on a cron job, but can be run
manually as well. Imagine picking your day and ideal time, and then letting the script do the rest. It's that easy. No
more wait-lists, no more checking the app every 5 minutes. Just set it and forget it.

https://github.com/robertjdominguez/ez-resy/assets/24390149/68a8b7be-0ac8-454a-94b3-d84a6f1c3bd2

## Motivation

One day, [Highlands Bar & Grill](https://highlandsbarandgrill.com/) will reopen. And when it does, I want to be there. I
want to be there so bad that I wrote this script to make a reservation for me. Goddammit, I want that
[cornbread](https://thelocalpalate.com/recipes/highlands-cornbread/).

## Installation

Clone the repository:

```bash
git clone https://github.com/robertjdominguez/ez-resy.git
```

Install the dependencies:

```bash
npm i
```

## Configuration

### Environment Setup

You'll need a `.env` file that contains the following:

```env
PARTY_SIZE=
PAYMENT_ID=
AUTH_TOKEN=
```

| Variable     | Description                                                            |
| ------------ | ---------------------------------------------------------------------- |
| `PARTY_SIZE` | 🎵 All by myself... 🎵 (it's an `int`)                                 |
| `PAYMENT_ID` | You'll need this from your account. More details below.                |
| `AUTH_TOKEN` | Same as above — just a JWT you can easily find.                        |

#### Payment ID

You'll need to find your payment ID. This is a little tricky, but not too bad. In the Network tab, find the
request that's made after you authenticate. You can search for `user` in the requests and find the one that has your
user information. `payment_method` is in there as an object and has a field of `id`. That's what you want.

#### Auth Token

This is easier to find. You can head to Application > Cookies > https://resy.com and find the `authToken` cookie. This
does expire after a while, so you'll need to update it every so often.

### Venues Configuration

Instead of using a single `.env` file, this script uses a `venues` array in `index.js` to manage multiple restaurant bookings simultaneously. Edit the `venues` constant in `index.js` to add or remove restaurants you want to book.

Each venue object should have the following structure:

```javascript
{
  "NAME": "Restaurant Name",
  "VENUE_ID": "12345",
  "EARLIEST": "17:00",
  "LATEST": "21:00",
  "DROP_TIME": "09:59",
  "DAYS_OUT": 20
}
```

| Property    | Description                                                                    |
| ----------- | ------------------------------------------------------------------------------ |
| `NAME`      | The name of the restaurant (for logging purposes).                             |
| `VENUE_ID`  | Resy's venue ID. Find this by going to the Network tab in your browser's inspector and searching for `venue?filter` after navigating to the restaurant's page. |
| `EARLIEST`  | The earliest time, in 24-hr format, you're willing to eat (e.g., "17:00").    |
| `LATEST`    | The latest time, in 24-hr format, you're willing to eat (e.g., "21:00").      |
| `DROP_TIME` | The time in 24-hr format when the restaurant opens reservations. The script will check at this time and attempt to book. |
| `DAYS_OUT`  | How many days in advance the restaurant opens reservations (e.g., 20 days).    |

#### Example

To add multiple venues, simply add more objects to the `venues` array:

```javascript
const venues = [
  {
    "NAME": "Ha",
    "VENUE_ID": "85855",
    "EARLIEST": "17:00",
    "LATEST": "20:00",
    "DROP_TIME": "11:59",
    "DAYS_OUT": 20
  },
  {
    "NAME": "Double Chicken Please",
    "VENUE_ID": "42534",
    "EARLIEST": "20:00",
    "LATEST": "23:30",
    "DROP_TIME": "23:59",
    "DAYS_OUT": 6
  }
];
```

The script will attempt to book all venues concurrently using Node.js cluster workers, checking each restaurant at its specified `DROP_TIME`.

## Usage

After configuring your `.env` file and setting up your venues in `index.js`, you can run the script with:

```bash
npm run start
```

The script will:
1. Verify that your `AUTH_TOKEN` is still valid
2. Spawn worker processes for each CPU core on your machine
3. Check each venue at its configured `DROP_TIME` for available reservations
4. Automatically book a table at the first available time within your specified `EARLIEST` and `LATEST` times
5. Terminate all other workers once a reservation is successfully made

### Running Multiple Venues

The script uses Node.js cluster workers to check multiple venues concurrently. Workers are spawned with a 1292ms delay between each spawn to avoid overloading the API. Once a reservation is found at any venue, all workers will be terminated.

### Scheduling with Cron

To automatically run this script at specific times, you can set up a cron job:

```bash
# Run every day at 9:00 AM
0 9 * * * cd /path/to/ez-resy && npm run start
```
