# Tea @ 3 Matching Service

AI-based matching service for pairing participants based on semantic similarity of their profiles and numeric preferences.

## What Does This Do?

This service takes participant data from Excel files, converts their free-response text into AI embeddings (vector representations), and stores them in a vector database along with numeric preference scores. This enables both semantic similarity matching and preference-based filtering for the Tea @ 3 program.

### Supported Excel Formats

- **New Simplified Format**: `id`, `type`, `name`, `free-response`, `Q1`, `Q2`, `Q3`, `ideal_match`
- **Legacy JotForm Format**: Full JotForm Excel exports (auto-detected)

## Two Modes of Operation

This service operates in two modes:

1. **Batch Processing Mode** (CLI): Process Excel files with participant data for matching
2. **API Server Mode**: Real-time API for handling new user registrations from the frontend

Most users will need **both modes**: the API server for live registrations and the CLI tools for batch matching.

## Complete Setup Guide (Local Machine)

Follow these steps to get everything running on your local machine:

### Step 1: Get API Key

You'll need a Pinecone API key:

#### Pinecone API Key (Vector Database & Embeddings)

1. Go to https://www.pinecone.io/ and sign up for a free account
2. Once logged in, go to https://app.pinecone.io/
3. Navigate to **API Keys** section
4. Copy your API key (it starts with `pcsk_`)

**Important**: Keep your API key secure! Don't share it publicly.

**Note**: This service uses Pinecone's self-hosted embedding model (`llama-text-embed-v2`), so no additional API keys are needed.

### Step 2: Install Dependencies

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
- Pinecone vector database client
- Express web server (for API mode)
- Other dependencies

### Step 3: Configure Environment Variables

1. Create a `.env` file in the `matching` folder:

```bash
# On Mac/Linux:
touch .env

# Or use any text editor to create .env file
```

2. Open the `.env` file and add your configuration:

```env
# Pinecone Configuration
PINECONE_API_KEY=your_pinecone_api_key_here
PINECONE_INDEX_NAME=tea-mate-matching
PINECONE_ENVIRONMENT=us-east-1
PINECONE_INDEX_HOST=https://your-index-host.svc.YOUR-REGION.pinecone.io
PINECONE_EMBEDDING_MODEL=multilingual-e5-large

# API Server Configuration (for live registrations)
PORT=3001
FRONTEND_URL=http://localhost:5173
NODE_ENV=development

# Optional: Logging level (debug, info, warn, error)
LOG_LEVEL=info
```

**Replace the placeholder values** with your actual Pinecone credentials:

- `PINECONE_API_KEY`: Your API key from Step 1
- `PINECONE_INDEX_HOST`: Get this from your Pinecone dashboard (under your index details)

**Note**: The `PINECONE_ENVIRONMENT` should just be the region name (e.g., `us-east-1`), not `us-east-1-aws`.

### Step 4: Build the Project

Compile TypeScript code to JavaScript:

```bash
npm run build
```

You should see no errors. If successful, you'll see a `dist/` folder with compiled JavaScript files.

### Step 5: Run API Server (for Live Registrations)

To handle real-time registrations from the frontend application:

```bash
npm run server
```

The API server will start on port 3001 (or the port specified in your `.env`).

**Expected Output**:

```
[INFO] Matching API server running on port 3001
[INFO] Environment: development
```

**Available Endpoints**:

- `GET /health` - Health check endpoint
- `POST /api/participants/upsert-vector` - Upsert a new participant's embedding

**Usage**: When a user registers on the frontend, their interests/free-response text is automatically sent to this API, which generates an embedding and stores it in Pinecone with their Firebase UID as the key.

**Testing the API**:

```bash
curl -X POST http://localhost:3001/api/participants/upsert-vector \
  -H "Content-Type: application/json" \
  -d '{"uid":"test-user-123","freeResponse":"I love hiking and reading books"}'
```

**Note**: Keep this server running while users are registering. For batch processing and matching, you can stop the server and use the CLI commands instead.

### Step 6: Verify Everything Works

Before running the full ingestion, verify your setup:

```bash
npm run verify
```

This will:

- ✅ Check if environment variables are set
- ✅ Test Pinecone Inference API connection and generate a test embedding
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
  PINECONE_ENVIRONMENT: us-east-1 (default)

