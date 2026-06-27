import json
import os
import re
import base64
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeoutError
from dotenv import load_dotenv
import httpx
from google import genai
from google.genai import types

load_dotenv()

import sys
import builtins
def safe_print(*args, **kwargs):
    encoding = sys.stdout.encoding or 'utf-8'
    safe_args = []
    for arg in args:
        if isinstance(arg, str):
            safe_args.append(arg.encode(encoding, errors='replace').decode(encoding))
        else:
            safe_args.append(arg)
    builtins.print(*safe_args, **kwargs)

print = safe_print

# Per-model hard timeout (seconds) — 10s then move to next model
MODEL_TIMEOUT_SECONDS = 10
VISION_TIMEOUT_SECONDS = 25

# ─────────────────────────────────────────────────────────────────────────────
# GEMINI PROMPT  (returns a plain JSON array — Gemini handles this fine)
# ─────────────────────────────────────────────────────────────────────────────
EDITORIAL_PROMPT = """
You are an elite UPSC mentor. Analyze the provided newspaper article and produce a
premium intelligence brief for IAS/Civil Services aspirants.

Return a JSON array [ {...} ] with EXACTLY these fields per article:
{
  "title": "Clear concise headline derived from the article",
  "category": "ONE of: Economy | Polity | Environment | International Relations | Science | Security | Society | History — choose the MOST accurate based on article content",
  "gs_paper": "ONE of: GS-I | GS-II | GS-III | GS-IV — assign based on actual subject matter",
  "relevance_score": <integer 0-95 — use 0 if the article has zero UPSC relevance (e.g. sports, entertainment, celebrity news); otherwise 50-95 based on actual UPSC importance>,
  "primary_keyword": "the single most important UPSC keyword from this article",
  "keywords": [
    "syllabus:GS-X — Exact sub-topic title mapped from the official UPSC syllabus",
    "syllabus:GS-Y — another mapped sub-topic (if applicable)",
    "keyword1",
    "keyword2",
    "keyword3"
  ],
  "summary": [
    "Specific fact or event point 1 with actors/dates/numbers",
    "Specific fact or event point 2 with actors/dates/numbers",
    "Specific fact or event point 3 with actors/dates/numbers",
    "Specific fact or event point 4 with actors/dates/numbers",
    "Specific fact or event point 5 with actors/dates/numbers"
  ],
  "issue_overview": "3–4 sentence paragraph with genuine analytical depth — explain WHY this matters, the competing interests, and the systemic implications. Do NOT just restate the headline.",
  "background": "3–4 sentence paragraph with historical roots, relevant treaties/laws/incidents with dates, prior context that explains the current situation.",
  "stakeholders": [
    "Stakeholder 1: specific role and interest in this issue",
    "Stakeholder 2: specific role and interest",
    "Stakeholder 3: specific role and interest",
    "Stakeholder 4: specific role and interest"
  ],
  "arguments_for": [
    "Specific well-reasoned argument with logic/evidence from the article",
    "Specific well-reasoned argument 2",
    "Specific well-reasoned argument 3",
    "Specific well-reasoned argument 4"
  ],
  "arguments_against": [
    "Specific well-reasoned counter-argument 1",
    "Specific well-reasoned counter-argument 2",
    "Specific well-reasoned counter-argument 3",
    "Specific well-reasoned counter-argument 4"
  ],
  "challenges": [
    "Specific implementation or systemic challenge 1",
    "Specific challenge 2",
    "Specific challenge 3",
    "Specific challenge 4"
  ],
  "way_forward": [
    "Concrete actionable policy recommendation 1",
    "Concrete actionable recommendation 2",
    "Concrete actionable recommendation 3",
    "Concrete actionable recommendation 4"
  ],
  "mcqs": [
    {
      "question": "Challenging factual/conceptual question derived directly from this article's content — requires real knowledge to answer",
      "options": ["(a) Option A", "(b) Option B", "(c) Option C", "(d) Option D"],
      "answer": "(b) Option B",
      "explanation": "2-sentence explanation citing specific facts from the article and why the other options are wrong."
    },
    {
      "question": "Statement-based question (e.g. 'Consider the following statements: 1... 2... Which is/are correct?')",
      "options": ["(a) 1 only", "(b) 2 only", "(c) Both 1 and 2", "(d) Neither 1 nor 2"],
      "answer": "(c) Both 1 and 2",
      "explanation": "2-sentence explanation with evidence."
    },
    {
      "question": "Application or inference question — requires understanding the article's implications",
      "options": ["(a) Option A", "(b) Option B", "(c) Option C", "(d) Option D"],
      "answer": "(a) Option A",
      "explanation": "2-sentence explanation."
    },
    {
      "question": "Geography/institution/treaty identification question tied to article topics",
      "options": ["(a) Option A", "(b) Option B", "(c) Option C", "(d) Option D"],
      "answer": "(d) Option D",
      "explanation": "2-sentence explanation."
    },
    {
      "question": "Historical precedent or comparison question related to the article's context",
      "options": ["(a) Option A", "(b) Option B", "(c) Option C", "(d) Option D"],
      "answer": "(b) Option B",
      "explanation": "2-sentence explanation."
    }
  ],
  "mains_questions": [
    {
      "question": "Mains-style analytical question (250 words) directly tied to the article's core theme",
      "gs_paper": "GS-II",
      "model_answer": {
        "introduction": "2-sentence contextual introduction with relevant facts",
        "body": "3–4 paragraph analytical body covering multiple dimensions: constitutional/legal, economic, social, strategic",
        "conclusion": "2-sentence conclusion with forward-looking statement",
        "value_addition": "Relevant data point, treaty, constitutional article, or committee name to strengthen the answer"
      }
    },
    {
      "question": "Second Mains question from a different angle (e.g. governance, ethics, economy)",
      "gs_paper": "GS-III",
      "model_answer": {
        "introduction": "2-sentence introduction",
        "body": "3–4 paragraph analytical body",
        "conclusion": "2-sentence conclusion",
        "value_addition": "Relevant fact/data/treaty"
      }
    }
  ]
}

CRITICAL RULES:
- ALL array fields MUST be actual JSON arrays, NEVER strings.
- relevance_score MUST be an integer: 0 if the article is NOT relevant to UPSC (sports/celebrity/entertainment), or 50-95 for relevant content. NEVER hardcode the same number for all articles.
- MCQs must be SPECIFIC to this article — not generic trivia. Require real knowledge to answer.
- Return ONLY a JSON array [ {...} ] with no markdown, no code fences, no explanation.
"""

