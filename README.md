# HealthAI / Medibot

HealthAI / Medibot is a final-year major project prototype for AI-assisted personal health monitoring and educational clinical decision support. It helps users track symptoms, risk scores, health records, lab report summaries, medications, reminders, doctors, and health trends from one dashboard.

## Safety Disclaimer

This system provides educational decision-support information only. It is not a medical diagnosis and does not replace consultation with a licensed clinician. In emergencies, seek immediate medical help.

## Features

- User accounts with login/signup and simple token authentication
- User-scoped symptom history, health records, medications, reminders, and trends
- AI-assisted symptom analysis with severity, risk score, confidence, disease probabilities, and emergency flags
- Persistent health records and lab report metadata through `/api/health-records`
- Health trends dashboard with 7/30/90 day filters, risk/severity/confidence toggle, alerts, and point details
- Personal Health Insights dashboard using stored symptoms, vitals, records, medications, reminders, and adherence data
- Medication tracker with duplicate and interaction warnings
- Smart reminders with adherence-style completion tracking
- Doctor directory and doctor search fallback
- Doctor Visit Summary PDF export
- Model transparency, dataset notes, and explainability sections

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, Recharts, Framer Motion, jsPDF
- Backend: Node.js, Express, Mongoose
- Database: MongoDB, with in-memory fallback for demo mode
- ML/logic: local JavaScript services, trained model metadata, Python severity script fallback

## Run This Project Locally

### Prerequisites

Install these first:

- Node.js 18 or newer
- npm, included with Node.js
- MongoDB Community Server, or a MongoDB Atlas connection string
- MongoDB Compass, optional but useful for viewing saved data
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/shashank55-byte/Healthbot.git
cd Healthbot
```

### 2. Start MongoDB

If you installed MongoDB locally, make sure the MongoDB service is running.

On Windows Command Prompt:

```cmd
sc query MongoDB
net start MongoDB
```

If MongoDB is running locally, Compass can connect with:

```text
mongodb://localhost:27017/
```

If you are using MongoDB Atlas, copy your Atlas connection string and use it in the backend `.env` file.

### 3. Configure the Backend

1. Install backend dependencies:

```bash
cd backend
npm install
```

2. Create the backend environment file:

```cmd
copy .env.example .env
```

For PowerShell, use:

```powershell
Copy-Item .env.example .env
```

3. Update `backend/.env`:

```env
MONGODB_URI=mongodb://localhost:27017/healthbot
PORT=5000
JWT_SECRET=replace-with-a-long-random-secret-before-deployment
GEMINI_API_KEY=
GEMINI_MODEL=
```

`GEMINI_API_KEY` is optional. The app still works without it using local fallback guidance.

### 4. Install the Frontend

Open a second terminal from the project root:

```bash
cd frontend
npm install
```

### 5. Start the App

Start the backend in the backend terminal:

```bash
cd backend
npm run dev
```

Start the frontend in the frontend terminal:

```bash
cd frontend
npm run dev
```

Open the frontend at `http://127.0.0.1:5173/` or the Vite URL shown in the terminal.

The backend runs at:

```text
http://localhost:5000
```

### 6. Create Your First Account

Open the app and sign up with:

- your name
- your email
- any app password with at least 6 characters

Do not use your real Gmail password. The email is only used as the app login identifier.

### 7. Optional: Train the Disease Model

The trained model artifact is already included. To retrain it yourself:

```bash
cd backend
npm run train:disease-model
```

This reads the structured symptom-disease dataset and updates:

```text
backend/models/diseasePredictionModel.json
```

Restart the backend after retraining.

### Troubleshooting

- If Compass shows `ECONNREFUSED 127.0.0.1:27017`, MongoDB is not running or not installed as a service.
- If signup data disappears after backend restart, MongoDB was not connected and the app used in-memory fallback.
- If PowerShell blocks `npm`, use `npm.cmd install`, `npm.cmd run dev`, or `npm.cmd test`.
- If port `5173` is busy, Vite will show another frontend URL in the terminal.
- If port `5000` is busy, change `PORT` in `backend/.env`.

## Demo Workflow

1. Sign up or log in from the first screen.
2. Enter symptoms such as `fever and cough` or `chest pain and shortness of breath`.
3. Review severity, risk score, disease probabilities, confidence, emergency status, and explanations.
4. Upload a sample health record or lab report from Health Records.
5. Open Health Trends and switch between severity, risk score, and confidence.
6. Add vitals, medications, and reminders.
7. Open Personal Insights to show how stored database data becomes a patient-level monitoring report.
8. Generate the Doctor Visit Summary PDF from the analysis result.
9. Log out and log in as another user to show user-scoped data separation.

## Main APIs

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/analyze`
- `GET /api/history`
- `GET /api/health-trends?days=7`
- `GET /api/personal-insights`
- `GET /api/vitals`
- `POST /api/vitals`
- `POST /api/health-records`
- `GET /api/health-records`
- `DELETE /api/health-records/:id`
- `GET /api/medications`
- `POST /api/medications`
- `GET /api/reminders`
- `POST /api/reminders`
- `GET /api/doctors`

Protected APIs accept:

```http
Authorization: Bearer <token>
```

Existing demo APIs still work without a token by falling back to the `demo` user.

## Known Limitations

- The app is a prototype and not clinically validated.
- Health record analysis uses deterministic mock extraction based on file metadata; real OCR/lab parsing is not yet connected.
- Disease prediction uses structured/sample datasets, so accuracy should be presented conservatively.
- The token implementation is intentionally simple for project demonstration; production deployments should use hardened authentication, HTTPS, secure cookies or a vetted JWT library, rate limiting, and password reset flows.
- Uploaded file binary storage is not implemented; the backend persists metadata, analysis summary, risk level, and extracted parameters.
- MongoDB is recommended for real persistence. In-memory fallback is for demos and tests only.
