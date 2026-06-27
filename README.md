# UPSC Intelligence Hub (Volme)
**Elite AI-Powered Knowledge Curation & Strategic Answer Methodology Platform**

Volme is a next-generation, high-yield preparation ecosystem designed specifically for UPSC Civil Services aspirants. It bridges the gap between daily news updates and the highly structured UPSC syllabus by automatically scraping, scanning, categorizing, and critiquing preparation materials.

---

## 💎 The Premium Core Experience

### 1. 📰 Multi-Modal Newspaper Page Scanner
- **Live Page Scanning**: Renders PDF editions page-by-page into high-fidelity previews, performing instant, localized OCR scans.
- **Visual Page Clippings**: Automatically crops the original newspaper column corresponding to a curated article and hosts it for inline preview, letting students trace any brief back to the physical source.
- **Zero-Waste Scanning**: Features intelligent file-hash checking to immediately recognize and load previously scanned editions without redundant AI processing.

### 2. 🏛️ Adaptive UPSC Syllabus Mapping
- **Context-Aware Classification**: Categorizes incoming intelligence into core GS Papers (GS-I to GS-IV) and topics (e.g., Economy, International Relations, Security, Environment).
- **Exact Sub-Topic Tagging**: Mappings correspond directly to the official UPSC syllabus clauses to ensure high-yield study alignment.
- **Structured Knowledge Briefs**: Outputs primary keywords, stakeholders, arguments for/against, core challenges, and strategic way forwards.

### 3. ✍️ UPSC Mains Critique Engine
- **Instant Strategic Feedback**: Analyzes user answers against mock questions using official UPSC grading criteria.
- **Syllabus and Context Match**: Critiques are contextualized with the latest ingested news databases to evaluate current-affairs integration.

### 4. 🎨 "Luxury Zen" Design System
- **State-of-the-Art Typography**: Styled using clean, premium sans-serif typography tailored for high-focus reading.
- **Glassmorphic Theme Customization**: Completely responsive Light & Dark modes designed with harmonious color schemes to eliminate screen strain during long study sessions.

---

## 🏗️ High-Level Technical Architecture
- **Frontend**: React / Next.js (App Router) styled with Vanilla CSS and animated via Framer Motion.
- **Backend**: FastAPI (Python 3.10+) serving high-performance endpoints.
- **Database / Cloud Sync**: Supabase PostgreSQL for state syncing and Supabase Storage for secure hosting of visual page clippings.

---

## 🚀 Setting Up the Station

### Backend setup
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Setup variables in a `.env` file:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`
   - `GEMINI_API_KEY`
3. Run the development server:
   ```bash
   uvicorn main:app --reload --port 8005
   ```

### Frontend setup
1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Configure `.env.local`:
   - `NEXT_PUBLIC_API_URL=http://localhost:8005`
3. Launch:
   ```bash
   npm run dev
   ```

---
*Status: Production-Grade | Created by MD Azhar Hussain*
