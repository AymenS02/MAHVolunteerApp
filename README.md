# MAH Volunteer App

A mobile app for a mosque youth program to manage volunteer events and track volunteer hours. Volunteers sign up for events, admins approve attendance, and approved hours are added to each volunteer's total, which high school students can use for school requirements.

## Features

**Volunteers**
- Create an account and log in (brother or sister, with an optional high school student flag)
- Browse upcoming and past events
- See event details: date, location, hours, and spots left for their group
- Register for an event, or cancel (cancellation locks 10 hours before the event)
- See the contact person for events they're registered for
- View their profile and total volunteer hours
- Log out or permanently delete their account

**Admins**
- Create events with separate brother and sister capacity and a contact for each group
- See everyone registered for an event
- Approve volunteers, which confirms their hours

## Tech stack

| Area | Tools |
|---|---|
| Mobile app | Expo (React Native), Expo Router, TypeScript |
| Styling | NativeWind (Tailwind classes) |
| Networking | Axios |
| Backend | Node.js, Express |
| Database | MongoDB with Mongoose |
| Auth | JWT, bcryptjs |
| Validation | Zod |

## Project structure

```
MAHVolunteerApp/
├── src/
│   ├── app/              # Expo Router screens
│   │   ├── (tabs)/       # Events, Profile, Admin tabs
│   │   ├── admin/        # Create event, event volunteers
│   │   ├── events/       # Event details
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── components/       # Shared UI (Button, EventCard, StatCard, ...)
│   ├── constants/        # API client
│   ├── context/          # AuthContext
│   └── types/
├── server/               # Express API
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── validators/
│   └── server.js
├── global.css
├── app.json
└── package.json
```

## Requirements

- Node.js 20 or newer
- npm
- A MongoDB database (a free [MongoDB Atlas](https://www.mongodb.com/atlas) cluster works)
- The **Expo Go** app on your phone, or an iOS Simulator (macOS with Xcode only) or Android emulator

## Setup

### 1. Install dependencies

Run these from the project root:

```bash
npm install
cd server
npm install
cd ..
```

### 2. Configure the backend

Create `server/.env`:

```env
MONGO_URI=your-mongodb-connection-string
JWT_SECRET=a-long-random-string
PORT=5000
EXPO_PUBLIC_API_URL=http://192.000.0.00:5000/api (input your ipV4)
REGISTER_RATE_LIMIT=20
EVENT_TIMEZONE=America/Toronto
```

Never commit this file. Make sure `server/.env` is in your `.gitignore`.

### 3. Configure the app

Create `.env` in the project root (next to `package.json`):

```env
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_IP:5000/api
```

The URL must end in `/api`, and it can't be `localhost` when you test on a phone or emulator, because `localhost` there means the device itself.

| Running on | Use |
|---|---|
| Physical phone (Expo Go) | Your computer's LAN IP, for example `http://192.168.1.42:5000/api` |
| Android emulator | `http://10.0.2.2:5000/api` |
| iOS Simulator or web | `http://localhost:5000/api` |

Find your LAN IP on Windows with `ipconfig` (the IPv4 address of your Wi-Fi adapter) and on macOS with `ipconfig getifaddr en0`. Your phone and computer must be on the same Wi-Fi network.

### 4. Start the backend

```bash
cd server
node server.js
```

You should see `Server running on port 5000` and `MongoDB Connected`. If your `server/package.json` defines a start script, `npm start` works too.

To check that the phone can reach it, open `http://YOUR_COMPUTER_IP:5000` in your phone's browser. Any response, even "Cannot GET /", means the connection works. If it times out, allow Node.js through Windows Firewall on private networks.

### 5. Start the app

In a second terminal, from the **project root** (not `server/`):

```bash
npx expo start
```

Then:
- Scan the QR code with your phone's camera (iOS) or the Expo Go app (Android)
- Press `a` for an Android emulator, or `i` for the iOS Simulator (macOS only)
- Press `w` for the web version

After changing a `.env` value, restart with a cleared cache:

```bash
npx expo start -c
```

## Making an admin

New accounts are volunteers. To make someone an admin, change their `role` to `admin` in the database (for example in MongoDB Atlas under the `users` collection), or use the admin script in `server/` if your project has one. Then log out and back in.

## API overview

All routes are under `/api`. Routes marked with a lock need a `Authorization: Bearer <token>` header.

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Log in |
| GET | `/auth/me` 🔒 | Current user |
| DELETE | `/users/me` 🔒 | Delete own account |
| GET | `/events` 🔒 | List events |
| GET | `/events/:id` 🔒 | Event details |
| POST | `/events` 🔒 admin | Create an event |
| POST | `/events/:id/register` 🔒 | Register for an event |
| DELETE | `/events/:id/register` 🔒 | Cancel registration |
| GET | `/events/:id/volunteers` 🔒 admin | List an event's volunteers |
| PATCH | `/events/:id/volunteers/:userId/approve` 🔒 admin | Approve a volunteer |

## Troubleshooting

| Problem | Likely cause and fix |
|---|---|
| `Network Error` when registering or logging in | The app can't reach the server. Check `EXPO_PUBLIC_API_URL` (no `localhost` on a phone), that the server is running, that both devices share a Wi-Fi network, and the firewall |
| `Cannot POST /auth/register` | The URL is missing the `/api` prefix |
| `Cannot resolve entry file` | You ran `npx expo start` in the wrong folder. Run it from the project root |
| An env variable shows `undefined` | The file must be named exactly `.env`, variables must start with `EXPO_PUBLIC_`, and Metro must be restarted with `npx expo start -c` |
| iOS Simulator won't open | The simulator needs macOS and Xcode. On Windows, use Expo Go on a real iPhone or an Android emulator |
| Server crashes with `next is not a function` | Mongoose hooks written with `next` in async functions don't work on newer versions. Remove the `next` parameter and calls |
| Weird file errors in `node_modules` | Avoid keeping the project inside OneDrive. Move it to something like `C:\dev\` |

## Security notes

- Keep `server/.env` out of version control. If a secret was ever committed, rotate it.
- Set a strong `JWT_SECRET`. Anyone with it can create valid login tokens.
- Event and volunteer data is restricted by role on the server, not just in the app.

## Scripts

| Command | What it does |
|---|---|
| `npx expo start` | Start the app dev server |
| `npx expo start -c` | Start with a cleared cache |
| `npm run lint` | Lint the app |
| `node server.js` (in `server/`) | Start the API |
