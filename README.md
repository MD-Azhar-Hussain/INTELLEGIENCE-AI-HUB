# UPSC Intelligence Hub (Volme)
**Strategic Intelligence & Answer Methodology Platform**

## 🛰️ Project Overview
Volme is a high-performance, "Luxury Zen" preparation platform for UPSC aspirants. It uses advanced AI (Gemini Flash 2.0/3.5) to scrape, analyze, and categorize news intelligence, providing officers with automated summaries, MCQs, and Mains answer critiques.

## 🏛️ Architecture: The Two-Tier Command
The system is built on a "Resilient Hybrid" architecture:
- **Frontend**: Next.js 16 (App Router) + Framer Motion (Luxury UI).
- **Backend**: FastAPI (Python 3.10+) + AI Engine (Gemini).
- **Database**: 
  - **Cloud (Supabase)**: Primary source of truth for global synchronization.
  - **Local (JSON Fallback)**: Persistent cache for zero-latency and offline functionality.

---

## ⚡ Core Directives (Current Features)
1.  **AI Ingestion Engine**: Scrapes and deciphers complex news articles into GS-Paper-wise intelligence.
2.  **Strategic Evaluation**: Evaluates Mains answers with precise feedback based on UPSC standards.
3.  **Adaptive Filtering**: Search index by topic, date-range, and importance.
4.  **Admin Power House**: 
    - Full database authority at `/admin`.
    - Duplicate detection engine to keep the feed clean.
    - Global system stats monitoring.

---

## 🚀 Future Upgrades (The Roadmap)
As per the "Final Strategic Review," the following modules are planned for future deployment:

### 1. **The "Global Pulse" Ingestion (Priority)**
- **System**: An Admin-only "Fetch Everything" trigger.
- **Goal**: Automatically refresh the global feed for all users from predefined news hubs in one click.

### 2. **Mock Evaluation Tiers**
- **System**: Time-bound answer writing with a countdown clock and instant AI scoring.

### 3. **Topic Clustering V2**
- **System**: Advanced semantic grouping of articles to show "Issue Timelines" (e.g., tracking the evolution of a bill).

---

## 🛠️ Deployment Instructions
1.  **Backend**: Deploy `backend/` to Railway/Render. Ensure `SUPABASE_URL`, `SUPABASE_KEY`, and `GEMINI_API_KEY` are in the ENV.
2.  **Frontend**: Deploy `frontend/` to Vercel. Set `NEXT_PUBLIC_API_URL` to point to your live backend.

---
**Status**: Production Ready.
**Authority**: MD Azhar Hussain