=== Testing Pinecone Inference (Embeddings) ===
✓ Successfully generated embedding
  - Dimensions: 1024

=== Testing Pinecone ===
✓ Pinecone client initialized
✓ Index 'tea-mate-matching' exists

========================================
Verification Summary
========================================
Embeddings API: ✅ PASS
Pinecone DB:    ✅ PASS
```

If you see errors:

- **Embeddings API FAIL**: Check your `PINECONE_API_KEY` is correct and has access to the Inference API
- **Pinecone FAIL**: Check your `PINECONE_API_KEY` and region settings

### Step 7: Run Data Ingestion (Batch Processing)

Once verification passes, you can process your Excel file:

```bash
npm run ingest -- --file data/tea3_sample_v2.xlsx
```

Or if your file is in a different location:

```bash
npm run ingest -- --file "path/to/your/file.xlsx"
```

**What happens**:

1. Auto-detects Excel format (simplified or legacy JotForm)
2. Reads your Excel file and extracts participant data
3. Uses IDs from Excel file directly (no auto-generation)
4. Creates profile text from free-response field
5. Generates AI embeddings using Pinecone's llama-text-embed-v2 model (1024-dimensional vectors)
6. Stores embeddings + Q1/Q2/Q3 numeric values in Pinecone vector database

### Step 8: Clear Database (Optional)

To delete all stored vectors and start fresh:

```bash
npm run delete-all
```

**Expected Output**:

```
=== Starting Data Ingestion Pipeline ===
Step 1: Validating file path...
✓ File path validated
Step 2: Parsing Excel file...
Detected format: Simplified
✓ Parsed 20 participants
Step 3: Creating participant profile texts...
✓ Created 20 profile texts
Step 4: Initializing Pinecone index...
✓ Pinecone index ready
Step 5: Generating embeddings...
✓ Generated 20 embeddings
  - Embedding dimensions: 1024
Step 6: Upserting embeddings to Pinecone...
✓ Embeddings stored in Pinecone
Step 7: Checking index status...
✓ Index status: 20 total vectors

=== Data Ingestion Complete ===
Successfully processed and stored 20 participants
```

## How It Works (Technical Details)

### The Complete Pipeline

```
Excel File (Simplified or JotForm Format)
    ↓
Step 1: File Validation
    → Checks if file exists and is readable
    ↓
Step 2: Data Processing (dataProcessor.ts)
    → Auto-detects format (checks for 'id' column)
    → Parses Excel using xlsx library
    → Extracts rows into structured data
    → Validates with Zod schemas
    → Uses ID from Excel file directly
    ↓
Step 3: Text Processing (textProcessor.ts)
    → For new format: Uses free-response field
    → For legacy format: Combines interests/motivation
    → Creates profile text for embedding
    ↓
Step 4: Pinecone Index Setup (vectorService.ts)
    → Connects to Pinecone with API key
    → Creates index if it doesn't exist
    → Configures: 1024 dimensions, cosine similarity
    ↓
Step 5: Embedding Generation (embeddingService.ts)
    → Uses Pinecone SDK inference.embed() method
    → Sends profile text to llama-text-embed-v2 model
    → Receives 1024-dimensional vector
    → Processes in batches (96 at a time) for speed
    ↓
Step 6: Vector Storage (vectorService.ts)
    → Upserts embeddings to Pinecone
    → Stores with metadata:
       - participantId (from Excel)
       - name, type
       - free_response summary
       - q1, q2, q3 (numeric values)
       - ideal_match
    → Batches upserts (100 vectors per request)
    ↓
Step 7: Verification
    → Checks final index status
    → Reports total vectors stored
    ↓
Complete! Data ready for semantic and numeric matching
```

### API Server Pipeline (Live Registrations)

```
Frontend Registration Form
    ↓
POST /api/participants/upsert-vector
    → Receives: { uid: "firebase-uid", freeResponse: "user interests..." }
    ↓
Step 1: Validation (server.ts)
    → Validates uid and freeResponse
    ↓
Step 2: Embedding Generation
    → Uses Pinecone SDK inference.embed() method
    → Generates embedding from freeResponse text
    ↓
Step 3: Vector Storage (vectorService.ts)
    → Creates ParticipantData with Firebase UID as ID
    → Upserts to Pinecone with metadata
    ↓
Step 4: Response
    → Returns success confirmation to frontend
    ↓