# ─────────────────────────────────────────────────────────────────────────────
# GROQ / OPENROUTER — System message + wrapper format
# (json_object mode requires a dict, so we use {"articles":[...]} wrapper)
# ─────────────────────────────────────────────────────────────────────────────
_ANALYST_SYSTEM_MSG = """You are an elite UPSC Intelligence Analyst producing premium briefings for IAS aspirants.
Your analysis must be DYNAMIC — derived entirely from the specific article provided, not from generic templates.

MANDATORY QUALITY STANDARDS:
- summary: minimum 5 bullets with SPECIFIC facts, actors, figures, and dates from the article
- issue_overview: 3-4 sentences with analytical depth — explain the competing interests, systemic cause, and larger significance
- background: 3-4 sentences with historical roots — cite treaties, incidents, dates, constitutional provisions where relevant
- stakeholders: minimum 4 NAMED stakeholders with their specific interests
- arguments_for: minimum 4 points with concrete supporting logic, not generic statements
- arguments_against: minimum 4 specific counter-arguments
- challenges: minimum 4 distinct implementation/structural challenges
- way_forward: minimum 4 specific, actionable, policy-level recommendations
- mcqs: exactly 5 challenging MCQs — statement-based, map/geography, institutional — all SPECIFIC to this article
- mains_questions: 2 full questions with complete model answers
- relevance_score: integer — 0 if completely unrelated to UPSC (sports, celebrity, entertainment), or 50-95 based on UPSC importance. NEVER same score for every article
- category & gs_paper: chosen based on the article's ACTUAL subject, not assigned generically

STRICTLY FORBIDDEN:
- Generic filler: "engage in diplomacy", "work together", "address the issue"
- Repeating the headline in summary bullets
- Same relevance_score for different articles
- MCQ options without (a)/(b)/(c)/(d) labels
- Fewer items than the minimums above"""

# Separate, focused system message for answer-critique calls
_CRITIQUE_SYSTEM_MSG = """You are a strict UPSC evaluator assessing a candidate's mains answer.
Return ONLY a JSON object with exactly these keys:
{
  "score": <integer 0-10>,
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "structure_feedback": "Specific advice on introduction/body/conclusion structure",
  "value_addition": "Specific facts, data, treaties, or constitutional articles missing from the answer",
  "overall_evaluation": "2-3 sentence holistic evaluation with actionable improvement tips"
}
Be specific and direct — reference the actual content of the answer. No generic feedback."""

_NON_GEMINI_PROMPT_SUFFIX = """

RETURN FORMAT — a JSON object with key "articles" containing an array:
{
  "articles": [
    {
      "title": "Article-specific headline",
      "category": "Economy|Polity|Environment|International Relations|Science|Security|Society|History",
      "gs_paper": "GS-I|GS-II|GS-III|GS-IV",
      "relevance_score": <0 if unrelated to UPSC; 50-95 based on actual importance>,
      "primary_keyword": "most important UPSC keyword",
      "keywords": ["kw1","kw2","kw3","kw4","kw5"],
      "summary": ["fact 1 with specific details","fact 2","fact 3","fact 4","fact 5"],
      "issue_overview": "3-4 sentence analytical paragraph specific to this article",
      "background": "3-4 sentence historical context with dates/treaties/laws",
      "stakeholders": ["Name/Group 1: their specific interest","Name/Group 2: interest","Name/Group 3: interest","Name/Group 4: interest"],
      "arguments_for": ["specific argument 1","specific argument 2","specific argument 3","specific argument 4"],
      "arguments_against": ["specific counter 1","counter 2","counter 3","counter 4"],
      "challenges": ["challenge 1","challenge 2","challenge 3","challenge 4"],
      "way_forward": ["recommendation 1","recommendation 2","recommendation 3","recommendation 4"],
      "mcqs": [
        {"question":"Statement-based Q from article","options":["(a) ...","(b) ...","(c) ...","(d) ..."],"answer":"(b) ...","explanation":"2-sentence explanation with article facts."},
        {"question":"Factual Q requiring real knowledge","options":["(a) ...","(b) ...","(c) ...","(d) ..."],"answer":"(a) ...","explanation":"2-sentence explanation."},
        {"question":"Geography/Institution Q tied to article","options":["(a) ...","(b) ...","(c) ...","(d) ..."],"answer":"(c) ...","explanation":"2-sentence explanation."},
        {"question":"Application/inference Q from article's implications","options":["(a) ...","(b) ...","(c) ...","(d) ..."],"answer":"(d) ...","explanation":"2-sentence explanation."},
        {"question":"Historical precedent Q contextualising the article","options":["(a) ...","(b) ...","(c) ...","(d) ..."],"answer":"(b) ...","explanation":"2-sentence explanation."}
      ],
      "mains_questions": [
        {"question":"250-word Mains Q on article's core theme","gs_paper":"GS-II","model_answer":{"introduction":"2-sentence context","body":"multi-paragraph analysis covering legal/economic/social/strategic dimensions","conclusion":"2-sentence forward-looking close","value_addition":"specific treaty/article/data point"}},
        {"question":"Second Mains Q from different angle","gs_paper":"GS-III","model_answer":{"introduction":"2-sentence context","body":"multi-paragraph analysis","conclusion":"2-sentence close","value_addition":"specific fact/data"}}
      ]
    }
  ]
}
No markdown. No explanation. Only the JSON object above."""


