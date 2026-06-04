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
}

const STORAGE_KEY = "upsc_hub_articles";

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
  // Deduplicate by title
  const existingTitles = new Set(existing.map((a) => a.title));
  const toAdd = newArticles.filter((a) => !existingTitles.has(a.title));
  const combined = [...toAdd, ...existing];
  saveArticles(combined);
  return combined;
}

export function getArticleById(id: string): Article | undefined {
  return getArticles().find((a) => a.id === id);
}

export function clearArticles(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(STORAGE_KEY);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
article.isCompleted = newValue;
saveArticles(articles);

// Sync with Cloud
try {
  await axios.post(`${API_BASE}/user/progress/toggle`, {
    email: user.email,
    article_id: id,
    field: 'is_completed',
    value: newValue
  });
} catch (err) {
  console.error("Failed to sync status to cloud");
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

  console.log(`Migrating ${articles.length} tactical assets to cloud...`);
  try {
    // Send all local articles to the backend for archival
    for (const article of articles) {
      await axios.post(`${API_BASE}/migrate-article`, article);
    }
    // Once successfully synced, we can clear local storage
    localStorage.removeItem(STORAGE_KEY);
    console.log("Migration Successful.");
  } catch (err) {
    console.error("Migration failed, will retry next session.", err);
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}
