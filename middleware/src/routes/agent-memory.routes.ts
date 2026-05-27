/**
 * agent-memory.routes.ts — per-user AI agent memory store
 *
 * Fixed: missing GET /:id route — the UI and Java backend both support
 * fetching a single memory by ID, but no middleware route existed for it,
 * causing 404s on any direct memory fetch.
 *
 * Added: agentmemory direct daemon synchronization for local AI persistence.
 */
import express from 'express';
import { authGuard } from '../authGuard.js';
import axios from 'axios';
import { createJavaRouteProxy } from '../services/backendProxy.js';

const router = express.Router();
const AGENT_MEMORY_URL = process.env.AGENTMEMORY_URL || 'http://localhost:3111';
const javaProxy = createJavaRouteProxy('/agent-memory');

// Middleware to sync with local agentmemory daemon
const syncWithAgentMemoryDaemon = async (req: express.Request, _res: express.Response, next: express.NextFunction) => {
  try {
    const content = req.body.content || req.body.text || req.body.memory;
    const category = req.body.category || req.body.type || 'other';
    if (content) {
      await axios.post(`${AGENT_MEMORY_URL}/agentmemory/save`, {
        content,
        text: content,
        tags: [category],
        category
      }, { timeout: 1500 }).catch(() => {});
    }
  } catch (error) {
    // Best effort: do not block Java flow
  }
  next();
};

// GET /api/agent-memory/search       → semantic search in agentmemory local daemon
router.get('/search', authGuard, async (req, res) => {
  try {
    const query = req.query.query;
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    const response = await axios.post(`${AGENT_MEMORY_URL}/agentmemory/smart-search`, { query }, { timeout: 3000 });
    return res.json(response.data);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: 'Local agentmemory daemon not reachable or failed', details: msg });
  }
});

// GET    /api/agent-memory              → list memories (?category= filter supported)
router.get('/',              authGuard, javaProxy);

// POST   /api/agent-memory              → upsert memory entry
router.post('/',             authGuard, syncWithAgentMemoryDaemon, javaProxy);

// GET    /api/agent-memory/:id          → fetch single memory by ID
router.get('/:id',           authGuard, javaProxy);

// PATCH  /api/agent-memory/:id/toggle   → enable/disable a memory entry
router.patch('/:id/toggle',  authGuard, javaProxy);

// PUT    /api/agent-memory/:id          → update memory content
router.put('/:id',           authGuard, syncWithAgentMemoryDaemon, javaProxy);

// DELETE /api/agent-memory/:id          → delete a memory entry
router.delete('/:id',        authGuard, javaProxy);

export default router;

