# Tea @ 3 Matching Service

AI-based matching service for pairing college students ("Young") with older adults ("Older") based on semantic similarity of their interests, motivations, and preferences.

## What Does This Do?

This service takes participant data from Excel files, converts their profiles into AI embeddings (vector representations), and stores them in a vector database. This allows us to find participants with similar interests and motivations for the Tea @ 3 program.

## Complete Setup Guide (Local Machine)

Follow these steps to get everything running on your local machine:

### Step 1: Prerequisites

Make sure you have installed:
- **Node.js 18+** ([Download here](https://nodejs.org/))
- **npm** (comes with Node.js)

Verify installation:
```bash
node --version  # Should show v18 or higher
npm --version   # Should show 9 or higher
```

### Step 2: Get API Keys

You'll need two API keys:

#### A. Pinecone API Key (Vector Database)

1. Go to https://www.pinecone.io/ and sign up for a free account
2. Once logged in, go to https://app.pinecone.io/
3. Navigate to **API Keys** section
4. Copy your API key (it starts with `pcsk_`)

#### B. Gemini API Key (AI Embeddings)

1. Go to https://aistudio.google.com/apikey
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the API key (it's a long string, different format from Pinecone)

**Important**: Keep these keys secure! Don't share them publicly.

### Step 3: Install Dependencies

1. Navigate to the matching folder:
```bash
cd for-all-ages/matching
```

2. Install all required packages:
```bash
npm install
```

This installs:
- TypeScript compiler
- Excel file parser (xlsx)
- Google Gemini API client
- Pinecone vector database client
- Other dependencies

### Step 4: Configure Environment Variables

1. Create a `.env` file in the `matching` folder:
```bash
# On Mac/Linux:
touch .env

# Or use any text editor to create .env file
```

2. Open the `.env` file and add your API keys:
```env
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=tea-mate-matching
PINECONE_ENVIRONMENT=us-east-1

# Gemini API Configuration  
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: Logging level (debug, info, warn, error)
LOG_LEVEL=info
```

**Replace the placeholder values** with your actual API keys from Step 2.

**Note**: The `PINECONE_ENVIRONMENT` should just be the region name (e.g., `us-east-1`), not `us-east-1-aws`.

### Step 5: Build the Project

Compile TypeScript code to JavaScript:
```bash
npm run build
```

You should see no errors. If successful, you'll see a `dist/` folder with compiled JavaScript files.

### Step 6: Verify Everything Works

Before running the full ingestion, verify your setup:

```bash
npm run verify
```

This will:
- ✅ Check if environment variables are set
- ✅ Test Gemini API connection and generate a test embedding
- ✅ Test Pinecone connection and check/create the index
- ✅ Report any issues

**Expected Output** (if everything works):
```
========================================
Tea @ 3 Matching Service - Setup Verification
========================================

=== Environment Variables ===
  PINECONE_API_KEY: ✓ Set
  PINECONE_INDEX_NAME: tea-mate-matching
  GEMINI_API_KEY: ✓ Set

=== Testing Gemini API ===
✓ Successfully generated embedding
  - Dimensions: 768

=== Testing Pinecone ===
✓ Pinecone client initialized
✓ Index 'tea-mate-matching' exists

========================================
Verification Summary
========================================
Gemini API:     ✅ PASS
Pinecone DB:    ✅ PASS
```

If you see errors:
- **Gemini API FAIL**: Check your `GEMINI_API_KEY` is correct (get it from https://aistudio.google.com/apikey)
- **Pinecone FAIL**: Check your `PINECONE_API_KEY` and region settings

### Step 7: Run Data Ingestion

Once verification passes, you can process your Excel file:

```bash
npm run ingest -- --file data/Tea@3\ JotForm\ Examples.xlsx
```

Or if your file is in a different location:
```bash
npm run ingest -- --file "path/to/your/file.xlsx"
```

**What happens**:
1. Reads your Excel file
2. Parses participant data
3. Creates profile texts from interests and motivations
4. Generates AI embeddings (768-dimensional vectors)
5. Stores everything in Pinecone vector database

**Expected Output**:
```
=== Starting Data Ingestion Pipeline ===
Step 1: Validating file path...
✓ File path validated
Step 2: Parsing Excel file...
✓ Parsed 8 participants
  - Young: 0
  - Older: 8
Step 3: Creating participant profile texts...
✓ Created 8 profile texts
Step 4: Initializing Pinecone index...
✓ Pinecone index ready
Step 5: Generating embeddings...
✓ Generated 8 embeddings
  - Embedding dimensions: 768
Step 6: Upserting embeddings to Pinecone...
✓ Embeddings stored in Pinecone
Step 7: Checking index status...
✓ Index status: 8 total vectors

=== Data Ingestion Complete ===
Successfully processed and stored 8 participants
```

## How It Works (Technical Details)

### The Complete Pipeline

```
Excel File (JotForm Export)
    ↓
Step 1: File Validation
    → Checks if file exists and is readable
    ↓
Step 2: Data Processing (dataProcessor.ts)
    → Parses Excel using xlsx library
    → Extracts rows into structured data
    → Validates with Zod schemas
    → Separates "Young" (Y) vs "Older" (O) participants
    ↓
Step 3: Text Processing (textProcessor.ts)
    → Combines participant fields into structured text:
      "Profile:
       Interests and About Me: [interests]
       Motivation: [why interested]
       Language: [language preference]
       Tea Preference: [tea type]
       College: [if student]"
    ↓
Step 4: Pinecone Index Setup (vectorService.ts)
    → Connects to Pinecone with API key
    → Creates index if it doesn't exist
    → Configures: 768 dimensions, cosine similarity
    ↓
Step 5: Embedding Generation (embeddingService.ts)
    → Calls Gemini API (text-embedding-004 model)
    → Sends participant profile text
    → Receives 768-dimensional vector
    → Processes in batches (10 at a time) with delays
    → Handles rate limits automatically
    ↓
Step 6: Vector Storage (vectorService.ts)
    → Upserts embeddings to Pinecone
    → Stores with metadata:
       - participantId
       - name, type, email
       - interests summary
    → Batches upserts (100 vectors per request)
    ↓
Step 7: Verification
    → Checks final index status
    → Reports total vectors stored
    ↓
Complete! Data ready for matching queries
```

### Key Components Explained

#### 1. **dataProcessor.ts** - Excel File Parser
- Uses `xlsx` library to read Excel files
- Handles JotForm's specific column structure (26 columns)
- Validates data with Zod schemas
- Transforms raw data into structured `ParticipantData` objects

**Key Fields Extracted**:
- `Young or Older`: "Y" or "O"
- `Full Name`, `E-mail`, `Phone Number`
- `Tell us about you! Include any interests...`: Main matching field
- `Please tell us why you are interested...`: Motivation
- `What language do you use for casual conversation?`: Language
- `What type of tea do you prefer?`: Tea preference

#### 2. **textProcessor.ts** - Profile Text Creator
- Combines matching-relevant fields into structured text
- Creates a unified profile string for each participant
- This text becomes the input for embedding generation

**Example Output**:
```
Profile:
Interests and About Me: I am a retired attorney. I enjoy traveling, gardening...
Motivation: I was paired with an international student this past year...
Language: English
Tea Preference: Variety
```

#### 3. **embeddingService.ts** - AI Embedding Generator
- Connects to Google's Gemini API
- Uses `text-embedding-004` model (768 dimensions)
- Sends participant profile text
- Receives vector representation (array of 768 numbers)
- Each number represents a semantic feature
- Implements rate limiting (batches of 10, 500ms delay)
- Auto-retries on rate limit errors

**Why Embeddings?**
Embeddings convert text into numerical vectors that capture meaning. Similar interests produce similar vectors, enabling similarity search.

#### 4. **vectorService.ts** - Pinecone Database Manager
- Manages connection to Pinecone vector database
- Creates index with specifications:
  - **Dimensions**: 768 (matches Gemini embeddings)
  - **Metric**: Cosine similarity (measures angle between vectors)
  - **Type**: Serverless (cloud-hosted)
- Upserts embeddings with metadata
- Stores participant info for future matching queries

#### 5. **verifySetup.ts** - Setup Verification
- Tests Gemini API by generating a test embedding
- Tests Pinecone connection and index access
- Reports detailed status of each component
- Helps identify configuration issues early

### What Gets Stored in Pinecone?

For each participant, we store:

**Vector (Embedding)**:
- 768 numbers representing the semantic meaning of their profile
- Used for similarity calculations

**Metadata**:
- `name`: Participant's full name
- `type`: "young" or "older" (for filtering matches)
- `email`: Contact email
- `interests_summary`: First 100 characters of interests

**ID**:
- Unique identifier (usually based on email or name)

## Project Structure

```
matching/
├── src/
│   ├── index.ts                 # Main CLI entry point
│   ├── config/
│   │   └── pinecone.config.ts   # Pinecone client setup
│   ├── services/
│   │   ├── dataProcessor.ts     # Excel parsing & validation
│   │   ├── embeddingService.ts  # Gemini API integration
│   │   └── vectorService.ts     # Pinecone operations
│   ├── utils/
│   │   ├── textProcessor.ts    # Create profile texts
│   │   ├── validator.ts         # Zod validation schemas
│   │   └── logger.ts            # Logging utility
│   └── scripts/
│       ├── ingestData.ts        # Main ingestion pipeline
│       └── verifySetup.ts       # Setup verification
├── data/
│   └── Tea@3 JotForm Examples.xlsx  # Sample Excel file
├── dist/                         # Compiled JavaScript
├── package.json                   # Dependencies
├── tsconfig.json                  # TypeScript config
├── .env                           # Your API keys (create this)
└── README.md                      # This file
```

## Available Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Verify setup (test API keys and connections)
npm run verify

# Run data ingestion
npm run ingest -- --file data/Tea@3\ JotForm\ Examples.xlsx

# Development mode (watch for changes)
npm run dev
```

## Troubleshooting

### "XLSX.readFile is not a function"
✅ **Fixed!** This was an import issue. Make sure you're using the latest code.

### "GEMINI_API_KEY not set"
- Create a `.env` file in the `matching` folder
- Add your Gemini API key from https://aistudio.google.com/apikey
- Make sure it's the actual Gemini key, not a Pinecone key

### "PINECONE_API_KEY not set"
- Add your Pinecone API key to `.env`
- Get it from https://app.pinecone.io/

### "API key not valid" for Gemini
- Your Gemini key might be incorrect
- Get a fresh key from https://aistudio.google.com/apikey
- Make sure it's a Gemini key (long string), not a Pinecone key (starts with `pcsk_`)

### "404 error" when creating Pinecone index
- Check your `PINECONE_ENVIRONMENT` in `.env` - should be just the region (e.g., `us-east-1`)
- Or create the index manually in Pinecone dashboard:
  - Name: `tea-mate-matching`
  - Dimensions: `768`
  - Metric: `cosine`

### "File not found"
- Check the file path is correct
- Use quotes if path has spaces: `"data/Tea@3 JotForm Examples.xlsx"`
- Use absolute path if needed: `/full/path/to/file.xlsx`

### Embedding generation fails
- Check your Gemini API key is valid
- Check your internet connection
- The service will auto-retry on rate limits

## What's Next?

After successful ingestion, your data is stored in Pinecone. Future phases will include:

- **Similarity Search**: Find participants with similar interests
- **Matching Algorithm**: Pair "Young" with "Older" based on similarity scores
- **Frontend Integration**: Connect to React app for admin dashboard
- **Cloud Database**: Migrate from Excel to Firestore/PostgreSQL

## Technologies Used

- **TypeScript**: Type-safe development
- **xlsx (SheetJS)**: Excel file parsing
- **Zod**: Runtime data validation
- **@google/generative-ai**: Google Gemini API client
- **@pinecone-database/pinecone**: Pinecone vector database
- **dotenv**: Environment variable management

## Getting Help

- **Gemini API Docs**: https://ai.google.dev/docs
- **Pinecone Docs**: https://docs.pinecone.io/
- **Pinecone Dashboard**: https://app.pinecone.io/
- **Gemini API Key**: https://aistudio.google.com/apikey

## License

Part of the Tea @ 3 program by For All Ages.
