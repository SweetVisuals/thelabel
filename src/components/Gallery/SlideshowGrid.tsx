import React from 'react';
import { Download, Play, Image as ImageIcon } from 'lucide-react';
import { UploadedImage, Slideshow } from '../../types';

interface SlideshowGridProps {
  images: UploadedImage[];
}

export const SlideshowGrid: React.FC<SlideshowGridProps> = ({ images }) => {
  const groupedImages = React.useMemo(() => {
    const groups: UploadedImage[][] = [];
    for (let i = 0; i < images.length; i += 3) {
      groups.push(images.slice(i, i + 3));
    }
    return groups;
  }, [images]);

  const downloadSlideshow = (slideshow: UploadedImage[], index: number) => {
    // Create a zip-like download experience
    slideshow.forEach((image, imgIndex) => {
      const link = document.createElement('a');
      link.href = image.url;
      link.download = `slideshow-${index + 1}-image-${imgIndex + 1}.${image.file.name.split('.').pop()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  };

  if (images.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-24 h-24 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <ImageIcon className="w-12 h-12 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No images uploaded</h3>
        <p className="text-gray-600">Upload some images to see your TikTok slideshows here</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-semibold text-gray-900">
          Your TikTok Slideshows ({groupedImages.length})
        </h3>
        <div className="text-sm text-gray-600">
          {images.length} total images • {groupedImages.length} slideshows
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {groupedImages.map((slideshow, index) => (
          <div
            key={index}
            className="bg-white rounded-2xl shadow-md hover:shadow-xl transition-shadow duration-300 overflow-hidden"
          >
            <div className="aspect-video relative bg-gradient-to-br from-purple-100 to-pink-100">
              <div className="absolute inset-0 grid grid-cols-3 gap-1 p-2">
                {slideshow.map((image, imgIndex) => (
                  <div
                    key={image.id}
                    className="relative rounded-lg overflow-hidden bg-white shadow-sm"
                  >
                    <img
                      src={image.preview}
                      alt={`Slide ${imgIndex + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {imgIndex === 0 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-20">
                        <Play className="w-6 h-6 text-white" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-900">
                  Slideshow {index + 1}
                </h4>
                <div className="flex items-center text-sm text-gray-500">
                  <ImageIcon className="w-4 h-4 mr-1" />
                  {slideshow.length} images
                </div>
              </div>

              <p className="text-sm text-gray-600">
                Ready for TikTok upload • {slideshow.length}/3 images
              </p>

              <button
                onClick={() => downloadSlideshow(slideshow, index)}
                className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 font-medium"
              >
                <Download className="w-4 h-4 mr-2" />
                Download Slideshow
              </button>
            </div>
          </div>
        ))}
      </div>

      {images.length > 0 && images.length % 3 !== 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <ImageIcon className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Incomplete Slideshow
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  You have {images.length % 3} remaining image(s) that don't form a complete slideshow. 
                  Upload {3 - (images.length % 3)} more image(s) to create another TikTok slideshow.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};