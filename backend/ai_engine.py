import json
import os
import re
from datetime import datetime, timezone
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

EDITORIAL_PROMPT = """
You are an expert UPSC mentor. Analyze the provided newspaper/document and extract ALL significant editorials, opinion pieces, and important news articles relevant to UPSC/Civil Services preparation.

For each article, return a JSON object with EXACTLY these fields (no extras):
{
  "title": "Clear concise headline (string)",
  "category": "Economy | Polity | Environment | International Relations | Science | Security | Society | History",
  "gs_paper": "GS-I | GS-II | GS-III | GS-IV",
  "relevance_score": 85,
  "primary_keyword": "single most important keyword",
  "keywords": ["keyword1", "keyword2", "keyword3"],
  "summary": ["Key point 1", "Key point 2", "Key point 3"],
  "issue_overview": "One paragraph explaining the core issue",
  "background": "One paragraph of historical/contextual background",
  "stakeholders": ["Stakeholder 1", "Stakeholder 2"],
  "arguments_for": ["Argument in favour 1", "Argument in favour 2"],
  "arguments_against": ["Argument against 1", "Argument against 2"],
  "challenges": ["Challenge 1", "Challenge 2"],
  "way_forward": ["Recommendation 1", "Recommendation 2"],
  "mcqs": [
    {
      "question": "MCQ question text",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Option A",
      "explanation": "Why this answer is correct"
    }
  ],
  "mains_questions": [
    {
      "question": "Mains question text",
      "gs_paper": "GS-II",
      "model_answer": {
        "introduction": "Introduction paragraph",
        "body": "Body paragraph with analysis",
        "conclusion": "Conclusion paragraph",
        "value_addition": "Extra facts/data to add"
      }
    }
  ]
}

CRITICAL RULES:
- ALL array fields MUST be actual JSON arrays, NEVER strings.
- relevance_score MUST be a number (integer), NOT a string.
- Return ONLY a JSON array [ {...}, {...} ] with no markdown, no code fences, no explanation.
"""

# Global cache so we don't list models on every request
_cached_models: list = []

def _clean_json_response(raw: str) -> str:
    """Strip markdown code fences and whitespace from AI response."""
    text = raw.strip()
    text = re.sub(r'^```[a-z]*\n?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\n?```$', '', text)
    return text.strip()

def _get_efficient_models(client) -> list:
    global _cached_models
    # gemini-1.5-flash was not found in the verified pool.
    # Switching to the latest verified stable models for this project.
    stable_models = ["gemini-2.0-flash", "gemini-3.5-flash", "gemini-flash-latest"]
    return stable_models

def process_document(text: str = None, pdf_bytes: bytes = None) -> list | dict:
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return {"error": "GEMINI_API_KEY not configured"}

        client = genai.Client(api_key=api_key)
        model_list = _get_efficient_models(client)

        if text:
            prompt_text = EDITORIAL_PROMPT + "\n\nARTICLE TEXT:\n" + text[:30000]
            contents = [prompt_text]
        elif pdf_bytes:
            contents = [
                EDITORIAL_PROMPT,
                types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")
            ]
        else:
            return {"error": "No content provided"}

        last_err = None
        for model_id in model_list:
            try:
                print(f"🚀 INGESTING WITH: {model_id}...", flush=True)
                response = client.models.generate_content(
                    model=model_id,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        response_mime_type="application/json"
                    )
                )

                if not response or not response.text:
                    continue

                cleaned = _clean_json_response(response.text)
                parsed = json.loads(cleaned)
                result = parsed if isinstance(parsed, list) else [parsed]
                print(f"✅ SUCCESS: {model_id}", flush=True)
                return result

            except Exception as e:
                last_err = str(e)
                print(f"⚠️ {model_id} FAILED: {last_err[:100]}", flush=True)
                continue

        return {"error": "All models failed", "details": last_err}

    except Exception as e:
        print(f"❌ AI ERROR: {e}", flush=True)
        return {"error": "AI system failure", "details": str(e)}

def critique_user_answer(question: str, user_answer: str, context: str) -> dict:
    try:
        api_key = os.getenv("GEMINI_API_KEY")
        client = genai.Client(api_key=api_key)

        prompt = f"Critique this UPSC answer. Context: {context[:2000]}. Q: {question}. Answer: {user_answer}. Return JSON with: score, strengths (list), weaknesses (list), structure_feedback, value_addition, overall_evaluation."

        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt],
            config=types.GenerateContentConfig(temperature=0.2, response_mime_type="application/json")
        )
        cleaned = _clean_json_response(response.text)
        return json.loads(cleaned)
    except Exception as e:
        return {"error": "Critique failure", "details": str(e)}
