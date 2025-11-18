const PINECONE_API_KEY = import.meta.env.VITE_PINECONE_API_KEY;
const PINECONE_INDEX_HOST = import.meta.env.VITE_PINECONE_INDEX_HOST;
const PINECONE_EMBEDDING_MODEL =
  import.meta.env.VITE_PINECONE_EMBEDDING_MODEL ?? "llama-text-embed-v2";

const INFERENCE_URL = "https://api.pinecone.io/v1/inference/embed";

class PineconeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PineconeConfigError";
  }
}

function assertConfig() {
  if (!PINECONE_API_KEY) {
    throw new PineconeConfigError("Missing VITE_PINECONE_API_KEY");
  }
  if (!PINECONE_INDEX_HOST) {
    throw new PineconeConfigError("Missing VITE_PINECONE_INDEX_HOST");
  }
}

async function callPinecone<T>(
  url: string,
  body: unknown,
  useApiKeyHeader: boolean = false
): Promise<T> {
  assertConfig();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Pinecone REST API uses Api-Key header, Inference API uses Authorization Bearer
  if (useApiKeyHeader) {
    headers["Api-Key"] = PINECONE_API_KEY!;
  } else {
    headers["Authorization"] = `Bearer ${PINECONE_API_KEY!}`;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Pinecone request failed: ${response.status} ${errorBody}`);
  }

  return response.json() as Promise<T>;
}

type EmbeddingResponse = {
  data?: Array<{ values?: number[] }>;
  [key: string]: unknown;
};

async function generateEmbedding(text: string): Promise<number[]> {
  const cleaned = text.trim();
  if (!cleaned) {
    throw new Error("Cannot embed empty text");
  }

  const result = await callPinecone<EmbeddingResponse>(INFERENCE_URL, {
    model: PINECONE_EMBEDDING_MODEL,
    inputs: [cleaned],
    parameters: {
      inputType: "passage",
      truncate: "END",
    },
  });

  // Handle different response formats
  let embedding: number[] | undefined;
  if (result.data?.[0]?.values) {
    embedding = result.data[0].values;
  } else if (Array.isArray(result)) {
    const firstItem = result[0] as { values?: number[] } | undefined;
    embedding = firstItem?.values;
  }

  if (!embedding || embedding.length === 0) {
    throw new Error("Pinecone returned an empty embedding");
  }

  return embedding;
}

async function upsertEmbedding(
  uid: string,
  embedding: number[],
  freeResponse: string
) {
  await callPinecone(
    `${PINECONE_INDEX_HOST}/vectors/upsert`,
    {
      vectors: [
        {
          id: uid,
          values: embedding,
          metadata: {
            free_response: freeResponse.trim().slice(0, 2000),
          },
        },
      ],
    },
    true // Use Api-Key header for REST API
  );
}

export async function upsertUserFreeResponse(
  uid: string,
  freeResponse: string
) {
  const text = freeResponse?.trim();
  if (!text) {
    return;
  }

  const embedding = await generateEmbedding(text);
  await upsertEmbedding(uid, embedding, text);
}
