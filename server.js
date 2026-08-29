import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Serve static files from root directory
app.use(express.static(__dirname));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'DD CMS' });
});

// Firebase config endpoint
app.get('/api/firebase-config', (req, res) => {
  res.json({
    projectId: process.env.FIREBASE_PROJECT_ID || "optical-upgrade-7dx1j",
    appId: process.env.FIREBASE_APP_ID || "1:703747320211:web:5b3bc3bb7d581daac7e066",
    apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAhJ2UmbhRm_ZkkAXZyu6t4hIjoaZ7tf3U",
    authDomain: process.env.FIREBASE_AUTH_DOMAIN || "optical-upgrade-7dx1j.firebaseapp.com",
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "optical-upgrade-7dx1j.firebasestorage.app",
    messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "703747320211",
    databaseId: process.env.FIREBASE_DATABASE_ID || "ai-studio-ddinvoicemanagem-bc53b9da-08cd-49d1-83b1-35cf8c6f861c"
  });
});

// Fallback to index.html for all page routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`DD CMS Server is running on http://${HOST}:${PORT}`);
});
