#!/usr/bin/env node
/**
 * Check if a YouTube video has a transcript and why it might fail.
 * Usage: node scripts/check-transcript.js <videoId_or_url>
 * Example: node scripts/check-transcript.js dQw4w9WgXcQ
 *          node scripts/check-transcript.js "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
 */
const { YouTubeTranscriptApi } = require('yt-transcript-api');

const input = process.argv[2];
if (!input) {
  console.log('Usage: node scripts/check-transcript.js <videoId or full YouTube URL>');
  console.log('Example: node scripts/check-transcript.js dQw4w9WgXcQ');
  process.exit(1);
}

// Accept full URL or just video ID
let videoId = input.trim();
const m = input.match(/(?:v=|\/v\/|youtu\.be\/)([A-Za-z0-9_-]{11})/);
if (m) videoId = m[1];

console.log('Checking transcript for video ID:', videoId);
console.log('URL: https://www.youtube.com/watch?v=' + videoId);
console.log('');

const api = new YouTubeTranscriptApi();
api.fetch(videoId, ['en'])
  .then((fetched) => {
    const text = Array.isArray(fetched) ? fetched.map((s) => s.text).join(' ') : '';
    console.log('SUCCESS — Transcript is available.');
    console.log('Length:', text.length, 'characters');
    console.log('Preview:', text.slice(0, 200) + (text.length > 200 ? '...' : ''));
  })
  .catch((err) => {
    console.log('FAILED — No transcript returned.');
    console.log('Error name:', err.name);
    console.log('Error message:', err.message);
    console.log('');
    if (err.message && err.message.includes('too many requests')) {
      console.log('→ Likely cause: YouTube is rate-limiting. Wait a few minutes and try again, or try fewer videos per run.');
    } else if (err.message && err.message.includes('disabled')) {
      console.log('→ Likely cause: Captions/transcript are disabled for this video by the uploader.');
    } else if (err.message && err.message.includes('not available')) {
      console.log('→ Likely cause: No captions have been added to this video.');
    } else {
      console.log('→ Check on YouTube: open the video, click "..." or the CC button, and see if "Show transcript" is available.');
    }
    process.exit(1);
  });