def _build_ingestion_prompt(text: str) -> str:
    """Build the Groq/OpenRouter ingestion prompt with the wrapper format."""
    return (
        "Analyze the following news article thoroughly for UPSC Civil Services preparation.\n"
        "Every field must be SPECIFIC to this article — no generic filler.\n\n"
        "ARTICLE TEXT:\n"
        + text[:28000]
        + _NON_GEMINI_PROMPT_SUFFIX
    )


def _parse_non_gemini_response(raw: str) -> list:
    """Parse Groq/OpenRouter response — handles {"articles":[]} and plain [] formats."""
    cleaned = _clean_json_response(raw)
    data = json.loads(cleaned)
    if isinstance(data, dict) and "articles" in data:
        result = data["articles"]
    elif isinstance(data, list):
        result = data
    elif isinstance(data, dict):
        # Single article object without wrapper
        result = [data]
    else:
        raise ValueError(f"Unexpected response shape: {type(data)}")
    return result if isinstance(result, list) else [result]


# ─────────────────────────────────────────────────────────────────────────────
# Utility helpers  (defined early so all callers below can reference them)
# ─────────────────────────────────────────────────────────────────────────────
_cached_models: list = []


def _clean_json_response(raw: str) -> str:
    """Strip markdown code fences and whitespace from AI response."""
    text = raw.strip()
    text = re.sub(r'^```[a-z]*\n?', '', text, flags=re.IGNORECASE)
    text = re.sub(r'\n?```$', '', text)
    return text.strip()


def _get_efficient_models_primary(client) -> list:
    """Tier-1 Gemini: tried before Groq."""
    return ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"]


def _get_efficient_models_secondary(client) -> list:
    """Tier-2 Gemini: tried after Groq."""
    return ["gemini-flash-latest"]


# ─────────────────────────────────────────────────────────────────────────────
# API KEY POOLS & ROTATION
# ─────────────────────────────────────────────────────────────────────────────
_ACTIVE_GEMINI_KEY_INDEX = 0
_ACTIVE_GROQ_KEY_INDEX = 0
_ACTIVE_OR_KEY_INDEX = 0

def _get_gemini_keys() -> list:
    keys = []
    for suffix in ["", "_2", "_3"]:
        k = os.getenv(f"GEMINI_API_KEY{suffix}")
        if k and k.strip():
            keys.append(k.strip())
    seen = set()
    return [x for x in keys if not (x in seen or seen.add(x))]

def _get_groq_keys() -> list:
    keys = []
    for suffix in ["", "_2"]:
        k = os.getenv(f"GROQ_API_KEY{suffix}")
        if k and k.strip():
            keys.append(k.strip())
    seen = set()
    return [x for x in keys if not (x in seen or seen.add(x))]

def _get_openrouter_keys() -> list:
    keys = []
    for suffix in ["", "_2"]:
        k = os.getenv(f"OPENROUTER_API_KEY{suffix}")
        if k and k.strip():
            keys.append(k.strip())
    seen = set()
    return [x for x in keys if not (x in seen or seen.add(x))]

def _call_gemini_with_rotation(func):
    global _ACTIVE_GEMINI_KEY_INDEX
    keys = _get_gemini_keys()
    if not keys:
        raise ValueError("No Gemini API keys configured.")
    num_keys = len(keys)
    last_err = None
    for i in range(num_keys):
        idx = (_ACTIVE_GEMINI_KEY_INDEX + i) % num_keys
        key = keys[idx]
        try:
            client = genai.Client(api_key=key)
            res = func(client)
            _ACTIVE_GEMINI_KEY_INDEX = idx
            return res
        except Exception as e:
            err_str = str(e)
            last_err = e
            if any(term in err_str.lower() for term in ["429", "quota", "exhausted", "limit", "too many requests"]):
                print(f"⚠️ Gemini Key {idx+1} rate-limited/exhausted. Rotating to next key...", flush=True)
                continue
            else:
                print(f"⚠️ Gemini Key {idx+1} failed: {err_str[:150]}", flush=True)
                continue
    raise last_err

