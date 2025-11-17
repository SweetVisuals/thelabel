import { supabase } from './supabase';
import { uploadWithFallback, getImageDimensions } from './imgbb';
import { UploadedImage, Folder } from '@/types';
import { cropImage, parseAspectRatio, batchCropImages } from './aspectRatio';

/**
 * Enhanced image cropping service with smart positioning and posting optimization
 */
export class ImageCroppingService {
  /**
   * Enhanced change aspect ratio with smart cropping for posting
   */
  static async changeAspectRatio(
    imageIds: string[],
    targetAspectRatio: string,
    userId: string
  ): Promise<UploadedImage[]> {
    try {
      console.log('🔄 Starting enhanced aspect ratio change for posting...', {
        imageIds: imageIds.length,
        targetAspectRatio,
        userId
      });

      // Get image data for all selected images
      const { data: images, error: fetchError } = await supabase
        .from('images')
        .select('*')
        .in('id', imageIds)
        .eq('user_id', userId);

      if (fetchError) {
        throw new Error(`Failed to fetch images: ${fetchError.message}`);
      }

      if (!images || images.length === 0) {
        throw new Error('No images found');
      }

      // Skip cropping for 'free' aspect ratio
      if (targetAspectRatio === 'free') {
        console.log('📏 Skipping cropping for free aspect ratio');
        return images.map(img => ({
          id: img.id,
          file: new File([], img.filename, { type: img.mime_type }),
          url: img.file_path,
          preview: img.file_path,
          permanentUrl: img.file_path,
          filename: img.filename,
          fileSize: img.file_size,
          mimeType: img.mime_type,
          width: img.width,
          height: img.height,
          aspectRatio: img.aspect_ratio || undefined,
        })) as UploadedImage[];
      }

      // Convert aspect ratio string to numeric value
      const numericAspectRatio = parseAspectRatio(targetAspectRatio);
      if (numericAspectRatio === 0) {
        throw new Error('Invalid aspect ratio');
      }

      console.log('🎯 Target aspect ratio:', numericAspectRatio);

      // Process images with enhanced cropping
      const updatedImages: UploadedImage[] = [];
      let processedCount = 0;
      
      for (const image of images) {
        try {
          console.log(`🖼️ Processing image ${++processedCount}/${images.length}: ${image.filename}`);
          
          // Convert imgbb URL to File object for cropping
          const imageFile = await this.urlToFile(image.file_path, image.filename, image.mime_type);
          
          // Use enhanced cropImage function with smart positioning
          const cropResult = await cropImage(imageFile, numericAspectRatio, 0.92);
          
          // Create new file from cropped result
          const newFile = new File([cropResult.blob], image.filename, {
            type: image.mime_type.includes('png') ? 'image/png' : 'image/jpeg'
          });

          // Upload with multi-level fallback: IM.GE -> FreeImage -> ImgBB
          const imgbbResponse = await uploadWithFallback(newFile);

          // Update database with new dimensions and aspect ratio
          const { data: updatedImage, error: updateError } = await supabase
            .from('images')
            .update({
              file_path: imgbbResponse.data.url,
              width: cropResult.width,
              height: cropResult.height,
              file_size: cropResult.blob.size,
              aspect_ratio: targetAspectRatio,
            })
            .eq('id', image.id)
            .eq('user_id', userId)
            .select()
            .single();

          if (updateError) {
            throw new Error(`Failed to update image: ${updateError.message}`);
          }

          // Convert to UploadedImage format
          const updatedImageData = {
            id: updatedImage.id,
            file: newFile,
            url: imgbbResponse.data.url,
            preview: imgbbResponse.data.url,
            permanentUrl: imgbbResponse.data.url,
            deleteUrl: imgbbResponse.data.delete_url,
            filename: image.filename,
            fileSize: cropResult.blob.size,
            mimeType: newFile.type,
            width: cropResult.width,
            height: cropResult.height,
            aspectRatio: targetAspectRatio,
          };
          
          updatedImages.push(updatedImageData);
          console.log(`✅ Successfully processed ${image.filename}`, {
            originalSize: `${image.width}x${image.height}`,
            newSize: `${cropResult.width}x${cropResult.height}`,
            fileSize: cropResult.blob.size
          });
          
        } catch (imageError) {
          console.error(`❌ Failed to process image ${image.filename}:`, imageError);
          
          // Add original image without cropping on error
          const fallbackImage = {
            id: image.id,
            file: new File([], image.filename, { type: image.mime_type }),
            url: image.file_path,
            preview: image.file_path,
            permanentUrl: image.file_path,
            filename: image.filename,
            fileSize: image.file_size,
            mimeType: image.mime_type,
            width: image.width,
            height: image.height,
            aspectRatio: image.aspect_ratio || undefined,
          };
          
          updatedImages.push(fallbackImage);
          
          // Try to update aspect ratio even on failure
          try {
            await supabase
              .from('images')
              .update({ aspect_ratio: targetAspectRatio })
              .eq('id', image.id)
              .eq('user_id', userId);
          } catch (updateError) {
            console.warn(`⚠️ Failed to update aspect ratio for ${image.filename}:`, updateError);
          }
        }
      }

      console.log(`🎉 Aspect ratio change completed: ${updatedImages.length}/${images.length} images processed`);
      return updatedImages;
      
    } catch (error) {
      console.error('❌ Failed to change aspect ratios:', error);
      throw new Error(`Failed to change aspect ratios: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Convert URL to File object for processing
   */
  private static async urlToFile(url: string, filename: string, mimeType: string): Promise<File> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status}`);
      }
      
      const blob = await response.blob();
      return new File([blob], filename, { type: mimeType });
    } catch (error) {
      throw new Error(`Failed to convert URL to file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch process multiple images for slideshow creation
   */
  static async prepareImagesForSlideshow(
    imageIds: string[],
    targetAspectRatio: string,
    userId: string
  ): Promise<UploadedImage[]> {
    console.log('🎬 Preparing images for slideshow with aspect ratio:', targetAspectRatio);
    
    try {
      // First change aspect ratio if needed
      const processedImages = await this.changeAspectRatio(imageIds, targetAspectRatio, userId);
      
      console.log(`✅ Prepared ${processedImages.length} images for slideshow`);
      return processedImages;
      
    } catch (error) {
      console.error('❌ Failed to prepare images for slideshow:', error);
      throw error;
    }
  }
}

export const imageService = {
  // Test database connection and table existence
  async testDatabaseConnection(): Promise<{ success: boolean; message: string; tables?: string[] }> {
    try {
      console.log('🧪 Testing database connection...');

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        return { success: false, message: 'User not authenticated' };
      }

      console.log('👤 User authenticated:', session.user.id);

      // Test if tables exist by trying to query them
      const tables = ['users', 'images', 'folders', 'folder_images', 'slideshows', 'slideshow_images'];
      const existingTables: string[] = [];

      for (const table of tables) {
        try {
          const { error } = await supabase.from(table).select('count').limit(1);
          if (!error) {
            existingTables.push(table);
          }
        } catch (error) {
          // Table doesn't exist or other error
        }
      }

      console.log('📊 Existing tables:', existingTables);

      if (existingTables.length === 0) {
        return {
          success: false,
          message: 'No database tables found. Please run the setup-new-database.sql script in your Supabase dashboard.',
          tables: []
        };
      }

      if (existingTables.length < tables.length) {
        const missingTables = tables.filter(t => !existingTables.includes(t));
        return {
          success: false,
          message: `Some tables are missing: ${missingTables.join(', ')}. Please run the setup-new-database.sql script.`,
          tables: existingTables
        };
      }

      return {
        success: true,
        message: 'Database connection successful and all tables exist.',
        tables: existingTables
      };
    } catch (error) {
      console.error('❌ Database connection test failed:', error);
      return {
        success: false,
        message: `Database connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  },

  // Upload image to ImgBB and save metadata to Supabase
  async uploadImage(file: File, folderId?: string): Promise<UploadedImage> {
    try {
      // Get current user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      const user = session.user;

      // Upload with multi-level fallback: IM.GE -> FreeImage -> ImgBB
      const imgbbResponse = await uploadWithFallback(file);
      const dimensions = await getImageDimensions(file);

      // Save to Supabase
      const imageData = {
        user_id: user.id,
        filename: file.name,
        file_path: imgbbResponse.data.url,
        file_size: file.size,
        mime_type: file.type,
        width: dimensions.width,
        height: dimensions.height,
      };

      const { data: dbImage, error: dbError } = await supabase
        .from('images')
        .insert(imageData)
        .select()
        .single();

      if (dbError) {
        // If database save fails, try to delete from ImgBB
        try {
          await fetch(imgbbResponse.data.delete_url, { method: 'DELETE' });
        } catch (deleteError) {
          console.error('Failed to delete image from ImgBB:', deleteError);
        }
        throw new Error(`Database error: ${dbError.message}`);
      }

      // If folder specified, add to folder
      if (folderId) {
        const folderImageData = {
          folder_id: folderId,
          image_id: dbImage.id,
        };

        const { error: folderError } = await supabase
          .from('folder_images')
          .insert(folderImageData);

        if (folderError) {
          console.error('Failed to add image to folder:', folderError);
        }
      }

      // Return UploadedImage format
      return {
        id: dbImage.id,
        file,
        url: imgbbResponse.data.url, // Full quality image
        preview: imgbbResponse.data.url, // Use full quality for preview
        permanentUrl: imgbbResponse.data.url,
        deleteUrl: imgbbResponse.data.delete_url,
        filename: file.name,
        fileSize: file.size,
        mimeType: file.type,
        width: dimensions.width,
        height: dimensions.height,
      };
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  },

  // Load root-level images (not in any folder) for current user
  async loadImages(): Promise<UploadedImage[]> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        return [];
      }

      const user = session.user;

      // Load images that are NOT in any folder (root-level images only)
      const { data: images, error } = await supabase
        .from('images')
        .select(`
          *,
          folder_images!left (
            id
          )
        `)
        .eq('user_id', user.id)
        .is('folder_images.id', null) // Only images with no folder association
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Failed to load images:', error);
        // If table doesn't exist, return empty array
        if (error.code === 'PGRST205') {
          console.log('Images table does not exist yet');
          return [];
        }
        return [];
      }

