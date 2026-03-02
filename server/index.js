require('dotenv').config();
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const URI = process.env.REACT_APP_MONGODB_URI || process.env.MONGODB_URI || process.env.REACT_APP_MONGO_URI;
const DB = 'chatapp';

let db;

async function connect() {
  const client = await MongoClient.connect(URI);
  db = client.db(DB);
  console.log('MongoDB connected');
}

// Return 503 for /api when DB is not connected (so proxy gets a response instead of ECONNREFUSED)
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/youtube')) return next(); // YouTube endpoint does not need DB
  if (!db) {
    return res.status(503).json({
      error: 'Database unavailable. Check MongoDB connection and REACT_APP_MONGODB_URI in .env.',
    });
  }
  next();
});

app.get('/', (req, res) => {
  res.send(`
    <html>
      <body style="font-family:sans-serif;padding:2rem;background:#00356b;color:white;min-height:100vh;display:flex;align-items:center;justify-content:center;margin:0">
        <div style="text-align:center">
          <h1>Chat API Server</h1>
          <p>Backend is running. Use the React app at <a href="http://localhost:3000" style="color:#ffd700">localhost:3000</a></p>
          <p><a href="/api/status" style="color:#ffd700">Check DB status</a></p>
        </div>
      </body>
    </html>
  `);
});

app.get('/api/status', async (req, res) => {
  try {
    const usersCount = await db.collection('users').countDocuments();
    const sessionsCount = await db.collection('sessions').countDocuments();
    res.json({ usersCount, sessionsCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Users ────────────────────────────────────────────────────────────────────

app.post('/api/users', async (req, res) => {
  try {
    const { username, password, email, firstName, lastName } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = String(username).trim().toLowerCase();
    const existing = await db.collection('users').findOne({ username: name });
    if (existing) return res.status(400).json({ error: 'Username already exists' });
    const hashed = await bcrypt.hash(password, 10);
    await db.collection('users').insertOne({
      username: name,
      password: hashed,
      email: email ? String(email).trim().toLowerCase() : null,
      firstName: firstName ? String(firstName).trim() : null,
      lastName: lastName ? String(lastName).trim() : null,
      createdAt: new Date().toISOString(),
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ error: 'Username and password required' });
    const name = username.trim().toLowerCase();
    const user = await db.collection('users').findOne({ username: name });
    if (!user) return res.status(401).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password' });
    res.json({
      ok: true,
      username: name,
      firstName: user.firstName || null,
      lastName: user.lastName || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/users/profile', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const name = String(username).trim().toLowerCase();
    const user = await db.collection('users').findOne(
      { username: name },
      { projection: { firstName: 1, lastName: 1 } }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      firstName: user.firstName || null,
      lastName: user.lastName || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── YouTube Channel Data ─────────────────────────────────────────────────────
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || process.env.REACT_APP_YOUTUBE_API_KEY;
const { fetchChannelData } = require('./youtubeService');

app.post('/api/youtube/channel-data', async (req, res) => {
  if (!YOUTUBE_API_KEY) {
    return res.status(500).json({ error: 'YOUTUBE_API_KEY (or REACT_APP_YOUTUBE_API_KEY) not set in .env' });
  }
  res.setHeader('Content-Type', 'application/x-ndjson');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  const send = (obj) => res.write(JSON.stringify(obj) + '\n');

  try {
    const { channelUrl, maxVideos: rawMax } = req.body;
    const maxVideos = Math.min(100, Math.max(1, parseInt(rawMax, 10) || 10));
    const data = await fetchChannelData(YOUTUBE_API_KEY, channelUrl, maxVideos, (current, total, message) => {
      send({ type: 'progress', current, total, message });
    });
    send({ type: 'done', data });
  } catch (err) {
    send({ type: 'error', error: err.message || String(err) });
  } finally {
    res.end();
  }
});

// ── Image generation (for chat tool generateImage) ──────────────────────────
const GEMINI_API_KEY = process.env.REACT_APP_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

function getImageBase64FromGenerateContent(data) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part.inlineData || part.inline_data;
    if (inline && (inline.data != null || inline.bytesBase64Encoded != null))
      return inline.data != null ? inline.data : inline.bytesBase64Encoded;
  }
  return null;
}

app.post('/api/imagen/generate', async (req, res) => {
  try {
    const { prompt, anchorImageBase64 } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'prompt required' });
    }
    const trimmedPrompt = prompt.slice(0, 2000).trim();
    if (!GEMINI_API_KEY) {
      return res.status(503).json({ error: 'Image generation is not configured. Set GEMINI_API_KEY (or REACT_APP_GEMINI_API_KEY) in the server environment.' });
    }

    // 1) Prefer Gemini 2.0 Flash native image generation (generateContent + responseModalities)
    try {
      const gcRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: trimmedPrompt }] }],
            generationConfig: {
              responseModalities: ['Text', 'Image'],
            },
          }),
        }
      );
      const gcData = await gcRes.json().catch(() => ({}));
      const b64FromGemini = getImageBase64FromGenerateContent(gcData);
      if (b64FromGemini) return res.json({ imageBase64: b64FromGemini });

      if (!gcRes.ok) {
        console.warn('[imagen] Gemini image gen failed:', gcRes.status, gcData?.error?.message || JSON.stringify(gcData).slice(0, 200));
      }
    } catch (e) {
      console.warn('[imagen] Gemini image gen error:', e.message);
    }

    // 2) Fallback: Imagen predict endpoint (same API key)
    try {
      const predRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            instances: [{ prompt: trimmedPrompt }],
            parameters: { sampleCount: 1 },
          }),
        }
      );
      const predData = await predRes.json().catch(() => ({}));
      const b64FromPredict = predData?.predictions?.[0]?.bytesBase64Encoded;
      if (b64FromPredict && predRes.ok) return res.json({ imageBase64: b64FromPredict });
      if (!predRes.ok) {
        console.warn('[imagen] Imagen predict failed:', predRes.status, predData?.error?.message || JSON.stringify(predData).slice(0, 200));
      }
    } catch (e) {
      console.warn('[imagen] Imagen predict error:', e.message);
    }

    // 3) No image from any provider — return a clear placeholder and message
    const placeholder = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    return res.json({
      imageBase64: placeholder,
      warning: 'Image generation returned no image. Your API key may need image-generation access (e.g. Gemini 2.0 Flash image generation or Imagen). Check server logs for details.',
    });
  } catch (err) {
    console.error('[imagen]', err);
    res.status(500).json({ error: err.message || 'Image generation failed' });
  }
});

