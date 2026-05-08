# healthbot

AI-based healthcare chatbot scaffold using Node.js/Express (backend), Python (NLU & severity), MongoDB (storage), and React (frontend).

## Prerequisites

- Node.js >= 18
- Python >= 3.9
- MongoDB running locally (or a connection string)

## Project Structure

```
healthbot/
  backend/
    server.js
    routes/api.js
    services/
      severityService.js
      fallbackService.js
    package.json
  nlu/
    symptom_classifier.py
    severity_model.py
    requirements.txt
  frontend/
    index.html
    src/
      App.jsx
      main.jsx
    package.json
  data/
    symptoms.csv
  docs/
    README.md
  .gitignore
```

## Backend (Express)

1. Open a terminal and run:

```
cd healthbot/backend
npm install
```

2. Optionally create a `.env` file with:

```
MONGODB_URI=mongodb://localhost:27017/healthbot
PORT=5000
```

3. Start the backend dev server:

```
npm run dev
```

The API listens on `http://localhost:5000`.

Sample endpoints:
- `GET /api/ping` → health check
- `POST /api/chat` with `{ "message": "I have fever" }` → returns dummy severity & advice, stores interaction in MongoDB
- `GET /api/classify?text=fever%20and%20cough` → attempts Python NLU, falls back to dummy

## Python (NLU & Severity)

1. In a new terminal:

```
cd healthbot/nlu
python -m venv venv
```

On Windows PowerShell:

```
venv\Scripts\Activate.ps1
```

2. Install dependencies:

```
pip install -r requirements.txt
```

3. Test the classifier CLI:

```
python symptom_classifier.py --text "fever and cough"
```

You should see a JSON object printed to stdout.

Implementation notes:
- Replace dummy rules in `symptom_classifier.py` and `severity_model.py` with trained models.
- Implement `train(...)` to fit and persist artifacts (e.g., with joblib).
- Integrate with Node by spawning Python (as in `/api/classify`) or by running a Python microservice.

## Frontend (React)

1. In another terminal:

```
cd healthbot/frontend
npm install
npm run dev
```

The dev server runs at `http://localhost:5173`. The UI posts to `http://localhost:5000/api/chat`.

## Sample Data

`data/symptoms.csv` includes a tiny sample for initial testing. Expand this with real labeled data for training.

## Next Steps

- Replace dummy logic in backend services with Python model calls.
- Build a training pipeline and persist model artifacts.
- Add authentication, input validation, and error handling.
- Add unit tests and linting scripts.

