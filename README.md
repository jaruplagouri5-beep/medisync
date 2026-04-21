# MediSync — Smart Healthcare Management System

> **One Scan. One Identity. Total Care.**

MediSync is an AI-powered, full-stack medical access system that connects patients, doctors, paramedics, and hospitals through a single unified digital identity. The platform is designed to simplify patient record management, improve doctor–patient interaction, and enable lightning-fast access to critical medical data during emergencies.

It supports QR-based emergency access, consent-gated doctor sessions, real-time hospital triage alerts, and AI-assisted health record management.

---

## Key Features

###  Patient
- **Personal Dashboard** — View medical records, track conditions, and manage appointment reminders
- **QR Code Identity** — Generate and download a unique vCard-style QR code
- **Profile Management** — View and edit personal and medical details
- **SOS Emergency Alert** — Trigger alerts capturing GPS location and sending SMS notifications
- **AI Health Chatbot** — Context-aware medical assistance powered by Google Gemini

###  Doctor
- **Professional Dashboard** — Patient overview, appointments, and statistics
- **QR Scanner Integration** — Scan patient QR codes via live camera or simulation
- **Secure Access System** — OTP-based consent flow for secure data access
- **Timed Sessions** — 15-minute read-only access to patient records, automatically expiring
- **Patient History** — Access logs and "My Patients" list

###  Paramedic
- **Emergency QR Scanning** — Quick scanning via camera or simulated input
- **Rapid Triage** — Emergency triage form and SOS alert triggering system
- **Critical Data Access** — Immediate display of life-saving medical details

###  Hospital
- **ER Dashboard** — Real-time monitoring of incoming emergency cases
- **Triage Board** — Categorization of incoming alerts (Critical / Urgent / Standard)

---

## QR Code Workflow (End-to-End)

### Step 1 — QR Code Generation (Patient)
- Patient logs into their dashboard and navigates to the QR tab
- The system generates a vCard-style text payload encoding: name, blood group, allergies, conditions, emergency contact, and doctor's notes

### Step 2 — QR Code Scanning (Medical Staff)
- A Doctor or Paramedic scans the patient's QR code
- Opens the `frontend/scanner.html` portal
- User is presented with two access routes

### Step 3 — Conditional Access Routing

**Route A — Normal Checkup (Doctor)**
```
Doctor enters name
    → Backend sends OTP via SMS to patient's phone (Twilio)
    → Patient shares OTP with doctor
    → Doctor enters OTP
    → 15-minute read-only session unlocked
    → Full history fetched from MongoDB (localStorage fallback if offline)
```

**Route B — Emergency Mode (Paramedic / ER)**
```
System captures scanner's GPS location via browser
    → Twilio dispatches SOS SMS to patient's guardian
    → SOS screen displays critical life-saving info instantly
    → Direct emergency call buttons shown
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Backend | Node.js, Express.js |
| Database | MongoDB (Mongoose) |
| AI / OCR | Google Gemini 2.5 Flash (`@google/genai`) |
| File Storage | IPFS via Pinata API |
| SMS / OTP | Twilio |
| Real-time | Socket.io (WebSocket) |
| Authentication | JWT + OTP consent tokens |
| QR Codes | qrcode.js (client-side) |

---

## Key Design Decisions

- **No build step** — The frontend runs as plain HTML/JS files for maximum simplicity
- **Offline fallback** — Core features (login, QR generation, local records) use `localStorage` and work even if the backend is offline
- **AI key rotation** — Up to 4 Gemini API keys are cycled automatically when a rate limit (429) is hit, ensuring high availability
- **Time-gated consent** — Doctor access tokens expire automatically after 15 minutes, with all access events logged in an audit trail
- **Decentralised storage** — Medical documents are uploaded to IPFS; only the CID hash and gateway URL are stored in MongoDB, ensuring files are tamper-proof

---

## Project Structure

```
medisync/
├── index.html                  # Main app entry point
├── package.json
├── frontend/
│   ├── scanner.html            # QR scanner portal
│   ├── doctor-view.html        # Doctor's read-only patient view
│   ├── css/
│   │   └── style.css
│   └── js/
│       ├── app.js              # Auth, login, registration, role routing
│       ├── patient.js          # Patient dashboard, QR, records
│       ├── doctor.js           # Doctor dashboard, consent flow
│       ├── doctor-view.js      # Session timer, record viewer
│       ├── hospital.js         # ER dashboard, triage board
│       ├── paramedic.js        # Paramedic dashboard, alert sender
│       ├── scanner.js          # QR scan parser, emergency overlay
│       └── ai-chatbot.js       # Gemini AI chatbot
└── backend/
    ├── server.js               # Express API server
    ├── db.js                   # MongoDB schemas + data helpers
    ├── ai-chatbot.js           # Chatbot engine
    ├── qr-generator.js         # QR payload builder
    ├── document-service.js     # IPFS upload via Pinata
    ├── reminder-engine.js      # Medication reminder scheduler
    ├── models/
    │   └── Record.js           # Mongoose model
    ├── .env                    # Environment variables (never commit)
    └── package.json
```

---

## Getting Started

### 1. Frontend (No Setup Needed)

Open `index.html` directly in any web browser. Basic data and authentication use `localStorage`.

**Demo accounts:**

| Role | Email | Password |
|---|---|---|
| Patient | patient@demo.com | demo123 |
| Doctor | doctor@demo.com | demo123 |
| Hospital | hospital@demo.com | demo123 |
| Paramedic | *(register a new account)* | — |

---

### 2. Backend (Required for AI, SMS, IPFS, and DB features)

```bash
cd backend
npm install
npm install twilio
```

---

### 3. Environment Variables

Create a `.env` file inside the `backend/` directory.


```env
PORT=5001

# Google Gemini AI (supports up to 4 keys for automatic rotation)
GEMINI_API_KEY_1=your_key_here
GEMINI_API_KEY_2=your_key_here
GEMINI_API_KEY_3=your_key_here
GEMINI_API_KEY_4=your_key_here

# Pinata — IPFS storage
PINATA_API_KEY=your_key_here
PINATA_SECRET_KEY=your_key_here

# MongoDB
MONGO_URI=your_connection_string_here

# Twilio — SMS and OTP
TWILIO_ACCOUNT_SID=your_sid_here
TWILIO_AUTH_TOKEN=your_token_here
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
EMERGENCY_ALERT_TO=+91xxxxxxxxxx
```

---

### 4. Run the Server

```bash
node server.js
```

Server starts at: **`http://localhost:5001`**

> For production deployment, replace all `localhost:5001` references in the frontend JS files with your actual live server URL.

---

video demo: **https://drive.google.com/file/d/1FebHmekltOXEcv5vT8evTPRJhJFCvxWd/view?usp=drivesdk**
git link: **https://github.com/jaruplagouri5-beep/medisync**
## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/chat` | AI health chatbot queries (Gemini) |
| POST | `/api/upload` | Upload document to IPFS + AI tagging |
| GET | `/api/records` | Fetch patient records from MongoDB |
| POST | `/send-alert` | Send emergency SOS SMS via Twilio |
| POST | `/request-access` | Send OTP to patient's phone for doctor consent |
| POST | `/verify-otp` | Verify doctor OTP and grant session |

--- 