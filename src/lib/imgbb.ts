const IMGBB_API_KEY = '424cc4e82ae2d9d31f09dc79f1fe8276';
const IMGBB_UPLOAD_URL = 'https://api.imgbb.com/1/upload';

export interface ImgbbUploadResponse {
  data: {
    id: string;
    title: string;
    url_viewer: string;
    url: string;
    display_url: string;
    width: number;
    height: number;
    size: number;
    time: string;
    expiration: string;
    image: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    thumb: {
      filename: string;
      name: string;
      mime: string;
      extension: string;
      url: string;
    };
    delete_url: string;
  };
  success: boolean;
  status: number;
}

export const uploadToImgbb = async (file: File): Promise<ImgbbUploadResponse> => {
  const formData = new FormData();
  formData.append('key', IMGBB_API_KEY);
  formData.append('image', file);

  const response = await fetch(IMGBB_UPLOAD_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Imgbb upload failed: ${response.statusText}`);
  }

  const data: ImgbbUploadResponse = await response.json();

  if (!data.success) {
    throw new Error('Imgbb upload was not successful');
  }

  return data;
};

export const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.width, height: img.height });
    };
    img.onerror = () => {
      reject(new Error('Failed to get image dimensions'));
    };
    img.src = URL.createObjectURL(file);
  });
};

export const deleteFromImgbb = async (deleteUrl: string): Promise<void> => {
  const response = await fetch(deleteUrl, {
    method: 'DELETE',
  });

  if (!response.ok) {
    throw new Error(`Imgbb delete failed: ${response.statusText}`);
  }
};