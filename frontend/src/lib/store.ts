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

export interface User {
  name: string;
  email: string;
  isLoggedIn: boolean;
}

export interface Article {
  id: string;
  title: string;
  source?: string;
  category: string;
  gs_paper: string;
  relevance_score: number;
  tags?: string[];
  keywords?: string[];
  primary_keyword?: string;
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

import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8005";
const STORAGE_KEY = "upsc_hub_articles";
const AUTH_KEY = "upsc_hub_user";

export function getUser(): User | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_KEY);
  return raw ? JSON.parse(raw) : null;
}

// Unified Security Header Helper
const getAuthHeaders = () => {
    const user = getUser();
    return user ? { headers: { "X-Officer-Email": user.email } } : {};
};

export function saveUser(user: User): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(AUTH_KEY, JSON.stringify(user));
}

export function logout(): void {
  localStorage.removeItem(AUTH_KEY);
}

// Global Feed Sync
export const getArticlesFromCloud = async (): Promise<Article[]> => {
    try {
        const response = await axios.get(`${API_BASE}/articles`);
        const articles = response.data;

        if (Array.isArray(articles)) {
            // Save to local cache so detail pages can find them
            localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
            
            // Fetch User Progress if logged in
            const user = getUser();
            if (user) {
                try {
                   const progResp = await axios.get(`${API_BASE}/user/progress?email=${user.email}`, getAuthHeaders());
                   const progress = progResp.data;
                   
                   return articles.map((a: Article) => ({
                       ...a,
                       isImportant: progress[a.id]?.is_important || false,
                       isCompleted: progress[a.id]?.is_completed || false
                   }));
                } catch (pErr) {
                    console.error("Progress sync failed", pErr);
                }
            }
            return articles;
        }
        return getArticles();
    } catch (err) {
        console.error("Cloud Sync Failed, falling back to local cache", err);
        return getArticles(); // Fallback
    }
};

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
  const existingId = new Set(existing.map((a) => a.id));
  const toAdd = newArticles.filter((a) => !existingId.has(a.id));
  const combined = [...toAdd, ...existing];
  saveArticles(combined);
  return combined;
}

export function getArticleById(id: string): Article | undefined {
  const articles = getArticles();
  return articles.find((a) => a.id === id);
}

export async function toggleArticleImportant(id: string): Promise<Article[]> {
  const user = getUser();
  if (!user) return getArticles();

  const articles = getArticles();
  const article = articles.find(a => a.id === id);
  if (!article) return articles;

  const newValue = !article.isImportant;
  
  // Update UI immediately (Optimistic)
  article.isImportant = newValue;
  saveArticles(articles);

  // Sync with Cloud
  try {
      await axios.post(`${API_BASE}/user/progress/toggle`, {
          email: user.email,
          article_id: id,
          field: 'is_important',
          value: newValue
      }, getAuthHeaders());
  } catch (err) {
      console.error("Failed to sync status to cloud");
  }
  return getArticles();
}

export async function toggleArticleCompleted(id: string): Promise<Article[]> {
  const user = getUser();
  if (!user) return getArticles();

  const articles = getArticles();
  const article = articles.find(a => a.id === id);
  if (!article) return articles;

  const newValue = !article.isCompleted;
  
  // Update UI immediately (Optimistic)
  article.isCompleted = newValue;
  saveArticles(articles);

  // Sync with Cloud
  try {
      await axios.post(`${API_BASE}/user/progress/toggle`, {
          email: user.email,
          article_id: id,
          field: 'is_completed',
          value: newValue
      }, getAuthHeaders());
  } catch (err) {
      console.error("Failed to sync status to cloud");
  }
  return getArticles();
}

export function clearArticles(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export async function migrateLocalArticlesToCloud(): Promise<void> {
  const user = getUser();
  const articles = getArticles();
  if (articles.length === 0 || !user) return;

  console.log(`Migrating ${articles.length} articles to cloud for ${user.email}...`);
  try {
      // allSettled: one bad article won't abort the whole batch
      const results = await Promise.allSettled(
        articles.map(article =>
          axios.post(`${API_BASE}/migrate-article`, article, getAuthHeaders())
        )
      );

      const failed = results.filter(r => r.status === "rejected");
      if (failed.length === 0) {
          // Only purge local cache if everything made it to cloud
          localStorage.removeItem(STORAGE_KEY);
          console.log("Migration fully successful. Local cache cleared.");
      } else {
          console.warn(`Migration: ${articles.length - failed.length} ok, ${failed.length} failed.`);
      }
  } catch (err) {
      console.error("Migration error", err);
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
