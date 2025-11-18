import express from 'express';
import 'dotenv/config';
import { getPairConfidenceScore } from '../matching/src/services/matchingService.ts';
import { fetchParticipantsByIds } from '../matching/src/services/participantRetrieval.ts';
import { logger } from '../matching/src/utils/logger.ts';


const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/api/confidence-score', async (req, res) => {
  const participantIdAParam = String(req.query.participantIdA);
  const participantIdBParam = String(req.query.participantIdB);
  logger.info('GET /api/confidence-score', { participantIdAParam, participantIdBParam });

  if (typeof participantIdAParam !== 'string' || typeof participantIdBParam !== 'string') {
    return res.status(400).json({ error: 'Invalid participant IDs' });
  }

  //get confidence score
  try {
    const score = await getPairConfidenceScore(participantIdAParam, participantIdBParam);
    res.json({ score });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /not found|missing/i.test(message) ? 404 : 500;
    res.status(status).json({ error: message });

  }
});

app.get('/api/low-similarity-matches', async (req, res) => {
  logger.info('GET /api/low-similarity-matches', req.query);

    try {
    const similarityThreshold = Number(req.query.threshold) || 0.8;
    const matchesCollection = String(req.query.collection) || 'matches';

    const { default: db } = await import('../matching/src/config/firebaseAdmin.ts');

    const firestoreDb = db.firestore();

    // Get all matches, then filter in memory
    const snapshot = await firestoreDb
      .collection(matchesCollection)
      .get();

    const lowSimilarityMatches = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          participant1_id: data.participant1_id,
          participant2_id: data.participant2_id,
          similarity: data.similarity,
          day_of_call: data.day_of_call || null,
        };
      })
      .filter(match => match.similarity < similarityThreshold);

    logger.info('GET /api/low-similarity-matches', { message: `Filtered to ${lowSimilarityMatches.length} low similarity matches` });

    const participantIdsNeedingRematch = new Set<string>();
    lowSimilarityMatches.forEach((match) => {
      // Clean IDs here - trim whitespace and newlines
      participantIdsNeedingRematch.add(match.participant1_id.trim());
      participantIdsNeedingRematch.add(match.participant2_id.trim());
    });

    res.json({
      threshold: similarityThreshold,
      totalLowSimilarityMatches: lowSimilarityMatches.length,
      matches: lowSimilarityMatches,
      participantIds: Array.from(participantIdsNeedingRematch),
    });
  } catch (error) {
    logger.error('GET /api/low-similarity-matches', { error });
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({
      error: 'Failed to fetch low similarity matches',
      details: message,
    });
  }
});

app.post('/api/participants', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Invalid ids array' });
    }

    // Clean IDs
    const cleanIds = ids.map((id: string) => id.trim());

    // Get participants from Pinecone (includes type and metadata)
    const participants = await fetchParticipantsByIds(cleanIds);
    
    // Add dummy names
    const participantsWithDummyNames = participants.map((p, idx) => ({
      ...p,
      name: `${p.type === 'student' ? 'Student' : 'Senior'} ${idx + 1}`,
    }));

    logger.info('POST /api/participants', { message: 'Returning participants', data: participantsWithDummyNames });
    res.json(participantsWithDummyNames);
  } catch (error) {
    logger.error('POST /api/participants', { error });
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).json({ error: message });
  }
});
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
