import axios from "axios";

// Central store for articles — uses localStorage for persistence across refreshes
export interface MCQ {
  question: string;
  options: string[];
  answer: string;
  explanation: string;
}

export interface MainsQuestion {
  question: string;
  gs_paper: string;
  model_answer: {
    introduction: string;
    body: string;
    conclusion: string;
    value_addition: string;
  };
}

export interface Article {
  id: string;
  title: string;
  source?: string;
  category: string;
  gs_paper: string;
  relevance_score: number;
  tags?: string[];
  summary: string[];
  issue_overview: string;
  background: string;
  stakeholders: string[];
  arguments_for: string[];
  arguments_against: string[];
  challenges: string[];
  way_forward: string[];
  mcqs: MCQ[];
  mains_questions: MainsQuestion[];
  ingested_at: string;
  filename: string;
  isImportant?: boolean;
  isCompleted?: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8005";
const STORAGE_KEY = "upsc_hub_articles";
const AUTH_KEY = "upsc_hub_user";

export function getArticles(): Article[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveArticles(articles: Article[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
}

export function addArticles(newArticles: Article[]): Article[] {
  const existing = getArticles();
  const existingTitles = new Set(existing.map((a) => a.title));
  const toAdd = newArticles.filter((a) => !existingTitles.has(a.title));
  const combined = [...toAdd, ...existing];
  saveArticles(combined);
  return combined;
}

export function getArticleById(id: string): Article | undefined {
  return getArticles().find((a) => a.id === id);
}

export async function toggleArticleImportant(id: string): Promise<Article[]> {
  const user = getUser();
  const articles = getArticles();
  const article = articles.find(a => a.id === id);
  if (!article) return articles;

  const newValue = !article.isImportant;
  article.isImportant = newValue;
  saveArticles(articles);

  if (user) {
    try {
        await axios.post(`${API_BASE}/user/progress/toggle`, {
            email: user.email,
            article_id: id,
            field: 'is_important',
            value: newValue
        });
    } catch (err) {
        console.error("Failed to sync important status");
    }
  }
  return articles;
}

export async function toggleArticleCompleted(id: string): Promise<Article[]> {
  const user = getUser();
  const articles = getArticles();
  const article = articles.find(a => a.id === id);
  if (!article) return articles;

  const newValue = !article.isCompleted;
  article.isCompleted = newValue;
  saveArticles(articles);

  if (user) {
    try {
        await axios.post(`${API_BASE}/user/progress/toggle`, {
            email: user.email,
            article_id: id,
            field: 'is_completed',
            value: newValue
        });
    } catch (err) {
        console.error("Failed to sync completed status");
    }
  }
  return articles;
}

export function clearArticles(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export async function migrateLocalArticlesToCloud(): Promise<void> {
  const articles = getArticles();
  if (articles.length === 0) return;
  try {
    for (const article of articles) {
      await axios.post(`${API_BASE}/migrate-article`, article);
    }
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Migration failed", err);
  }
}

export async function getArticlesFromCloud(): Promise<Article[]> {
  const user = getUser();
  try {
    const response = await axios.get(`${API_BASE}/articles`);
    const articles = response.data;
    
    if (user) {
      const progRes = await axios.get(`${API_BASE}/user/progress?email=${user.email}`);
      const progress = progRes.data;
      return articles.map((a: any) => ({
        ...a,
        isImportant: progress[a.id]?.is_important || false,
        isCompleted: progress[a.id]?.is_completed || false
      }));
    }
    return articles;
  } catch (err) {
    console.error("Cloud fetch failed", err);
    return getArticles();
  }
}

export function saveUser(user: any): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function getUser(): any | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
}

export function logout(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_KEY);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