// ── Sessions ─────────────────────────────────────────────────────────────────

app.get('/api/sessions', async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ error: 'username required' });
    const sessions = await db
      .collection('sessions')
      .find({ username })
      .sort({ createdAt: -1 })
      .toArray();
    res.json(
      sessions.map((s) => ({
        id: s._id.toString(),
        agent: s.agent || null,
        title: s.title || null,
        createdAt: s.createdAt,
        messageCount: (s.messages || []).length,
      }))
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/sessions', async (req, res) => {
  try {
    const { username, agent } = req.body;
    if (!username) return res.status(400).json({ error: 'username required' });
    const { title } = req.body;
    const result = await db.collection('sessions').insertOne({
      username,
      agent: agent || null,
      title: title || null,
      createdAt: new Date().toISOString(),
      messages: [],
    });
    res.json({ id: result.insertedId.toString() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/sessions/:id', async (req, res) => {
  try {
    await db.collection('sessions').deleteOne({ _id: new ObjectId(req.params.id) });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/sessions/:id/title', async (req, res) => {
  try {
    const { title } = req.body;
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { title } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Messages ─────────────────────────────────────────────────────────────────

app.post('/api/messages', async (req, res) => {
  try {
    const { session_id, role, content, imageData, charts, toolCalls, generatedImages } = req.body;
    if (!session_id || !role || content === undefined)
      return res.status(400).json({ error: 'session_id, role, content required' });
    const msg = {
      role,
      content,
      timestamp: new Date().toISOString(),
      ...(imageData && {
        imageData: Array.isArray(imageData) ? imageData : [imageData],
      }),
      ...(charts?.length && { charts }),
      ...(toolCalls?.length && { toolCalls }),
      ...(generatedImages?.length && { generatedImages }),
    };
    await db.collection('sessions').updateOne(
      { _id: new ObjectId(session_id) },
      { $push: { messages: msg } }
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/messages', async (req, res) => {
  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: 'session_id required' });
    const doc = await db
      .collection('sessions')
      .findOne({ _id: new ObjectId(session_id) });
    const raw = doc?.messages || [];
    const msgs = raw.map((m, i) => {
      const arr = m.imageData
        ? Array.isArray(m.imageData)
          ? m.imageData
          : [m.imageData]
        : [];
      return {
        id: `${doc._id}-${i}`,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        images: arr.length
          ? arr.map((img) => ({ data: img.data, mimeType: img.mimeType }))
          : undefined,
        charts: m.charts?.length ? m.charts : undefined,
        toolCalls: m.toolCalls?.length ? m.toolCalls : undefined,
        generatedImages: m.generatedImages?.length ? m.generatedImages : undefined,
      };
    });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

// Always listen so the dev proxy never gets ECONNREFUSED; connect to MongoDB in background
app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
  if (!URI) {
    console.error('Missing REACT_APP_MONGODB_URI in .env — API will return 503 until set.');
    return;
  }
  connect().catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    console.error('Server is running but API will return 503 until MongoDB is connected.');
  });
});
