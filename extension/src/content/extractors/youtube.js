window.Debunked = window.Debunked || {};
window.Debunked.Extractors = window.Debunked.Extractors || {};

window.Debunked.Extractors.youtube = {
  canExtract() {
    return window.location.hostname === 'www.youtube.com' &&
           window.location.pathname === '/watch';
  },

  async extract() {
    const title = document.querySelector('h1.ytd-watch-metadata yt-formatted-string, h1.ytd-video-primary-info-renderer')?.textContent?.trim() || '';
    const channel = document.querySelector('#channel-name yt-formatted-string a, ytd-channel-name yt-formatted-string a')?.textContent?.trim() || '';

    let transcript = '';
    try {
      transcript = await this.fetchTranscript();
    } catch (err) {
      console.warn('[Debunked] Could not fetch YouTube transcript:', err.message);
    }

    if (!transcript) {
      const descEl = document.querySelector('#description-inline-expander, ytd-text-inline-expander, #description');
      transcript = descEl?.textContent?.trim() || '';
    }

    if (!transcript && !title) return null;

    return {
      type: 'youtube',
      content: `Video: ${title}\nChannel: ${channel}\n\nTranscript:\n${transcript}`.slice(0, 6000)
    };
  },

  async fetchTranscript() {
    const videoId = new URLSearchParams(window.location.search).get('v');
    if (!videoId) throw new Error('No video ID');

    const resp = await fetch(window.location.href);
    const html = await resp.text();

    const captionMatch = html.match(/"captionTracks":\[.*?"baseUrl":"(.*?)"/);
    if (!captionMatch) throw new Error('No captions found');

    const captionUrl = captionMatch[1].replace(/\\u0026/g, '&');
    const captionResp = await fetch(captionUrl);
    const captionXml = await captionResp.text();

    const parser = new DOMParser();
    const doc = parser.parseFromString(captionXml, 'text/xml');
    const texts = doc.querySelectorAll('text');
    const lines = [];
    texts.forEach(t => {
      const line = t.textContent?.trim();
      if (line) lines.push(line);
    });

    return lines.join(' ');
  }
};
