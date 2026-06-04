# UPSC Intelligence Hub - Get Started

Welcome to your AI-powered UPSC mentor. Follow these steps to get the system running locally.

## Prerequisite: Gemini API Key
This app uses Gemini 1.5 Flash to process newspapers. You must provide an API key.
1. Go to [Google AI Studio](https://aistudio.google.com/).
2. Generate an API Key.
3. Open `backend/.env` and paste your key:
   ```env
   GEMINI_API_KEY=your_actual_key_here
   ```

## 1. Start the Backend
Open a terminal in the `backend` folder:
```bash
# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload
```
The backend will run on `http://localhost:8000`.

## 2. Start the Frontend
Open another terminal in the `frontend` folder:
```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```
The frontend will run on `http://localhost:3000`.

## 3. How to use
1. Open `http://localhost:3000` in your browser.
2. Click **"Ingest PDF Now"**.
3. Upload a PDF of "The Hindu" or "Indian Express".
4. Wait for the AI to process (usually 10-20 seconds).
5. View your structured UPSC Intelligence, MCQs, and Mains questions!

## Phase 1 (Current) Features:
- [x] PDF Upload & Text Extraction
- [x] AI Editorial Extraction (Gemini)
- [x] UPSC Categorization & GS Paper Mapping
- [x] MCQ & Mains Question Generation
- [x] Premium Dark Mode Dashboard

---
*Built with ❤️ for UPSC Aspirants.*