def _call_groq_with_rotation(func):
    global _ACTIVE_GROQ_KEY_INDEX
    keys = _get_groq_keys()
    if not keys:
        raise ValueError("No Groq API keys configured.")
    num_keys = len(keys)
    last_err = None
    for i in range(num_keys):
        idx = (_ACTIVE_GROQ_KEY_INDEX + i) % num_keys
        key = keys[idx]
        try:
            res = func(key)
            _ACTIVE_GROQ_KEY_INDEX = idx
            return res
        except Exception as e:
            err_str = str(e)
            last_err = e
            if any(term in err_str.lower() for term in ["429", "quota", "exhausted", "limit", "too many requests"]):
                print(f"⚠️ Groq Key {idx+1} rate-limited/exhausted. Rotating to next key...", flush=True)
                continue
            else:
                print(f"⚠️ Groq Key {idx+1} failed: {err_str[:150]}", flush=True)
                continue
    raise last_err

def _call_or_with_rotation(func):
    global _ACTIVE_OR_KEY_INDEX
    keys = _get_openrouter_keys()
    if not keys:
        raise ValueError("No OpenRouter API keys configured.")
    num_keys = len(keys)
    last_err = None
    for i in range(num_keys):
        idx = (_ACTIVE_OR_KEY_INDEX + i) % num_keys
        key = keys[idx]
        try:
            res = func(key)
            _ACTIVE_OR_KEY_INDEX = idx
            return res
        except Exception as e:
            err_str = str(e)
            last_err = e
            if any(term in err_str.lower() for term in ["429", "quota", "exhausted", "limit", "too many requests"]):
                print(f"⚠️ OpenRouter Key {idx+1} rate-limited/exhausted. Rotating to next key...", flush=True)
                continue
            else:
                print(f"⚠️ OpenRouter Key {idx+1} failed: {err_str[:150]}", flush=True)
                continue
    raise last_err

# ─────────────────────────────────────────────────────────────────────────────
# GROQ
# ─────────────────────────────────────────────────────────────────────────────
def _process_via_groq(prompt: str, is_critique: bool = False) -> str:
    def _call(api_key: str):
        model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        sys_msg = _CRITIQUE_SYSTEM_MSG if is_critique else _ANALYST_SYSTEM_MSG
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3 if is_critique else 0.15,
            "response_format": {"type": "json_object"},
            "max_tokens": 8000
        }
        print(f"⚡ TRYING GROQ: {model}...", flush=True)
        _timeout = httpx.Timeout(10.0, connect=4.0)
        with httpx.Client(timeout=_timeout) as client:
            response = client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
            resp_data = response.json()
            return resp_data["choices"][0]["message"]["content"]
            
    return _call_groq_with_rotation(_call)

# ─────────────────────────────────────────────────────────────────────────────
# OPENROUTER
# ─────────────────────────────────────────────────────────────────────────────
def _process_via_openrouter(prompt: str, is_critique: bool = False, model: str = None) -> str:
    def _call(api_key: str):
        nonlocal model
        if model is None:
            model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct")
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/MD-Azhar-Hussain/INTELLEGIENCE-AI-HUB",
            "X-Title": "UPSC Intelligence Hub"
        }
        sys_msg = _CRITIQUE_SYSTEM_MSG if is_critique else _ANALYST_SYSTEM_MSG
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": sys_msg},
                {"role": "user", "content": prompt}
            ],
            "temperature": 0.3 if is_critique else 0.15,
            "response_format": {"type": "json_object"},
            "max_tokens": 8000
        }
        print(f"⚡ TRYING OPENROUTER: {model}...", flush=True)
        _timeout = httpx.Timeout(10.0, connect=4.0)
        with httpx.Client(timeout=_timeout) as client:
            response = client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
            resp_data = response.json()
            return resp_data["choices"][0]["message"]["content"]

    return _call_or_with_rotation(_call)

# ─────────────────────────────────────────────────────────────────────────────
# OPENROUTER VISION FALLBACK
# ─────────────────────────────────────────────────────────────────────────────
def _process_vision_via_openrouter(prompt: str, image_bytes: bytes, model: str = "google/gemma-4-26b-a4b-it:free") -> str:
    def _call(api_key: str):
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/MD-Azhar-Hussain/INTELLEGIENCE-AI-HUB",
            "X-Title": "UPSC Intelligence Hub"
        }
        base64_image = base64.b64encode(image_bytes).decode("utf-8")
        payload = {
            "model": model,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}}
                    ]
                }
            ],
            "temperature": 0.1
        }
        print(f"⚡ TRYING OPENROUTER VISION: {model}...", flush=True)
        _timeout = httpx.Timeout(40.0, connect=8.0)
        with httpx.Client(timeout=_timeout) as client:
            response = client.post("https://openrouter.ai/api/v1/chat/completions", json=payload, headers=headers)
            response.raise_for_status()
            resp_data = response.json()
            return resp_data["choices"][0]["message"]["content"]

    return _call_or_with_rotation(_call)

# ─────────────────────────────────────────────────────────────────────────────
# CEREBRAS
# ─────────────────────────────────────────────────────────────────────────────
def _process_via_cerebras(prompt: str) -> str:
    key = os.getenv("CEREBRAS_API_KEY")
    if not key:
        raise ValueError("CEREBRAS_API_KEY not configured")
    model = os.getenv("CEREBRAS_MODEL", "llama3.3-70b")
    headers = {
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": _ANALYST_SYSTEM_MSG},
            {"role": "user", "content": prompt}
        ],
        "temperature": 0.15,
        "response_format": {"type": "json_object"}
    }
    print(f"⚡ TRYING CEREBRAS: {model}...", flush=True)
    _timeout = httpx.Timeout(10.0, connect=4.0)
    with httpx.Client(timeout=_timeout) as client:
        response = client.post("https://api.cerebras.ai/v1/chat/completions", json=payload, headers=headers)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]


