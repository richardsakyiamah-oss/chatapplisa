// YouTube Channel Data Download Service
// Downloads metadata for YouTube channel videos including transcripts

export const downloadChannelData = async (channelUrl, maxVideos, onProgress) => {
  try {
    const channelHandle = extractChannelHandle(channelUrl);
    if (!channelHandle) {
      throw new Error('Invalid YouTube channel URL. Expected format: https://www.youtube.com/@channelname');
    }

    console.log('Requesting channel data from server...');
    onProgress?.(10);
    
    const apiUrl = process.env.REACT_APP_API_URL || '';
    const response = await fetch(`${apiUrl}/api/youtube/download`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channelHandle,
        maxVideos,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Failed to download channel data';
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorMessage;
      } catch (e) {
        errorMessage = errorText || errorMessage;
      }
      throw new Error(errorMessage);
    }
    
    // Stream progress updates
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let data = null;
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6);
          try {
            const update = JSON.parse(jsonStr);
            if (update.progress !== undefined) {
              onProgress?.(update.progress);
            }
            if (update.message) {
              console.log(update.message);
            }
            if (update.data) {
              data = update.data;
            }
            if (update.error) {
              throw new Error(update.error);
            }
          } catch (e) {
            if (e.message && !e.message.includes('Unexpected')) {
              throw e;
            }
            console.error('Failed to parse SSE data:', e);
          }
        }
      }
    }
    
    if (!data) {
      throw new Error('No data received from server. Make sure the server is running on port 3001.');
    }
    
    onProgress?.(100);
    return data;
    
  } catch (error) {
    console.error('Error downloading channel data:', error);
    throw error;
  }
};

const extractChannelHandle = (url) => {
  // Extract channel handle from URL
  // Supports: https://www.youtube.com/@channelname or @channelname
  const match = url.match(/@([^/?]+)/);
  return match ? `@${match[1]}` : null;
};

export const downloadChannelDataToJson = async (channelUrl, maxVideos, onProgress) => {
  const data = await downloadChannelData(channelUrl, maxVideos, onProgress);
  const filename = `${data.channelId.replace('@', '')}_${data.videoCount}_videos.json`;

  // Save to public folder on the server so it persists and can be fetched
  try {
    const apiUrl = process.env.REACT_APP_API_URL || '';
    await fetch(`${apiUrl}/api/youtube/save-public`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, filename }),
    });
  } catch (e) {
    console.warn('Could not save to public folder:', e);
  }

  // Also trigger a browser download for the user
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return data;
};
