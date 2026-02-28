// YouTube Chat Tools
// Tools for analyzing YouTube channel data in chat

// Tool declarations for Gemini function calling
export const YOUTUBE_TOOL_DECLARATIONS = [
  {
    name: 'compute_stats_json',
    description: 'Compute mean, median, std, min, and max for any numeric field in the YouTube channel JSON data (e.g., viewCount, likeCount, commentCount, duration).',
    parameters: {
      type: 'OBJECT',
      properties: {
        field: {
          type: 'STRING',
          description: 'The numeric field to analyze. Common fields: viewCount, likeCount, commentCount, duration. Use exact field names from the JSON.',
        },
      },
      required: ['field'],
    },
  },
  {
    name: 'plot_metric_vs_time',
    description: 'Create a line chart plotting any numeric metric (views, likes, comments, duration) vs release date for the YouTube videos. Returns chart data for rendering.',
    parameters: {
      type: 'OBJECT',
      properties: {
        metricField: {
          type: 'STRING',
          description: 'The numeric field to plot on Y-axis. Common: viewCount, likeCount, commentCount, duration.',
        },
      },
      required: ['metricField'],
    },
  },
  {
    name: 'play_video',
    description: 'Display a clickable video card for a specific video from the loaded YouTube channel data. User can specify by title keywords, ordinal position (first, second, third, etc.), or performance metric (most viewed, least liked, etc.).',
    parameters: {
      type: 'OBJECT',
      properties: {
        selector: {
          type: 'STRING',
          description: 'How to select the video. Examples: "asbestos" (title keyword), "first" (ordinal), "most viewed" (performance), "least liked" (performance).',
        },
      },
      required: ['selector'],
    },
  },
  {
    name: 'generateImage',
    description: 'Generate an image based on a text prompt and an anchor/reference image. Used for creating thumbnails, social media graphics, or custom visuals.',
    parameters: {
      type: 'OBJECT',
      properties: {
        prompt: {
          type: 'STRING',
          description: 'Text description of the image to generate.',
        },
        style: {
          type: 'STRING',
          description: 'Optional style guidance (e.g., "photorealistic", "cartoon", "minimalist").',
        },
      },
      required: ['prompt'],
    },
  },
];

// Execute YouTube tools
export const executeYoutubeTool = (toolName, args, jsonData, anchorImage = null) => {
  if (!jsonData || !jsonData.videos) {
    return { error: 'No YouTube channel data loaded' };
  }

  const videos = jsonData.videos;

  switch (toolName) {
    case 'compute_stats_json': {
      const field = args.field;
      const values = videos
        .map((v) => parseFloat(v[field]))
        .filter((v) => !isNaN(v));

      if (values.length === 0) {
        return { error: `No numeric values found for field "${field}"` };
      }

      const sorted = [...values].sort((a, b) => a - b);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const median =
        sorted.length % 2 === 0
          ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
          : sorted[Math.floor(sorted.length / 2)];
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
      const std = Math.sqrt(variance);

      return {
        field,
        count: values.length,
        mean: +mean.toFixed(2),
        median: +median.toFixed(2),
        std: +std.toFixed(2),
        min: Math.min(...values),
        max: Math.max(...values),
      };
    }

    case 'plot_metric_vs_time': {
      const metricField = args.metricField;
      const chartData = videos
        .map((v) => ({
          date: new Date(v.releaseDate).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          }),
          value: parseFloat(v[metricField]) || 0,
          title: v.title,
        }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      return {
        _chartType: 'metric_vs_time',
        metricField,
        data: chartData,
      };
    }

    case 'play_video': {
      const selector = args.selector.toLowerCase();
      let selectedVideo = null;

      // Ordinal selection (first, second, third, etc.)
      const ordinals = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];
      const ordinalIndex = ordinals.indexOf(selector);
      if (ordinalIndex !== -1 && ordinalIndex < videos.length) {
        selectedVideo = videos[ordinalIndex];
      }

      // Performance-based selection
      if (!selectedVideo) {
        if (selector.includes('most viewed') || selector.includes('highest views')) {
          selectedVideo = videos.reduce((max, v) => (v.viewCount > max.viewCount ? v : max), videos[0]);
        } else if (selector.includes('least viewed') || selector.includes('lowest views')) {
          selectedVideo = videos.reduce((min, v) => (v.viewCount < min.viewCount ? v : min), videos[0]);
        } else if (selector.includes('most liked')) {
          selectedVideo = videos.reduce((max, v) => (v.likeCount > max.likeCount ? v : max), videos[0]);
        } else if (selector.includes('least liked')) {
          selectedVideo = videos.reduce((min, v) => (v.likeCount < min.likeCount ? v : min), videos[0]);
        } else if (selector.includes('most commented')) {
          selectedVideo = videos.reduce((max, v) => (v.commentCount > max.commentCount ? v : max), videos[0]);
        }
      }

      // Title keyword search
      if (!selectedVideo) {
        selectedVideo = videos.find((v) => v.title.toLowerCase().includes(selector));
      }

      if (!selectedVideo) {
        return { error: `Could not find video matching "${args.selector}"` };
      }

      return {
        _chartType: 'video_card',
        video: {
          title: selectedVideo.title,
          videoUrl: selectedVideo.videoUrl,
          viewCount: selectedVideo.viewCount,
          likeCount: selectedVideo.likeCount,
          commentCount: selectedVideo.commentCount,
          releaseDate: selectedVideo.releaseDate,
        },
      };
    }

    case 'generateImage': {
      // Return a marker that will trigger actual image generation in the Chat component
      return {
        _chartType: 'generated_image',
        prompt: args.prompt,
        style: args.style || 'default',
        needsGeneration: true,
      };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
};