Complete! New user's profile ready for matching
```

### Matching Pipeline (After Ingestion)

```
Pinecone (embeddings + Q1/Q2/Q3)
    ↓
1. Retrieve participants (students vs seniors)
    ↓
2. Score all pairs (student × senior)
   - FRQ similarity = cosine(embeddings) ∈ [0,1]
   - Quant similarity = 1 − SSD(Q1..Q3)/maxSSD ∈ [0,1]
   - Final = frqWeight × FRQ + quantWeight × Quant (defaults 0.7/0.3)
    ↓
3. Match with Hungarian algorithm (optimal assignment)
    ↓
4. Post‑process results
   - Confidence labels (high/medium/low)
   - Stats (avg, min, max, std dev)
    ↓
5. Export results (CSV, JSON, summary)
```

#### Scoring & Matching Details (with example)

- FRQ (free‑response) similarity: `cosine(embedding_student, embedding_senior)`
- Quant similarity (Q1–Q3): `SSD = Σ(Qi_s − Qi_t)^2`, `quant = 1 − SSD / maxSSD`
- Final score: `final = frqWeight × FRQ + quantWeight × Quant`

Example:

- FRQ = 0.76, Quant = 0.90, Weights = 0.7 / 0.3
- Final = 0.7×0.76 + 0.3×0.90 = 0.532 + 0.27 = 0.802 → high confidence (> 0.8)

The Hungarian algorithm then finds the one‑to‑one assignment that maximizes the total final score across all pairs.

### Quick Commands (Essentials)

```bash
# Build TypeScript to JavaScript
npm run build

# Verify environment and Pinecone connectivity
npm run verify

# Run API server (for live registrations from frontend)
npm run server

# Ingest your Excel file (for batch processing)
npm run ingest -- --file data/Tea3_sample_v3.xlsx

# Run matching (Hungarian algorithm)
npm run match

# Delete all vectors (start fresh)
npm run delete-all
```

### Tweaking Weights (FRQ vs Q1–Q3)

The final score is `final = frqWeight × FRQ + quantWeight × Quant` with defaults `0.7/0.3`.

- Emphasize Q1–Q3 more (often yields more high‑confidence matches if Quant similarity is strong):

```bash
  npm run match -- --frq-weight 0.3 --quant-weight 0.7
```

- Balanced influence:

```bash
  npm run match -- --frq-weight 0.5 --quant-weight 0.5
