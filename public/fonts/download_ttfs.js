import fs from 'fs';

async function download() {
  const url = 'https://fonts.googleapis.com/css2?family=Arimo:ital,wght@0,400;0,700;1,400;1,700&display=swap';
  
  // Fake a very old Android browser user-agent to force TTF
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Linux; U; Android 2.2; en-us; DROID2 GLOBAL Build/S273) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0 Mobile Safari/533.1'
    }
  });
  
  const css = await res.text();
  console.log(css);
}

download().catch(console.error);
