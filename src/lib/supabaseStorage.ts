import { supabase } from './supabase';

/**
 * Supabase Storage Service for handling image uploads and management
 */
export class SupabaseStorageService {
  private static instance: SupabaseStorageService;
  private readonly BUCKET_NAME = 'images';

  static getInstance(): SupabaseStorageService {
    if (!SupabaseStorageService.instance) {
      SupabaseStorageService.instance = new SupabaseStorageService();
    }
    return SupabaseStorageService.instance;
  }

  /**
   * Upload a file to Supabase storage
   */
  async uploadFile(file: File, userId: string, folder: string = 'consolidated'): Promise<{ url: string; path: string }> {
    try {
      // Create a unique filename with user folder structure
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const fileName = `${userId}/${folder}/${timestamp}_${randomId}_${file.name}`;

      console.log(`📤 Uploading file to Supabase storage: ${fileName}`);

      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('❌ Supabase storage upload error:', error);
        throw new Error(`Failed to upload file: ${error.message}`);
      }

      // Get the public URL
      const { data: urlData } = supabase.storage
        .from(this.BUCKET_NAME)
        .getPublicUrl(data.path);

      console.log(`✅ File uploaded successfully: ${urlData.publicUrl}`);

      return {
        url: urlData.publicUrl,
        path: data.path
      };
    } catch (error) {
      console.error('❌ Failed to upload file to Supabase storage:', error);
      throw error;
    }
  }

  /**
   * Delete a file from Supabase storage
   */
  async deleteFile(path: string): Promise<void> {
    try {
      console.log(`🗑️ Deleting file from Supabase storage: ${path}`);

      const { error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove([path]);

      if (error) {
        console.error('❌ Supabase storage delete error:', error);
        throw new Error(`Failed to delete file: ${error.message}`);
      }

      console.log(`✅ File deleted successfully: ${path}`);
    } catch (error) {
      console.error('❌ Failed to delete file from Supabase storage:', error);
      throw error;
    }
  }

  /**
   * List files in a user's folder
   */
  async listUserFiles(userId: string, folder: string = ''): Promise<string[]> {
    try {
      const prefix = folder ? `${userId}/${folder}/` : `${userId}/`;

      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list(prefix);

      if (error) {
        console.error('❌ Supabase storage list error:', error);
        throw new Error(`Failed to list files: ${error.message}`);
      }

      return data?.map(file => file.name) || [];
    } catch (error) {
      console.error('❌ Failed to list files from Supabase storage:', error);
      throw error;
    }
  }

  /**
   * Delete old files (older than specified days) from consolidated folder
   */
  async deleteOldConsolidatedFiles(userId: string, daysOld: number = 14): Promise<number> {
    try {
      console.log(`🧹 Cleaning up consolidated files older than ${daysOld} days for user: ${userId}`);

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list(`${userId}/consolidated/`);

      if (error) {
        console.error('❌ Failed to list consolidated files:', error);
        throw new Error(`Failed to list consolidated files: ${error.message}`);
      }

      if (!data || data.length === 0) {
        console.log('ℹ️ No consolidated files found');
        return 0;
      }

      // Filter files older than cutoff date
      const filesToDelete = data.filter(file => {
        const fileDate = new Date(file.created_at || file.updated_at || 0);
        return fileDate < cutoffDate;
      });

      if (filesToDelete.length === 0) {
        console.log('ℹ️ No old consolidated files to delete');
        return 0;
      }

      console.log(`🗑️ Deleting ${filesToDelete.length} old consolidated files`);

      // Delete the old files
      const filePaths = filesToDelete.map(file => `${userId}/consolidated/${file.name}`);

      const { error: deleteError } = await supabase.storage
        .from(this.BUCKET_NAME)
        .remove(filePaths);

      if (deleteError) {
        console.error('❌ Failed to delete old consolidated files:', deleteError);
        throw new Error(`Failed to delete old files: ${deleteError.message}`);
      }

      console.log(`✅ Successfully deleted ${filesToDelete.length} old consolidated files`);
      return filesToDelete.length;
    } catch (error) {
      console.error('❌ Failed to clean up old consolidated files:', error);
      throw error;
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(path: string): Promise<any> {
    try {
      const { data, error } = await supabase.storage
        .from(this.BUCKET_NAME)
        .list('', {
          search: path
        });

      if (error) {
        throw new Error(`Failed to get file metadata: ${error.message}`);
      }

      return data?.[0] || null;
    } catch (error) {
      console.error('❌ Failed to get file metadata:', error);
      throw error;
    }
  }

  /**
   * Run automatic cleanup of old consolidated images
   * This can be called periodically as a fallback when pg_cron is not available
   */
  async runAutomaticCleanup(): Promise<number> {
    try {
      console.log('🧹 Running automatic cleanup of old consolidated images...');

      // Get current user
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) {
        console.log('ℹ️ No authenticated user, skipping cleanup');
        return 0;
      }

      const deletedCount = await this.deleteOldConsolidatedFiles(session.user.id, 14);
      console.log(`✅ Automatic cleanup completed: deleted ${deletedCount} old consolidated images`);

      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to run automatic cleanup:', error);
      return 0;
    }
}
}

export const supabaseStorage = SupabaseStorageService.getInstance();