# ─────────────────────────────────────────────────────────────────────────────
# MAIN INGESTION PIPELINE
# ─────────────────────────────────────────────────────────────────────────────
def process_document(text: str = None, pdf_bytes: bytes = None, web_import: bool = False) -> list | dict:
    try:
        if text:
            # Gemini prompt (returns plain JSON array)
            gemini_prompt_text = EDITORIAL_PROMPT + "\n\nARTICLE TEXT:\n" + text[:30000]
            gemini_contents = [gemini_prompt_text]
            # Groq/OpenRouter prompt (returns {"articles":[...]} wrapper)
            non_gemini_prompt = _build_ingestion_prompt(text)
        elif pdf_bytes:
            gemini_contents = [
                EDITORIAL_PROMPT,
                types.Part.from_bytes(data=pdf_bytes, mime_type="application/pdf")
            ]
            non_gemini_prompt = None  # PDF not supported on Groq/OR
        else:
            return {"error": "No content provided"}

        last_err = None
        has_gemini = len(_get_gemini_keys()) > 0

        def _run_gemini_model(model_id: str):
            """Run a single Gemini model with timeout and key rotation."""
            def _call(client):
                print(f"🚀 INGESTING WITH GEMINI: {model_id}...", flush=True)
                response = client.models.generate_content(
                    model=model_id,
                    contents=gemini_contents,
                    config=types.GenerateContentConfig(
                        temperature=0.1,
                        response_mime_type="application/json"
                    )
                )
                if not response or not response.text:
                    raise ValueError(f"Empty response from {model_id}")
                cleaned = _clean_json_response(response.text)
                parsed = json.loads(cleaned)
                return parsed if isinstance(parsed, list) else [parsed]
            return _call_gemini_with_rotation(_call)

        # ── Dynamically determine Phase order based on input type ─────────────
        # If pdf_bytes is present: we MUST use Gemini vision/multimodal first.
        # If text is present: we use the text-optimized flow to save Gemini quota.
        
        # We define all fallback steps as helper functions:
        def _try_gemini():
            if not has_gemini:
                return None
            for model_id in ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash"]:
                try:
                    result = _run_gemini_model(model_id)
                    print(f"✅ GEMINI SUCCESS: {model_id}", flush=True)
                    return result
                except FuturesTimeoutError:
                    print(f"⏱/ GEMINI {model_id} TIMED OUT ({MODEL_TIMEOUT_SECONDS}s), moving on...", flush=True)
                except Exception as e:
                    print(f"⚠️ GEMINI {model_id} FAILED: {str(e)[:100]}", flush=True)
            return None

        def _try_cerebras():
            if not os.getenv("CEREBRAS_API_KEY") or not non_gemini_prompt:
                return None
            try:
                response_text = _process_via_cerebras(non_gemini_prompt)
                result = _parse_non_gemini_response(response_text)
                print("✅ CEREBRAS SUCCESS!", flush=True)
                return result
            except Exception as e:
                print(f"⚠️ CEREBRAS FAILED: {str(e)[:100]}", flush=True)
            return None

        def _try_groq():
            if len(_get_groq_keys()) == 0 or not non_gemini_prompt:
                return None
            try:
                response_text = _process_via_groq(non_gemini_prompt, is_critique=False)
                result = _parse_non_gemini_response(response_text)
                print("✅ GROQ SUCCESS!", flush=True)
                return result
            except Exception as e:
                print(f"⚠️ GROQ FAILED: {str(e)[:100]}", flush=True)
            return None

        def _try_gemini_secondary():
            if not has_gemini:
                return None
            for model_id in ["gemini-flash-latest"]:
                try:
                    result = _run_gemini_model(model_id)
                    print(f"✅ GEMINI SECONDARY SUCCESS: {model_id}", flush=True)
                    return result
                except FuturesTimeoutError:
                    print(f"⏱/ GEMINI {model_id} TIMED OUT ({MODEL_TIMEOUT_SECONDS}s), moving on...", flush=True)
                except Exception as e:
                    print(f"⚠️ GEMINI {model_id} FAILED: {str(e)[:100]}", flush=True)
            return None

        def _try_openrouter_primary():
            if len(_get_openrouter_keys()) == 0 or not non_gemini_prompt:
                return None
            openrouter_gemini_model = os.getenv("OPENROUTER_GEMINI_MODEL", "google/gemma-4-26b-a4b-it:free")
            try:
                response_text = _process_via_openrouter(non_gemini_prompt, is_critique=False, model=openrouter_gemini_model)
                result = _parse_non_gemini_response(response_text)
                print(f"✅ OPENROUTER (Gemini) SUCCESS via {openrouter_gemini_model}!", flush=True)
                return result
            except Exception as e:
                print(f"⚠️ OPENROUTER (Gemini) FAILED: {str(e)[:100]}", flush=True)
            return None

        def _try_openrouter_secondary():
            if len(_get_openrouter_keys()) == 0 or not non_gemini_prompt:
                return None
            other_model = os.getenv("OPENROUTER_MODEL", "meta-llama/llama-3.3-70b-instruct")
            try:
                response_text = _process_via_openrouter(non_gemini_prompt, is_critique=False, model=other_model)
                result = _parse_non_gemini_response(response_text)
                print(f"✅ OPENROUTER ({other_model}) SUCCESS!", flush=True)
                return result
            except Exception as e:
                print(f"⚠️ OPENROUTER ({other_model}) FAILED: {str(e)[:100]}", flush=True)
            return None

        # Execute according to pipeline logic
        if pdf_bytes:
            # 1. Gemini
            res = _try_gemini()
            if res: return res
            
            # 2. Gemini Secondary
            res = _try_gemini_secondary()
            if res: return res

            # PDF bytes cannot run on text-only APIs (Cerebras/Groq/OR text fallbacks)
            last_err = "PDF bytes requires vision capability, which failed on all Gemini models."
        else:
            # Text Ingestion (Manual or Web Scraping)
            
            # Special case: web_import parameter overrides to try Groq first if preferred
            if web_import:
                # 1. Groq
                res = _try_groq()
                if res: return res
                
                # 2. Cerebras
                res = _try_cerebras()
                if res: return res
            else:
                # Standard text ingestion
                # 1. Cerebras
                res = _try_cerebras()
                if res: return res
                
                # 2. Groq
                res = _try_groq()
                if res: return res
            
            # 3. Gemini Primary
            res = _try_gemini()
            if res: return res
            
            # 4. Gemini Secondary
            res = _try_gemini_secondary()
            if res: return res
            
            # 5. OpenRouter Primary
            res = _try_openrouter_primary()
            if res: return res
            
            # 6. OpenRouter Secondary
            res = _try_openrouter_secondary()
            if res: return res
            
            last_err = "All text ingestion fallback engines failed."

        return {"error": "All AI models and fallback engines failed", "details": last_err}

    except Exception as e:
        print(f"❌ CRITICAL AI ENGINE ERROR: {e}", flush=True)
        return {"error": "AI system failure", "details": str(e)}


