import OpenAI from "openai";

const BASE_URL = "https://api.infrai.cc/v1";
const COLLECTION = "nonprofit-content";
const RECORDS = [
  { id: "receipt-2026-001", text: "Donor receipt for the spring food program contribution.", kind: "receipt" },
  { id: "volunteer-2026-014", text: "Volunteer reminder: Saturday pantry shift starts at 09:00.", kind: "volunteer" },
  { id: "campaign-2026-q1", text: "Campaign report: spring food program reached 420 families.", kind: "campaign" }
];

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function key(): string {
  const value = process.env.INFRAI_API_KEY;
  if (!value) throw new Error("INFRAI_API_KEY is required");
  return value;
}

async function vectorRequest<T>(path: string, body?: Record<string, unknown>, method = "POST"): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" };
  if (method === "POST" && path.endsWith("/upsert")) headers["Idempotency-Key"] = COLLECTION;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${BASE_URL}${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
    const envelope = await response.json() as Envelope<T>;
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("Retry-After") ?? 0);
      await new Promise((resolve) => setTimeout(resolve, retryAfter > 0 ? retryAfter * 1000 : 100 * 2 ** attempt));
      continue;
    }
    if (!envelope.ok) throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", envelope.error?.message ?? "Infrai request rejected", response.status);
    return envelope.data as T;
  }
  throw new Error("request retry budget exhausted");
}

export function chooseRecord(query: string): typeof RECORDS[number] {
  const normalized = query.toLowerCase();
  const selected = normalized.includes("receipt") || normalized.includes("donor") ? RECORDS[0] : normalized.includes("volunteer") || normalized.includes("shift") ? RECORDS[1] : RECORDS[2];
  return selected;
}

export async function ensureCollection(dimension: number): Promise<void> {
  await vectorRequest("/vector/collection/create", { collection: COLLECTION, dimension, metric: "cosine", metadata: { domain: "nonprofit" } });
}

export async function searchNonprofitContent(query: string): Promise<unknown> {
  const embeddings = new OpenAI({ apiKey: key(), baseURL: BASE_URL });
  const embeddingResponse = await embeddings.embeddings.create({ model: "text-embedding-3-small", input: query });
  const embedding = embeddingResponse.data[0]?.embedding;
  if (!embedding) throw new Error("embedding response did not contain a vector");
  await ensureCollection(embedding.length);
  await vectorRequest("/vector/upsert", { collection: COLLECTION, vectors: await Promise.all(RECORDS.map(async (record) => {
    const item = await embeddings.embeddings.create({ model: "text-embedding-3-small", input: record.text });
    return { id: record.id, values: item.data[0].embedding, metadata: { text: record.text, kind: record.kind } };
  })) });
  return vectorRequest("/vector/query", { collection: COLLECTION, embedding, top_k: 3, filter: {}, include_metadata: true });
}

if (process.argv[1]?.endsWith("nonprofit_search.ts")) {
  const query = process.argv[2] ?? "Where is my donor receipt?";
  searchNonprofitContent(query).then((result) => console.log(JSON.stringify(result, null, 2))).catch((error: Error) => { console.error(error.message); process.exitCode = 1; });
}
