const BUFFER_API_BASE = 'https://api.bufferapp.com/1';
const BUFFER_ACCESS_TOKEN = import.meta.env.VITE_BUFFER_ACCESS_TOKEN || 'your-buffer-access-token';

export interface BufferProfile {
  id: string;
  avatar: string;
  created_at: number;
  default: boolean;
  formatted_username: string;
  service: string;
  service_id: string;
  service_username: string;
  timezone: string;
  type: string;
}

export interface BufferPost {
  id: string;
  created_at: number;
  profile_id: string;
  text: string;
  media?: {
    photo: string;
    thumbnail: string;
    description?: string;
  };
  scheduled_at: number;
  status: 'pending' | 'sent' | 'failed';
  service_link?: string;
  statistics?: {
    clicks: number;
    favorites: number;
    mentions: number;
    retweets: number;
    shares: number;
  };
}

export interface CreatePostData {
  text: string;
  profile_ids: string[];
  media?: {
    photo: string;
    thumbnail?: string;
    description?: string;
  };
  scheduled_at?: number;
  now?: boolean;
}

export const bufferAPI = {
  // Get user profiles
  async getProfiles(): Promise<BufferProfile[]> {
    const response = await fetch(`${BUFFER_API_BASE}/profiles.json?access_token=${BUFFER_ACCESS_TOKEN}`);
    if (!response.ok) {
      throw new Error(`Buffer API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  },

  // Create a new post
  async createPost(postData: CreatePostData): Promise<BufferPost> {
    const response = await fetch(`${BUFFER_API_BASE}/updates/create.json?access_token=${BUFFER_ACCESS_TOKEN}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        text: postData.text,
        profile_ids: JSON.stringify(postData.profile_ids),
        ...(postData.media && {
          media: JSON.stringify(postData.media),
        }),
        ...(postData.scheduled_at && {
          scheduled_at: postData.scheduled_at.toString(),
        }),
        ...(postData.now && {
          now: 'true',
        }),
      }),
    });

    if (!response.ok) {
      throw new Error(`Buffer API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.updates[0]; // Buffer returns an array of updates
  },

  // Get pending posts
  async getPendingPosts(): Promise<BufferPost[]> {
    const response = await fetch(`${BUFFER_API_BASE}/updates/pending.json?access_token=${BUFFER_ACCESS_TOKEN}`);
    if (!response.ok) {
      throw new Error(`Buffer API error: ${response.statusText}`);
    }
    const data = await response.json();
    return data.updates || [];
  },

  // Delete a post
  async deletePost(updateId: string): Promise<void> {
    const response = await fetch(`${BUFFER_API_BASE}/updates/${updateId}/destroy.json?access_token=${BUFFER_ACCESS_TOKEN}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Buffer API error: ${response.statusText}`);
    }
  },

  // Shuffle posts (reorder)
  async shufflePosts(): Promise<void> {
    const response = await fetch(`${BUFFER_API_BASE}/updates/shuffle.json?access_token=${BUFFER_ACCESS_TOKEN}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Buffer API error: ${response.statusText}`);
    }
  },
};