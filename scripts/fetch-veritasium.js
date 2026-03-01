require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { fetchChannelData } = require('../server/youtubeService');

const API_KEY = process.env.YOUTUBE_API_KEY || process.env.REACT_APP_YOUTUBE_API_KEY;
const CHANNEL_URL = 'https://www.youtube.com/@veritasium';
const MAX_VIDEOS = 10;
const OUT_PATH = path.join(__dirname, '..', 'public', 'veritasium_channel_data.json');

async function main() {
  if (!API_KEY) {
    console.error('Missing YOUTUBE_API_KEY or REACT_APP_YOUTUBE_API_KEY in .env');
    process.exit(1);
  }
  console.log('Fetching', MAX_VIDEOS, 'videos from', CHANNEL_URL, '...');
  const data = await fetchChannelData(API_KEY, CHANNEL_URL, MAX_VIDEOS, (current, total, message) => {
    console.log(`[${current}/${total}] ${message}`);
  });
  fs.writeFileSync(OUT_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log('Wrote', data.length, 'videos to', OUT_PATH);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
