import { Database } from './supabase';

export interface User {
  id: string;
  email: string;
  created_at: string;
  postiz_api_key?: string;
}

export interface UploadedImage {
  id: string;
  file: File;
  url: string;
  preview: string;
  permanentUrl?: string;
  deleteUrl?: string;
  filename?: string;
  fileSize?: number;
  mimeType?: string;
  width?: number;
  height?: number;
  aspectRatio?: string; // e.g., "1:1", "4:5", "9:16"
  croppedUrl?: string; // URL of cropped version if different from original
}

export interface Folder {
  id: string;
  name: string;
  created_at: string;
  parent_id?: string;
  images: UploadedImage[];
  slideshows?: SlideshowMetadata[];
}

export interface Slideshow {
  id: string;
  images: UploadedImage[];
  created_at: string;
  user_id: string;
}

export interface Hashtag {
  id: string;
  user_id: string;
  tag: string;
  created_at: string;
  updated_at: string;
}

export interface TextOverlay {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  outline: boolean;
  outlineColor: string;
  outlineWidth: number;
  outlinePosition: 'outer' | 'middle' | 'inner';
  glow: boolean;
  glowColor: string;
  glowIntensity: number;
}

// Extended interface for TikTok-style text overlays from TikTokPreview component
export interface TikTokTextOverlay {
  id: string;
  slideIndex: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  color: string;
  fontFamily: string;
  fontWeight: string;
  alignment: 'left' | 'center' | 'right';
  outlineColor: string;
  outlineWidth: number;
  outlinePosition: 'outer' | 'middle' | 'inner';
  bold: boolean;
  italic: boolean;
  outline: boolean;
  glow: boolean;
  glowColor: string;
  glowIntensity: number;
  isEditing?: boolean;
  isSelected?: boolean;
}

// Condensed slide - image with text overlaid and compressed
export interface CondensedSlide {
  id: string;
  originalImageId: string;
  condensedImageUrl: string; // URL of the final compressed image with text
  originalImageUrl?: string; // Original image URL for API posting (to avoid large base64 payloads)
  width: number;
  height: number;
  aspectRatio: string;
  fileSize?: number;
}

// Metadata for saved slideshows
export interface SlideshowMetadata {
  id: string;
  title: string; // Slideshow file name
  postTitle?: string; // Title for TikTok post
  caption: string;
  hashtags: string[];
  condensedSlides: CondensedSlide[];
  textOverlays: TikTokTextOverlay[];
  aspectRatio: string;
  transitionEffect: 'fade' | 'slide' | 'zoom';
  musicEnabled: boolean;
  created_at: string;
  updated_at: string;
  user_id: string;
  folder_id?: string | null; // Folder association for drag and drop organization
}

// Postiz integration data
export interface PostizSlideshowData {
  text: string; // Formatted caption with hashtags
  profileIds: string[];
  mediaUrls?: string[];
  scheduledAt?: string;
  publishedAt?: string;
}

// Postiz profile interface
export interface PostizProfile {
  id: string;
  username: string;
  provider: string; // 'tiktok', 'instagram', 'twitter', etc.
  displayName: string;
  avatar?: string;
}

// Slideshow save/load operation
export interface SlideshowOperation {
  id: string;
  type: 'save' | 'load' | 'delete' | 'schedule';
  slideshowId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress: number;
  error?: string;
  created_at: string;
  completed_at?: string;
}

export interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
}

// Aspect ratio presets
export interface AspectRatioPreset {
  id: string;
  label: string;
  ratio: string; // e.g., "1:1", "4:3", "16:9"
  description: string;
  icon?: string;
}

// Common aspect ratio presets
export const ASPECT_RATIO_PRESETS: AspectRatioPreset[] = [
  { id: 'free', label: 'Free', ratio: 'free', description: 'Free-form cropping', icon: '✂️' },
  { id: '1:1', label: 'Square', ratio: '1:1', description: 'Perfect square format', icon: '⬜' },
  { id: '4:5', label: 'Portrait A', ratio: '4:5', description: 'Instagram post format', icon: '📱' },
  { id: '9:16', label: 'Story', ratio: '9:16', description: 'TikTok/Instagram story', icon: '📖' },
  { id: '16:9', label: 'Landscape', ratio: '16:9', description: 'Video landscape format', icon: '🎬' },
  { id: '3:4', label: 'Portrait B', ratio: '3:4', description: 'Classic portrait ratio', icon: '👤' },
  { id: '2:3', label: 'Print', ratio: '2:3', description: 'Photography print ratio', icon: '🖼️' },
  { id: '21:9', label: 'Cinematic', ratio: '21:9', description: 'Ultra-wide cinematic', icon: '🎥' },
];

// Database types - commented out due to schema changes
// export type DbUser = Database['public']['Tables']['users']['Row'];
// export type DbImage = Database['public']['Tables']['images']['Row'];
// export type DbSlideshow = Database['public']['Tables']['slideshows']['Row'];
// export type DbSlideshowImage = Database['public']['Tables']['slideshow_images']['Row'];
// export type DbHashtag = Database['public']['Tables']['hashtags']['Row'];

// export type InsertUser = Database['public']['Tables']['users']['Insert'];
// export type InsertImage = Database['public']['Tables']['images']['Insert'];
// export type InsertSlideshow = Database['public']['Tables']['slideshows']['Insert'];
// export type InsertSlideshowImage = Database['public']['Tables']['slideshow_images']['Insert'];
// export type InsertHashtag = Database['public']['Tables']['hashtags']['Insert'];

// export type UpdateUser = Database['public']['Tables']['users']['Update'];
// export type UpdateImage = Database['public']['Tables']['images']['Update'];
// export type UpdateSlideshow = Database['public']['Tables']['slideshows']['Update'];
// export type UpdateSlideshowImage = Database['public']['Tables']['slideshow_images']['Update'];
// export type UpdateHashtag = Database['public']['Tables']['hashtags']['Update'];

// Slideshow Template Interface
export interface SlideshowTemplate {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  // Edit settings that will be saved
  title: string;
  postTitle?: string;
  caption: string;
  hashtags: string[];
  textOverlays: TikTokTextOverlay[];
  aspectRatio: string;
  transitionEffect: 'fade' | 'slide' | 'zoom';
  musicEnabled: boolean;
  // Template metadata
  previewImage?: string; // Optional preview image URL
  slideCount: number; // Number of slides this template creates
  created_at: string;
  updated_at: string;
}

// Template Application Result
export interface TemplateApplicationResult {
  success: boolean;
  slideshow?: SlideshowMetadata;
  error?: string;
  processedImages: number;
  totalImages: number;
}

// Bulk Upload with Template Application
export interface BulkUploadWithTemplate {
  images: UploadedImage[];
  templateId: string;
  title?: string; // Override template title if provided
  customizations?: {
    caption?: string;
    hashtags?: string[];
  };
}

// Bulk Template Creation Options
export interface BulkTemplateOptions {
  randomizeImages?: boolean;
  customizations?: {
    title?: string;
    caption?: string;
    hashtags?: string[];
  };
  slideshowTitles?: string[]; // Optional custom titles for each slideshow
}

// Bulk Template Creation Result
export interface BulkTemplateCreationResult {
  success: boolean;
  slideshows: SlideshowMetadata[];
  error?: string;
  totalImages: number;
  slideshowCount: number;
}

// Bulk Template Creation Preview
export interface BulkTemplatePreview {
  totalImages: number;
  slideshowCount: number;
  slidesPerSlideshow: number;
  groups: UploadedImage[][];
  willCreatePartialSlideshow: boolean;
}