```

Notes:

- Weights must sum to 1.0.
- Confidence levels: High (>0.8), Medium (0.6–0.8), Low (≤0.6).
- If many matches are Medium, try increasing `quantWeight` or enriching free‑response text.

### Key Components Explained

#### 1. **dataProcessor.ts** - Excel File Parser

- Uses `xlsx` library to read Excel files
- Auto-detects format (simplified vs JotForm)
- Validates data with Zod schemas
- Transforms raw data into structured `ParticipantData` objects

**New Simplified Format Fields**:

- `id`: Participant ID (used directly)
- `type`: Participant type (student/teacher/etc.)
- `name`: Full name
- `free-response`: Text for embedding generation
- `Q1`, `Q2`, `Q3`: Numeric preference scores
- `ideal_match`: Preferred match ID

**Legacy JotForm Fields**: Still supported for backward compatibility

#### 2. **textProcessor.ts** - Profile Text Creator

- Uses `free-response` field for new format
- Combines interests/motivation for legacy format
- Creates unified profile string for embedding generation

**Example Output (New Format)**:

```
Profile:
About: Hikes most weekends. Boba hunts. Sci fi. Board games. Friendly, flexible schedule.
```

#### 3. **embeddingService.ts** - AI Embedding Generator

- Uses Pinecone SDK's `inference.embed()` method
- Uses `llama-text-embed-v2` model (1024 dimensions)
- Sends participant profile text
- Receives vector representation (array of 1024 numbers)
- Processes in batches of 96 for optimal performance
- Built-in error handling and retry logic

**Why Embeddings?**
Embeddings convert text into numerical vectors that capture meaning. Similar profiles produce similar vectors, enabling semantic similarity matching.

#### 4. **vectorService.ts** - Pinecone Database Manager

- Manages connection to Pinecone vector database
- Creates index with specifications:
  - **Dimensions**: 1024 (matches llama-text-embed-v2 embeddings)
  - **Metric**: Cosine similarity (measures angle between vectors)
  - **Type**: Serverless (cloud-hosted)
- Upserts embeddings with comprehensive metadata
- Stores both semantic vectors and numeric preferences

**Stored Metadata**:

```javascript
{
  name: "Participant Name",
  type: "student",
  free_response: "Hikes most weekends...", // First 200 chars
  q1: 3,    // Numeric preference
  q2: 8,    // Numeric preference
  q3: 9,    // Numeric preference
  ideal_match: "S1"
}
```

#### 5. **server.ts** - API Server (Live Registrations)

- Express web server for handling real-time registrations
- Exposes REST API endpoint for frontend integration
- Generates embeddings using Pinecone SDK
- Stores vectors with Firebase UID as the key
- Handles authentication and validation

**API Endpoints**:

- `POST /api/participants/upsert-vector`: Create/update participant embedding
- `GET /health`: Server health check

#### 6. **verifySetup.ts** - Setup Verification

- Tests Pinecone SDK connection and embedding generation
- Tests Pinecone database access and index status
- Reports detailed status of each component
- Helps identify configuration issues early

#### 7. **deleteAllVectors.ts** - Database Cleanup

- Deletes all vectors from the Pinecone index
- Shows before/after statistics
- Useful for testing and data refresh

### What Gets Stored in Pinecone?

For each participant, we store:

**Vector (Embedding)**:

- 1024 numbers representing the semantic meaning of their profile
- Used for similarity calculations

**Metadata**:

- `name`: Participant's full name
- `type`: Participant type (student/teacher/etc.)
- `free_response`: First 200 characters of free-response text
- `q1`, `q2`, `q3`: Numeric preference scores
- `ideal_match`: Preferred match ID

**ID**:

- Uses exact ID from Excel file (e.g., "T1", "S1") for batch processing
- Uses Firebase UID for live registrations from frontend

## Project Structure

```
matching/
├── src/
│   ├── index.ts                 # Main CLI entry point
│   ├── server.ts                # API server for live registrations
│   ├── config/
│   │   └── pinecone.config.ts   # Pinecone client setup
│   ├── services/
│   │   ├── dataProcessor.ts     # Excel parsing & validation (auto-detect format)
│   │   ├── embeddingService.ts  # Pinecone SDK integration
│   │   └── vectorService.ts     # Pinecone operations
│   ├── utils/
│   │   ├── textProcessor.ts    # Create profile texts
│   │   ├── validator.ts         # Zod validation schemas (new + legacy)
│   │   └── logger.ts            # Logging utility
│   └── scripts/
│       ├── ingestData.ts        # Main ingestion pipeline
│       ├── verifySetup.ts       # Setup verification
│       └── deleteAllVectors.ts  # Database cleanup
├── data/
│   └── tea3_sample_v2.xlsx      # New simplified format sample
├── dist/                         # Compiled JavaScript
├── package.json                   # Dependencies & scripts
├── tsconfig.json                  # TypeScript config (optimized)
├── .env                           # Your API keys (create this)
└── README.md                      # This file
```

## Available Commands

```bash
# Build TypeScript to JavaScript
npm run build

# Clean build (no cache)
npm run build:clean

# Run API server for live registrations
npm run server

# Run API server in dev mode (rebuild + start)
npm run server:dev

# Verify setup (test API keys and connections)
npm run verify

# Run data ingestion (batch processing)
npm run ingest -- --file data/tea3_sample_v2.xlsx

# Run matching algorithm
npm run match

# Delete all vectors from database
npm run delete-all

# Development mode with auto-rebuild
npm run dev
npm run dev:fast
```

## Technologies Used

- **TypeScript**: Type-safe development
- **Express**: Web server framework for API mode
- **xlsx (SheetJS)**: Excel file parsing
- **Zod**: Runtime data validation
- **@pinecone-database/pinecone**: Pinecone vector database and Inference API
- **dotenv**: Environment variable management

## Getting Help

- **Pinecone Docs**: https://docs.pinecone.io/
- **Pinecone Inference API**: https://docs.pinecone.io/reference/api/2025-10/inference/generate-embeddings
- **Pinecone Models**: https://docs.pinecone.io/models/llama-text-embed-v2
- **Pinecone Dashboard**: https://app.pinecone.io/
