# For All Ages - Setup Guide

### Cloning the repository:

- On the `Code` tab on GitHub, click the green code button and copy the url shown.
- Then, in your preferred folder (wherever you want the project to be), run `git clone <url>` with the copied url
- Change directories into the project folder with `cd` and then run the following commands:

```
npm install
npm run dev
```

You should get a localhost link that can be pasted into your browser to display the app.

### Pinecone Setup (Frontend)

To upsert new participants to Pinecone when they register, create a `.env` (or `.env.local`) file in the project root with:

```
VITE_PINECONE_API_KEY=your_pinecone_api_key
VITE_PINECONE_INDEX_HOST=https://your-index-host.svc.YOUR-REGION.pinecone.io
VITE_PINECONE_EMBEDDING_MODEL=llama-text-embed-v2
```

> **Note:** Supplying the API key in frontend code exposes it to end users. Only follow this approach if your team is comfortable with that trade-off.
