/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PINECONE_API_KEY?: string;
  readonly VITE_PINECONE_INDEX_HOST?: string;
  readonly VITE_PINECONE_EMBEDDING_MODEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
