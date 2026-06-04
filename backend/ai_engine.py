import json
import os
import base64
from dotenv import load_dotenv
from google import genai
from google.genai import types

load_dotenv()

EDITORIAL_PROMPT = """
You are an expert UPSC mentor. Analyze the provided newspaper/document and extract ALL significant editorials, opinion pieces, and important news articles relevant to UPSC/Civil Services preparation.

Output a valid JSON array. Each element must have this exact structure:
[
  {
    "title": "Full title of the article or editorial",
    "source": "Name of newspaper/source if identifiable",
    "category": "Exactly one of: Polity, Governance, Constitution, Economy, Environment, Science & Technology, International Relations, Security, Social Issues, Ethics, Agriculture, Disaster Management, Geography, Culture, Judiciary, Education, Health, Parliament, Government Schemes",
    "gs_paper": "Exactly one of: GS-I, GS-II, GS-III, GS-IV, Essay",
    "relevance_score": <integer 0-100>,
    "tags": ["keyword1", "keyword2", "keyword3"],
    "summary": ["Point 1", "Point 2", "Point 3", "Point 4", "Point 5"],
    "issue_overview": "Core issue explanation",
    "background": "Historical/contextual background",
    "stakeholders": ["Who is affected?"],
    "arguments_for": ["Pro points"],
    "arguments_against": ["Con points"],
    "challenges": ["Key challenges"],
    "way_forward": ["Recommendations"],
    "mcqs": [
      {
        "question": "UPSC style question?",
        "options": ["(a) A", "(b) B", "(c) C", "(d) D"],
        "answer": "(a) A",
        "explanation": "Detailed explanation"
      }
    ],
    "mains_questions": [
      {
        "question": "Question text",
        "gs_paper": "GS Paper",
        "model_answer": {
          "introduction": "Intro",
          "body": "Body points",
          "conclusion": "Conclusion",
          "value_addition": "Value addition"
        }
      }
    ]
  }
]

Generate 5 MCQs and 3 Mains questions per article.
Only include articles with relevance_score >= 70.
Return ONLY the JSON array.
"""

def process_document(text: str = None, pdf_bytes: bytes = None):
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        return {"error": "Missing API Key", "details": "Please set your real GEMINI_API_KEY in the backend/.env file."}

    try:
        client = genai.Client(api_key=api_key)
        
        contents = []
        if text and len(text.strip()) > 500:
            contents.append(EDITORIAL_PROMPT + "\n\nText content:\n" + text[:500000])
        elif pdf_bytes:
            contents.append(EDITORIAL_PROMPT)
            contents.append(types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf"))
        else:
            return {"error": "No content to process"}

        # Try multiple model versions in case of 404 errors
        last_error = None
        # Updated to prioritize stable models to avoid the zero-quota experimental block
        model_list = [
            "gemini-flash-latest",
            "gemini-pro-latest",
            "gemini-1.5-flash",
            "gemini-2.0-flash"
        ]
        
        for model_name in model_list:
            try:
                print(f"Attempting ingestion with model: {model_name}...")
                response = client.models.generate_content(
                    model=model_name,
                    contents=contents,
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        temperature=0.2,
                    )
                )
                
                content = response.text
                if not content or len(content.strip()) < 5:
                    print(f"Model {model_name} returned empty or too short response.")
                    continue
                
                print(f"Ingestion successful using {model_name}. Parsing JSON...")
                
                # Robust JSON cleaning
                clean_content = content.strip()
                if "```json" in clean_content:
                    clean_content = clean_content.split("```json")[1].split("```")[0]
                elif "```" in clean_content:
                    clean_content = clean_content.split("```")[1].split("```")[0]
                
                # Basic cleanup
                clean_content = clean_content.strip()
                
                try:
                    return json.loads(clean_content)
                except json.JSONDecodeError as je:
                    print(f"JSON Parse Error: {str(je)}")
                    # Final attempt: search for first [ and last ]
                    try:
                        start = clean_content.find("[")
                        end = clean_content.rfind("]") + 1
                        if start != -1 and end != 0:
                            return json.loads(clean_content[start:end])
                    except:
                        pass
                    
                    print(f"RAW CONTENT THAT FAILED: {content[:500]}...")
                    raise je
            except Exception as e:
                last_error = str(e)
                if "404" in last_error or "not found" in last_error.lower():
                    print(f"Model {model_name} not found. Trying next...")
                    continue
                else:
                    raise e
                    
        return {"error": "All models failed", "details": last_error}

    except Exception as e:
        print(f"AI Final Error: {str(e)}")
        return {"error": "AI processing failed", "details": str(e)}
