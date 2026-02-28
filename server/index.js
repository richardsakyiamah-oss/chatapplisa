require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const cors = require('cors');
const { google } = require('googleapis');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

const youtube = google.youtube({
  version: 'v3',
  auth: process.env.YOUTUBE_API_KEY || process.env.REACT_APP_YOUTUBE_API_KEY,
});

const URI = process.env.REACT_APP_MONGODB_URI || process.env.MONGODB_URI || process.env.REACT_APP_MONGO_URI;
const DB = 'chatapp';

let db;

async function connect() {
  try {
    const client = await MongoClient.connect(URI, {
      tls: true,
      tlsAllowInvalidCertificates: false,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });
    db = client.db(DB);
    console.log('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection error:', error.message);
    console.log('\nTrying alternative connection method...');
    
    // Try without explicit TLS options
    try {
      const client = await MongoClient.connect(URI);
      db = client.db(DB);
      console.log('MongoDB connected (alternative method)');
    } catch (retryError) {
      throw new Error(`MongoDB connection failed: ${retryError.message}`);
    }
  }
}

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
      lastName: user.lastName || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
    const { session_id, role, content, imageData, charts, toolCalls } = req.body;
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
      };
    });
    res.json(msgs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── YouTube Download ─────────────────────────────────────────────────────────

app.post('/api/youtube/download', async (req, res) => {
  try {
    const { channelHandle, maxVideos } = req.body;
    
    if (!channelHandle) {
      return res.status(400).json({ error: 'channelHandle required' });
    }
    
    if (!process.env.YOUTUBE_API_KEY && !process.env.REACT_APP_YOUTUBE_API_KEY) {
      return res.status(500).json({ 
        error: 'YouTube API key not configured. Please add YOUTUBE_API_KEY to your .env file.' 
      });
    }
    
    // Set headers for Server-Sent Events
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const sendProgress = (progress, message) => {
      res.write(`data: ${JSON.stringify({ progress, message })}\n\n`);
    };
    
    sendProgress(5, 'Searching for channel...');
    
    // Extract channel username from handle (remove @)
    const username = channelHandle.replace('@', '');
    
    // Search for channel by username
    let channelId;
    try {
      const searchResponse = await youtube.search.list({
        part: 'snippet',
        q: username,
        type: 'channel',
        maxResults: 1,
      });
      
      if (!searchResponse.data.items || searchResponse.data.items.length === 0) {
        throw new Error(`Channel not found: ${channelHandle}`);
      }
      
      channelId = searchResponse.data.items[0].snippet.channelId;
    } catch (error) {
      sendProgress(0, `Error: ${error.message}`);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      return res.end();
    }
    
    sendProgress(15, `Found channel: ${channelId}`);
    
    // Get channel's uploads playlist
    sendProgress(20, 'Fetching channel details...');
    const channelResponse = await youtube.channels.list({
      part: 'contentDetails,snippet',
      id: channelId,
    });
    
    const uploadsPlaylistId = channelResponse.data.items[0].contentDetails.relatedPlaylists.uploads;
    
    sendProgress(30, 'Fetching videos...');
    
    // Get videos from uploads playlist
    const playlistResponse = await youtube.playlistItems.list({
      part: 'snippet,contentDetails',
      playlistId: uploadsPlaylistId,
      maxResults: Math.min(maxVideos, 50), // API limit is 50
    });
    
    const videoIds = playlistResponse.data.items.map(item => item.contentDetails.videoId);
    
    sendProgress(50, `Found ${videoIds.length} videos, fetching details...`);
    
    // Get detailed video information
    const videosResponse = await youtube.videos.list({
      part: 'snippet,contentDetails,statistics',
      id: videoIds.join(','),
    });
    
    const videos = [];
    const progressPerVideo = 40 / videosResponse.data.items.length;
    
    for (let i = 0; i < videosResponse.data.items.length; i++) {
      const video = videosResponse.data.items[i];
      
      sendProgress(
        50 + (i * progressPerVideo),
        `Processing: ${video.snippet.title.substring(0, 50)}...`
      );
      
      // Get captions/transcript if available
      let transcript = "No transcript available";
      try {
        const captionsResponse = await youtube.captions.list({
          part: 'snippet',
          videoId: video.id,
        });
        
        if (captionsResponse.data.items && captionsResponse.data.items.length > 0) {
          // Note: Downloading actual caption content requires additional OAuth
          // For now, we'll note that captions are available
          transcript = "Captions available (download requires OAuth)";
        }
      } catch (e) {
        // Captions might not be available or accessible
        console.log(`No captions for: ${video.snippet.title}`);
      }
      
      // Parse ISO 8601 duration (PT1H2M10S -> seconds)
      const duration = parseDuration(video.contentDetails.duration);
      
      videos.push({
        title: video.snippet.title,
        description: video.snippet.description,
        transcript: transcript,
        duration: duration,
        releaseDate: video.snippet.publishedAt,
        viewCount: parseInt(video.statistics.viewCount) || 0,
        likeCount: parseInt(video.statistics.likeCount) || 0,
        commentCount: parseInt(video.statistics.commentCount) || 0,
        videoUrl: `https://www.youtube.com/watch?v=${video.id}`,
      });
    }
    
    const data = {
      channelId: channelHandle,
      channelUrl: `https://www.youtube.com/${channelHandle}`,
      downloadDate: new Date().toISOString(),
      videoCount: videos.length,
      videos,
    };
    
    sendProgress(100, 'Complete!');
    res.write(`data: ${JSON.stringify({ data })}\n\n`);
    res.end();
    
  } catch (err) {
    console.error('YouTube download error:', err);
    const errorMessage = err.message || 'Unknown error occurred';
    res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
    res.end();
  }
});

// Save YouTube JSON to public folder so it can be fetched by the client
app.post('/api/youtube/save-public', (req, res) => {
  try {
    const { data, filename } = req.body;
    if (!data || !filename) return res.status(400).json({ error: 'data and filename required' });
    const safeName = filename.replace(/[^a-zA-Z0-9_.-]/g, '_');
    const publicDir = path.join(__dirname, '..', 'public');
    fs.writeFileSync(path.join(publicDir, safeName), JSON.stringify(data, null, 2));
    res.json({ ok: true, path: `/${safeName}` });
  } catch (err) {
    console.error('Save public error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Helper function to parse ISO 8601 duration to seconds
function parseDuration(duration) {
  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  
  const hours = parseInt(match[1]) || 0;
  const minutes = parseInt(match[2]) || 0;
  const seconds = parseInt(match[3]) || 0;
  
  return hours * 3600 + minutes * 60 + seconds;
}

// ─────────────────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3001;

connect()
  .then(() => {
    app.listen(PORT, () => console.log(`Server on http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection failed:', err.message);
    process.exit(1);
  });