# ─────────────────────────────────────────────────────────────────────────────
# MAINS ANSWER CRITIQUE
# ─────────────────────────────────────────────────────────────────────────────
def critique_user_answer(question: str, user_answer: str, context: str) -> dict:
    prompt = (
        f"Critique this UPSC answer.\n"
        f"Context: {context[:2000]}\n"
        f"Question: {question}\n"
        f"Answer: {user_answer}\n\n"
        f"Return a JSON object with: score (integer 0-10), strengths (list), weaknesses (list), "
        f"structure_feedback (string), value_addition (string), overall_evaluation (string)."
    )
    has_gemini = len(_get_gemini_keys()) > 0
    has_groq = len(_get_groq_keys()) > 0
    has_or = len(_get_openrouter_keys()) > 0

    # Phase 1: Try Gemini with key rotation
    if has_gemini:
        for model_id in ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-flash"]:
            try:
                def _run_critique(client):
                    print(f"🚀 CRITIQUING WITH GEMINI: {model_id}...", flush=True)
                    response = client.models.generate_content(
                        model=model_id,
                        contents=[prompt],
                        config=types.GenerateContentConfig(temperature=0.2, response_mime_type="application/json")
                    )
                    if not response or not response.text:
                        raise ValueError(f"Empty scan response from {model_id}")
                    cleaned = _clean_json_response(response.text)
                    return json.loads(cleaned)

                # Execute with key rotation
                res_critique = _call_gemini_with_rotation(_run_critique)
                print(f"✅ GEMINI CRITIQUE SUCCESS: {model_id}!", flush=True)
                return res_critique
            except FuturesTimeoutError:
                print(f"⏱️ GEMINI critique {model_id} TIMED OUT ({MODEL_TIMEOUT_SECONDS}s), trying next...", flush=True)
            except Exception as e:
                last_err = str(e)
                print(f"⚠️ Gemini critique {model_id} failed: {last_err[:100]}", flush=True)
    else:
        print("⚠️ Gemini keys missing, skipping Gemini critique.", flush=True)

    # Phase 2: Try Groq with key rotation
    if has_groq:
        try:
            response_text = _process_via_groq(prompt, is_critique=True)
            cleaned = _clean_json_response(response_text)
            data = json.loads(cleaned)
            # Groq sometimes wraps critique in {"critique":{...}} or {"result":{...}}
            if isinstance(data, dict):
                for wrap_key in ("critique", "result", "evaluation", "feedback"):
                    if wrap_key in data and isinstance(data[wrap_key], dict):
                        data = data[wrap_key]
                        break
            print("✅ GROQ CRITIQUE SUCCESS!", flush=True)
            return data
        except Exception as e:
            last_err = str(e)
            print(f"⚠️ Groq critique failed: {last_err[:100]}", flush=True)
    else:
        print("⚠️ Groq keys missing, skipping Groq critique.", flush=True)

    # Phase 3: Try OpenRouter with key rotation
    if has_or:
        try:
            response_text = _process_via_openrouter(prompt, is_critique=True)
            cleaned = _clean_json_response(response_text)
            data = json.loads(cleaned)
            # OpenRouter may also wrap in an outer key
            if isinstance(data, dict):
                for wrap_key in ("critique", "result", "evaluation", "feedback"):
                    if wrap_key in data and isinstance(data[wrap_key], dict):
                        data = data[wrap_key]
                        break
            print("✅ OPENROUTER CRITIQUE SUCCESS!", flush=True)
            return data
        except Exception as e:
            last_err = str(e)
            print(f"⚠️ OpenRouter critique failed: {last_err[:100]}", flush=True)
    else:
        print("⚠️ OPENROUTER_API_KEY missing, skipping OpenRouter critique.", flush=True)

    return {"error": "All critique engines failed", "details": last_err}


