import { supabase } from './supabase';
import { uploadToImgbb, getImageDimensions } from './imgbb';
import { UploadedImage, Folder } from '@/types';
import { cropImage, parseAspectRatio, batchCropImages } from './aspectRatio';

export const imageService = {
  // Upload image to imgbb and save metadata to Supabase
  async uploadImage(file: File, folderId?: string): Promise<UploadedImage> {
    try {
      // Get current user
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      const user = session.user;

      // Upload to imgbb
      const imgbbResponse = await uploadToImgbb(file);
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
        // If database save fails, try to delete from imgbb
        try {
          await fetch(imgbbResponse.data.delete_url, { method: 'DELETE' });
        } catch (deleteError) {
          console.error('Failed to delete image from imgbb:', deleteError);
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

  // Load all images for current user
  async loadImages(): Promise<UploadedImage[]> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        return [];
      }

      const user = session.user;

      // Try to load from images table, but handle if table doesn't exist
      const { data: images, error } = await supabase
        .from('images')
        .select('*')
        .eq('user_id', user.id)
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
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      const user = session.user;

      // Ensure user exists in public.users table
      const { data: userRecord, error: selectError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (selectError && selectError.code === 'PGRST116') { // No rows returned
        // Create user record if it doesn't exist
        const { error: insertError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: user.email,
          });
        if (insertError) {
          console.error('Failed to create user record:', insertError);
          throw new Error('Failed to create user record');
        }
      }

      const folderData = {
        user_id: user.id,
        name,
        parent_id: parentId || null,
      };

      const { data: folder, error } = await supabase
        .from('folders')
        .insert(folderData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create folder: ${error.message}`);
      }

      return {
        id: folder.id,
        name: folder.name,
        created_at: folder.created_at,
        parent_id: folder.parent_id,
        images: [], // Will be populated when loading
      };
    } catch (error) {
      console.error('Failed to create folder:', error);
      throw error;
    }
  },

  // Load all folders for current user
  async loadFolders(): Promise<Folder[]> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        return [];
      }

      const user = session.user;

      // First load folders - handle if table doesn't exist
      const { data: folders, error: foldersError } = await supabase
        .from('folders')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (foldersError) {
        console.error('Failed to load folders:', foldersError);
        // If table doesn't exist, return empty array
        if (foldersError.code === 'PGRST205') {
          console.log('Folders table does not exist yet');
          return [];
        }
        return [];
      }

      

      // Load images for each folder
      const foldersWithImages = await Promise.all(folders.map(async (folder) => {
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
          console.error('Failed to load folder images:', folderImagesError);
          return {
            id: folder.id,
            name: folder.name,
            created_at: folder.created_at,
            parent_id: folder.parent_id,
            images: [],
          };
        }

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

        return {
          id: folder.id,
          name: folder.name,
          created_at: folder.created_at,
          parent_id: folder.parent_id,
          images: folderImageList,
        };
      }));

      return foldersWithImages;
    } catch (error) {
      console.error('Failed to load folders:', error);
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

      // Note: imgbb URLs don't have delete URLs in the stored data
      // In a production app, you'd want to store the delete URL separately
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw error;
    }
  },

  // Delete folder and all its contents
  async deleteFolder(folderId: string): Promise<void> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      const user = session.user;

      // First, delete all folder_images associations for this folder
      const { error: folderImagesError } = await supabase
        .from('folder_images')
        .delete()
        .eq('folder_id', folderId);

      if (folderImagesError) {
        throw new Error(`Failed to delete folder images: ${folderImagesError.message}`);
      }

      // Get all subfolders recursively
      const subfolders = await this.getAllSubfolders(folderId, user.id);

      // Delete all subfolders and their contents
      for (const subfolderId of subfolders) {
        await this.deleteFolderRecursive(subfolderId);
      }

      // Finally, delete the folder itself
      const { error: folderError } = await supabase
        .from('folders')
        .delete()
        .eq('id', folderId)
        .eq('user_id', user.id);

      if (folderError) {
        throw new Error(`Failed to delete folder: ${folderError.message}`);
      }
    } catch (error) {
      console.error('Failed to delete folder:', error);
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

  // Change aspect ratio of images with improved cropping
  async changeAspectRatio(imageIds: string[], targetAspectRatio: string): Promise<UploadedImage[]> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        throw new Error('User not authenticated');
      }

      const user = session.user;

      // Get image data for all selected images
      const { data: images, error: fetchError } = await supabase
        .from('images')
        .select('*')
        .in('id', imageIds)
        .eq('user_id', user.id);

      if (fetchError) {
        throw new Error(`Failed to fetch images: ${fetchError.message}`);
      }

      if (!images || images.length === 0) {
        throw new Error('No images found');
      }

      // Skip cropping for 'free' aspect ratio
      if (targetAspectRatio === 'free') {
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

      // Use client-side cropping to avoid download issues
      const updatedImages: UploadedImage[] = [];
      
      for (const image of images) {
        try {
          
          // Load image as HTMLImageElement for client-side processing
          const img = new Image();
          img.crossOrigin = 'anonymous';
          
          await new Promise((resolve, reject) => {
            img.onload = resolve;
            img.onerror = reject;
            img.src = image.file_path;
          });

          // Calculate crop dimensions
          const currentAspectRatio = img.width / img.height;
          let newWidth: number;
          let newHeight: number;

          if (currentAspectRatio > numericAspectRatio) {
            // Image is wider than target, crop width
            newHeight = img.height;
            newWidth = Math.round(img.height * numericAspectRatio);
          } else {
            // Image is taller than target, crop height
            newWidth = img.width;
            newHeight = Math.round(img.width / numericAspectRatio);
          }

          // Create canvas and crop
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Canvas context not available');

          canvas.width = newWidth;
          canvas.height = newHeight;

          // Center crop
          const sourceX = Math.max(0, Math.round((img.width - newWidth) / 2));
          const sourceY = Math.max(0, Math.round((img.height - newHeight) / 2));

          ctx.drawImage(
            img,
            sourceX, sourceY, newWidth, newHeight, // Source rectangle
            0, 0, newWidth, newHeight // Destination rectangle
          );

          // Convert to blob
          const blob = await new Promise<Blob>((resolve, reject) => {
            canvas.toBlob((b) => {
              if (b) resolve(b);
              else reject(new Error('Failed to create blob'));
            }, 'image/jpeg', 0.9);
          });

          // Create new file
          const newFile = new File([blob], image.filename, { type: 'image/jpeg' });

          // Upload to imgbb
          const imgbbResponse = await uploadToImgbb(newFile);

          // Update database with new dimensions and aspect ratio
          const { data: updatedImage, error: updateError } = await supabase
            .from('images')
            .update({
              file_path: imgbbResponse.data.url,
              width: newWidth,
              height: newHeight,
              file_size: blob.size,
              aspect_ratio: targetAspectRatio,
            })
            .eq('id', image.id)
            .eq('user_id', user.id)
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
            fileSize: blob.size,
            mimeType: 'image/jpeg',
            width: newWidth,
            height: newHeight,
            aspectRatio: targetAspectRatio,
          };
          
          updatedImages.push(updatedImageData);
          
        } catch (imageError) {
          console.error(`Failed to process image ${image.id}:`, imageError);
          // Add original image without cropping on error
          updatedImages.push({
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
          });
        }
      }

      return updatedImages;
    } catch (error) {
      console.error('Failed to change aspect ratios:', error);
      throw error;
    }
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