      console.log('🖼️ Loaded root images (not in folders):', images?.length || 0);

      // Convert to UploadedImage format
      const uploadedImages = images.map(img => ({
        id: img.id,
        file: new File([], img.filename, { type: img.mime_type }), // Placeholder file
        url: img.file_path, // This is the full quality image URL
        preview: img.file_path, // Use full quality for preview too
        permanentUrl: img.file_path,
        filename: img.filename,
        fileSize: img.file_size,
        mimeType: img.mime_type,
        width: img.width || undefined,
        height: img.height || undefined,
        aspectRatio: img.aspect_ratio || undefined, // Include aspect ratio from database
      }));

      return uploadedImages;
    } catch (error) {
      console.error('Failed to load images:', error);
      return [];
    }
  },

  // Create folder
  async createFolder(name: string, parentId?: string): Promise<Folder> {
    try {
      console.log('📁 createFolder called:', { name, parentId });

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        console.error('❌ User not authenticated:', sessionError);
        throw new Error('User not authenticated');
      }

      const user = session.user;
      console.log('👤 User authenticated:', user.id);

      // Ensure user exists in public.users table
      const { data: userRecord, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      console.log('👤 User record check:', { exists: !!userRecord, error: selectError?.message });

      if (selectError && selectError.code === 'PGRST116') { // No rows returned
        console.log('👤 Creating user record...');
        // Create user record if it doesn't exist
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
          });
        if (insertError) {
          console.error('❌ Failed to create user record:', insertError);
          throw new Error('Failed to create user record');
        }
        console.log('✅ User record created');
      }

      const folderData = {
        user_id: user.id,
        name,
        parent_id: parentId || null,
      };

      console.log('📁 Inserting folder data:', folderData);

      const { data: folder, error } = await supabase
        .from('folders')
        .insert(folderData)
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create folder in database:', error);
        throw new Error(`Failed to create folder: ${error.message}`);
      }

      console.log('✅ Folder created successfully:', folder);

      return {
        id: folder.id,
        name: folder.name,
        created_at: folder.created_at,
        parent_id: folder.parent_id,
        images: [], // Will be populated when loading
      };
    } catch (error) {
      console.error('❌ Failed to create folder:', error);
      throw error;
    }
  },

  // Load all folders for current user
  async loadFolders(): Promise<Folder[]> {
    try {
      console.log('📁 loadFolders called');

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        console.log('❌ User not authenticated for loadFolders');
        return [];
      }

      const user = session.user;
      console.log('👤 Loading folders for user:', user.id);

      // First load folders - handle if table doesn't exist
      const { data: folders, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (foldersError) {
        console.error('❌ Failed to load folders:', foldersError);
        // If table doesn't exist, return empty array
        if (foldersError.code === 'PGRST205') {
          console.log('📁 Folders table does not exist yet');
          return [];
        }
        return [];
      }

      console.log('📁 Raw folders data from database:', folders);

      // Load images for each folder
      const foldersWithImages = await Promise.all(folders.map(async (folder) => {
        console.log('📁 Loading images for folder:', folder.name, folder.id);

        // Get images for this folder
        const { data: folderImages, error: folderImagesError } = await supabase
          .from('folder_images')
          .select(`
            image_id,
            images (
              id,
              filename,
              file_path,
              file_size,
              mime_type,
              width,
              height
            )
          `)
          .eq('folder_id', folder.id);

        if (folderImagesError) {
          console.error('❌ Failed to load folder images:', folderImagesError);
          return {
            id: folder.id,
            name: folder.name,
            created_at: folder.created_at,
            parent_id: folder.parent_id,
            images: [],
          };
        }

        console.log('🖼️ Folder images data:', folderImages);

        // Convert to UploadedImage format
        const folderImageList = folderImages
          .filter(fi => fi.images) // Filter out null images
          .map(fi => {
            const image = fi.images as any;
            return {
              id: image.id,
              file: new File([], image.filename, { type: image.mime_type }),
              url: image.file_path,
              preview: image.file_path,
              permanentUrl: image.file_path,
              filename: image.filename,
              fileSize: image.file_size,
              mimeType: image.mime_type,
              width: image.width || undefined,
              height: image.height || undefined,
              aspectRatio: image.aspect_ratio || undefined, // Include aspect ratio from database
            };
          });

        console.log('📁 Folder processed:', {
          id: folder.id,
          name: folder.name,
          imageCount: folderImageList.length
        });

        return {
          id: folder.id,
          name: folder.name,
          created_at: folder.created_at,
          parent_id: folder.parent_id,
          images: folderImageList,
        };
      }));

      console.log('✅ Final folders with images:', foldersWithImages.map(f => ({
        id: f.id,
        name: f.name,
        imageCount: f.images.length
      })));

      return foldersWithImages;
    } catch (error) {
      console.error('❌ Failed to load folders:', error);
      return [];
    }
  },

  // Move images to folder
  async moveImagesToFolder(imageIds: string[], folderId: string): Promise<void> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      const user = session.user;

      // Remove existing folder associations
      await supabase
        .from('folder_images')
        .delete()
        .in('image_id', imageIds);

      // Add to new folder
      const folderImageData = imageIds.map(imageId => ({
        folder_id: folderId,
        image_id: imageId,
      }));

      const { error } = await supabase
        .from('folder_images')
        .insert(folderImageData);

      if (error) {
        throw new Error(`Failed to move images to folder: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to move images to folder:', error);
      throw error;
    }
  },

  // Remove images from any folder (move to root)
  async removeImagesFromFolder(imageIds: string[]): Promise<void> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      // Remove existing folder associations
      const { error } = await supabase
        .from('folder_images')
        .delete()
        .in('image_id', imageIds);

      if (error) {
        throw new Error(`Failed to remove images from folder: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to remove images from folder:', error);
      throw error;
    }
  },

  // Delete image
  async deleteImage(imageId: string): Promise<void> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      const user = session.user;

      // Get image data first to get delete URL
      const { data: image, error: fetchError } = await supabase
        .from('images')
        .select('*')
        .eq('id', imageId)
        .eq('user_id', user.id)
        .single();

      if (fetchError) {
        throw new Error(`Failed to fetch image: ${fetchError.message}`);
      }

      // Delete from database first
      const { error: deleteError } = await supabase
        .from('images')
        .delete()
        .eq('id', imageId)
        .eq('user_id', user.id);

      if (deleteError) {
        throw new Error(`Failed to delete image from database: ${deleteError.message}`);
      }

      // Note: FreeImage.host URLs don't have delete URLs in the stored data
      // In a production app, you'd want to store the delete URL separately
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw error;
    }
  },

  // Delete folder and all its contents
  async deleteFolder(folderId: string): Promise<void> {
    try {
      console.log('🗑️ deleteFolder called:', folderId);

      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        console.error('❌ User not authenticated for deleteFolder');
        throw new Error('User not authenticated');
      }

      const user = session.user;
      console.log('👤 Deleting folder for user:', user.id);

      // First, delete all folder_images associations for this folder
      console.log('🗑️ Deleting folder_images associations...');
      const { error: folderImagesError } = await supabase
        .from('folder_images')
        .delete()
        .eq('folder_id', folderId);

      if (folderImagesError) {
        console.error('❌ Failed to delete folder images:', folderImagesError);
        throw new Error(`Failed to delete folder images: ${folderImagesError.message}`);
      }
      console.log('✅ Folder images associations deleted');

      // Get all subfolders recursively
      console.log('🔍 Getting subfolders...');
      const subfolders = await this.getAllSubfolders(folderId, user.id);
      console.log('📁 Found subfolders:', subfolders);

      // Delete all subfolders and their contents
      for (const subfolderId of subfolders) {
        console.log('🗑️ Deleting subfolder:', subfolderId);
        await this.deleteFolderRecursive(subfolderId);
      }

      // Finally, delete the folder itself
      console.log('🗑️ Deleting main folder...');
      const { error: folderError } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId)
        .eq('user_id', user.id);

      if (folderError) {
        console.error('❌ Failed to delete folder:', folderError);
        throw new Error(`Failed to delete folder: ${folderError.message}`);
      }

      console.log('✅ Folder deleted successfully:', folderId);
    } catch (error) {
      console.error('❌ Failed to delete folder:', error);
      throw error;
    }
  },

  // Rename folder
  async renameFolder(folderId: string, newName: string): Promise<void> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      const user = session.user;

      const { error } = await supabase
        .from('folders')
        .update({ name: newName.trim() })
        .eq('id', folderId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(`Failed to rename folder: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to rename folder:', error);
      throw error;
    }
  },

  // Helper method to get all subfolders recursively
  async getAllSubfolders(parentId: string, userId: string): Promise<string[]> {
    const { data: subfolders, error } = await supabase
      .from('folders')
      .select('id')
      .eq('parent_id', parentId)
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get subfolders: ${error.message}`);
    }

    const subfolderIds: string[] = [];

    for (const subfolder of subfolders || []) {
      subfolderIds.push(subfolder.id);
      // Recursively get sub-subfolders
      const nestedSubfolders = await this.getAllSubfolders(subfolder.id, userId);
      subfolderIds.push(...nestedSubfolders);
    }

    return subfolderIds;
  },

  // Helper method to recursively delete folder contents
  async deleteFolderRecursive(folderId: string): Promise<void> {
    // Delete all folder_images associations
    const { error: folderImagesError } = await supabase
      .from('folder_images')
      .delete()
      .eq('folder_id', folderId);

    if (folderImagesError) {
      console.error('Failed to delete folder images during recursive deletion:', folderImagesError);
    }

    // Delete all subfolders recursively
    const { data: subfolders, error: subfoldersError } = await supabase
      .from('folders')
      .select('id')
      .eq('parent_id', folderId);

    if (!subfoldersError && subfolders) {
      for (const subfolder of subfolders) {
        await this.deleteFolderRecursive(subfolder.id);
      }
    }

    // Delete the folder itself
    const { error: folderError } = await supabase
      .from('folders')
      .delete()
      .eq('id', folderId);

    if (folderError) {
      console.error('Failed to delete folder during recursive deletion:', folderError);
    }
  },

  /**
   * Legacy change aspect ratio method - now uses enhanced service
   */
  async changeAspectRatio(imageIds: string[], targetAspectRatio: string): Promise<UploadedImage[]> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('User not authenticated');
    }
    
    return ImageCroppingService.changeAspectRatio(imageIds, targetAspectRatio, session.user.id);
  },

  /**
   * Prepare images for slideshow with enhanced cropping
   */
  async prepareImagesForSlideshow(
    imageIds: string[],
    targetAspectRatio: string
  ): Promise<UploadedImage[]> {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      throw new Error('User not authenticated');
    }
    
    return ImageCroppingService.prepareImagesForSlideshow(imageIds, targetAspectRatio, session.user.id);
  },

  // Create slideshow with aspect ratio
  async createSlideshow(
    imageIds: string[],
    title: string,
    description: string,
    aspectRatio: string = '9:16'
  ): Promise<string> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      const user = session.user;

      // Create slideshow
      const { data: slideshow, error: slideshowError } = await supabase
        .from('slideshows')
        .insert({
          user_id: user.id,
          title,
          description,
          aspect_ratio: aspectRatio,
        })
        .select()
        .single();

      if (slideshowError) {
        throw new Error(`Failed to create slideshow: ${slideshowError.message}`);
      }

      // Add images to slideshow with positions
      const slideshowImages = imageIds.map((imageId, index) => ({
        slideshow_id: slideshow.id,
        image_id: imageId,
        position: index,
      }));

      const { error: imagesError } = await supabase
        .from('slideshow_images')
        .insert(slideshowImages);

      if (imagesError) {
        // If adding images fails, delete the slideshow
        await supabase.from('slideshows').delete().eq('id', slideshow.id);
        throw new Error(`Failed to add images to slideshow: ${imagesError.message}`);
      }

      return slideshow.id;
    } catch (error) {
      console.error('Failed to create slideshow:', error);
      throw error;
    }
  },

  // Update slideshow aspect ratio
  async updateSlideshowAspectRatio(slideshowId: string, aspectRatio: string): Promise<void> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      const user = session.user;

      const { error } = await supabase
        .from('slideshows')
        .update({ aspect_ratio: aspectRatio })
        .eq('id', slideshowId)
        .eq('user_id', user.id);

      if (error) {
        throw new Error(`Failed to update slideshow aspect ratio: ${error.message}`);
      }
    } catch (error) {
      console.error('Failed to update slideshow aspect ratio:', error);
      throw error;
    }
  },
};