# ─────────────────────────────────────────────────────────────────────────────
# NEWSPAPER SCANNING — Phase 1: Cheap headline detection per page
# ─────────────────────────────────────────────────────────────────────────────
_HEADLINE_SCAN_PROMPT = """You are scanning a scanned newspaper page image.
List EVERY distinct news article headline visible on this page.
For each, provide a one-sentence excerpt of the article's opening content, along with an initial estimation of its UPSC relevance score and category.

RULES:
- Include ONLY actual news article headlines — ignore ads, page numbers, section headers, weather, crosswords, sports scores.
- If you see multi-column articles, identify each as a separate story.
- Keep headlines short and exact as they appear in the newspaper.
- Relevance score must be an integer: 0 if unrelated to civil services, or 50-95 based on UPSC importance.
- Category must be one of: Economy | Polity | Environment | International Relations | Science | Security | Society | History.

Return ONLY a JSON array — no markdown, no explanation:
[
  {
    "headline": "Exact headline text here",
    "excerpt": "One sentence opening of the article...",
    "relevance_score": 85,
    "category": "Economy"
  },
  {
    "headline": "Another headline",
    "excerpt": "Its opening sentence...",
    "relevance_score": 60,
    "category": "Polity"
  }
]

If no news articles are visible, return an empty array: []"""


def scan_newspaper_page(page_bytes: bytes) -> list:
    """Phase 1: Cheap, fast Gemini Vision call to detect article headlines on one newspaper page.
    Returns a list of {headline, excerpt} dicts. Returns [] on failure (safe — caller skips empty pages)."""
    has_gemini = len(_get_gemini_keys()) > 0

    # --- Step A: Try Gemini Vision API first ---
    if has_gemini:
        contents = [
            _HEADLINE_SCAN_PROMPT,
            types.Part.from_bytes(data=page_bytes, mime_type="image/jpeg")
        ]

        # gemini-3.1-flash-lite has 500 RPD free quota, gemini-3.5-flash has 20 RPD free quota
        for model_id in ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-flash"]:
            try:
                def _run_with_key(client):
                    print(f"🔍 SCANNING PAGE WITH GEMINI: {model_id}...", flush=True)
                    response = client.models.generate_content(
                        model=model_id,
                        contents=contents,
                        config=types.GenerateContentConfig(
                            temperature=0.1,
                            response_mime_type="application/json"
                        )
                    )
                    if not response or not response.text:
                        raise ValueError(f"Empty scan response from {model_id}")
                    cleaned = _clean_json_response(response.text)
                    parsed = json.loads(cleaned)
                    if isinstance(parsed, list):
                        print(f"✅ PAGE SCAN GEMINI SUCCESS: found {len(parsed)} stories.", flush=True)
                        return parsed
                    return []

                # Execute scan with rotated API keys
                return _call_gemini_with_rotation(_run_with_key)

            except FuturesTimeoutError:
                print(f"⏱️ SCAN GEMINI {model_id} TIMED OUT ({VISION_TIMEOUT_SECONDS}s), trying next...", flush=True)
            except Exception as e:
                print(f"⚠️ SCAN GEMINI {model_id} FAILED: {str(e)[:150]}", flush=True)

    # --- Step B: Fallback to OpenRouter Vision models ---
    # google/gemma-4-26b-a4b-it:free confirmed working (tested 2026-06-27):
    # returns JSON headlines from newspaper page images correctly.
    if len(_get_openrouter_keys()) > 0:
        for model_id in [
            "google/gemma-4-26b-a4b-it:free",           # Confirmed working vision model
        ]:
            try:
                print(f"🔍 SCANNING PAGE WITH OPENROUTER VISION: {model_id}...", flush=True)
                response_text = _process_vision_via_openrouter(
                    prompt=_HEADLINE_SCAN_PROMPT,
                    image_bytes=page_bytes,
                    model=model_id
                )
                cleaned = _clean_json_response(response_text)
                parsed = json.loads(cleaned)
                if isinstance(parsed, list):
                    print(f"✅ PAGE SCAN OPENROUTER SUCCESS ({model_id}): found {len(parsed)} stories.", flush=True)
                    return parsed
                elif isinstance(parsed, dict):
                    # Some models wrap in {"stories": [...]} or {"articles": [...]}
                    for key in ("stories", "articles", "headlines", "items"):
                        if key in parsed and isinstance(parsed[key], list):
                            print(f"✅ PAGE SCAN OPENROUTER SUCCESS ({model_id}, wrapped): found {len(parsed[key])} stories.", flush=True)
                            return parsed[key]
            except Exception as e:
                print(f"⚠️ SCAN OPENROUTER {model_id} FAILED: {str(e)[:150]}", flush=True)

    print("❌ All vision models exhausted. Returning empty page.", flush=True)
    return []


# ─────────────────────────────────────────────────────────────────────────────
# NEWSPAPER INGESTION — Phase 2: Deep UPSC analysis for a single selected story
# ─────────────────────────────────────────────────────────────────────────────
_NEWSPAPER_FOCUS_PREFIX = """You are an elite UPSC mentor analyzing a scanned newspaper page.
IMPORTANT: The page may contain MULTIPLE articles. Focus EXCLUSIVELY on the article with this headline:

"{headline}"

Ignore all other articles, advertisements, and unrelated content on the page.
Analyze ONLY the article matching the headline above.

"""


def process_newspaper_article(page_bytes: bytes, headline: str) -> list | dict:
    """Phase 2: Deep UPSC analysis of a single article on a newspaper page.
    Uses the same Gemini → Groq → OpenRouter fallback chain as process_document.
    The page image is sent to Gemini Vision; headline provides focus guidance."""

    focus_prompt = _NEWSPAPER_FOCUS_PREFIX.format(headline=headline) + EDITORIAL_PROMPT
    gemini_contents = [
        focus_prompt,
        types.Part.from_bytes(data=page_bytes, mime_type="image/png")
    ]

    # Text-mode fallback prompt for Groq/OpenRouter (vision not supported)
    non_gemini_prompt = _build_ingestion_prompt(
        f"[Article from scanned newspaper]\nHeadline: {headline}\n\n"
        f"(This is a scanned page — please generate the UPSC analysis based on the headline and any context provided. "
        f"Focus only on this article.)"
    )

    last_err = None
    has_gemini = len(_get_gemini_keys()) > 0

    def _run_gemini_vision(model_id: str):
        def _call(client):
            print(f"🚀 NEWSPAPER INGEST WITH GEMINI: {model_id}...", flush=True)
            response = client.models.generate_content(
                model=model_id,
                contents=gemini_contents,
                config=types.GenerateContentConfig(
                    temperature=0.1,
                    response_mime_type="application/json"
                )
            )
            if not response or not response.text:
                raise ValueError(f"Empty response from {model_id}")
            cleaned = _clean_json_response(response.text)
            parsed = json.loads(cleaned)
            return parsed if isinstance(parsed, list) else [parsed]
        return _call_gemini_with_rotation(_call)

    # Phase 1: Gemini (vision-capable)
    if has_gemini:
        # We list gemini-3.1-flash-lite (500 RPD) first in fallback as it has high free quota
        for model_id in ["gemini-3.5-flash", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-2.0-flash", "gemini-2.5-flash"]:
            try:
                result = _run_gemini_vision(model_id)
                print(f"✅ NEWSPAPER GEMINI SUCCESS: {model_id}", flush=True)
                return result
            except FuturesTimeoutError:
                print(f"⏱️ NEWSPAPER GEMINI {model_id} TIMED OUT ({VISION_TIMEOUT_SECONDS}s), trying next...", flush=True)
            except Exception as e:
                last_err = str(e)
                print(f"⚠️ NEWSPAPER GEMINI {model_id} FAILED: {last_err[:100]}", flush=True)
    else:
        print("⚠️ Gemini keys missing, skipping vision phase.", flush=True)

    # Phase 1.3: OpenRouter Vision Fallback
    # google/gemma-4-26b-a4b-it:free is confirmed working for vision (2026-06-27)
    if len(_get_openrouter_keys()) > 0:
        for model_id in ["google/gemma-4-26b-a4b-it:free"]:
            try:
                print(f"🚀 NEWSPAPER INGEST WITH OPENROUTER VISION: {model_id}...", flush=True)
                response_text = _process_vision_via_openrouter(
                    prompt=focus_prompt,
                    image_bytes=page_bytes,
                    model=model_id
                )
                cleaned = _clean_json_response(response_text)
                parsed = json.loads(cleaned)
                result = parsed if isinstance(parsed, list) else [parsed]
                print(f"✅ NEWSPAPER OPENROUTER VISION SUCCESS: {model_id}", flush=True)
                return result
            except Exception as e:
                last_err = str(e)
                print(f"⚠️ NEWSPAPER OPENROUTER VISION FAILED ({model_id}): {last_err[:100]}", flush=True)

    # Phase 1.5: Cerebras Fallback (High-speed Llama)
    if os.getenv("CEREBRAS_API_KEY"):
        try:
            response_text = _process_via_cerebras(non_gemini_prompt)
            result = _parse_non_gemini_response(response_text)
            print("✅ NEWSPAPER CEREBRAS FALLBACK SUCCESS!", flush=True)
            return result
        except Exception as cerebras_err:
            last_err = str(cerebras_err)
            print(f"⚠️ NEWSPAPER CEREBRAS FAILED: {last_err[:100]}", flush=True)

    # Phase 2: Groq (text-mode fallback — uses headline as context)
    if len(_get_groq_keys()) > 0:
        try:
            response_text = _process_via_groq(non_gemini_prompt, is_critique=False)
            result = _parse_non_gemini_response(response_text)
            print("✅ NEWSPAPER GROQ FALLBACK SUCCESS!", flush=True)
            return result
        except Exception as groq_err:
            last_err = str(groq_err)
            print(f"⚠️ NEWSPAPER GROQ FAILED: {last_err[:100]}", flush=True)

    # Phase 3: OpenRouter fallback (text-mode)
    if len(_get_openrouter_keys()) > 0:
        try:
            response_text = _process_via_openrouter(non_gemini_prompt, is_critique=False)
            result = _parse_non_gemini_response(response_text)
            print("✅ NEWSPAPER OPENROUTER FALLBACK SUCCESS!", flush=True)
            return result
        except Exception as or_err:
            last_err = str(or_err)
            print(f"⚠️ NEWSPAPER OPENROUTER FAILED: {last_err[:100]}", flush=True)

    return {"error": "All newspaper ingestion engines failed", "details": last_err}
