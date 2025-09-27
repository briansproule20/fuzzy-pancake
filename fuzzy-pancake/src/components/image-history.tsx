'use client';

import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  handleImageCopy,
  handleImageDownload,
  handleImageToFile,
  isImageActionable,
} from '@/lib/image-actions';
import { deleteImageFromLocal } from '@/lib/local-db';
import type { GeneratedImage } from '@/lib/types';
import { Copy, Download, Trash2 } from 'lucide-react';
import NextImage from 'next/image';
import React, { useCallback, useEffect, useState } from 'react';
import { ImageDetailsDialog } from './image-details-dialog';

/**
 * Self-contained loading timer component
 * Only this component re-renders every 100ms, preventing parent re-renders
 */
const LoadingTimer = React.memo(function LoadingTimer({
  startTime,
}: {
  startTime: Date;
}) {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      forceUpdate(n => n + 1);
    }, 100); // Update every 100ms for smooth animation

    return () => clearInterval(timer);
  }, []);

  const elapsed = (Date.now() - startTime.getTime()) / 1000;
  return (
    <div className="text-xs text-gray-500 font-mono">{elapsed.toFixed(1)}s</div>
  );
});

interface ImageHistoryItemProps {
  image: GeneratedImage;
  onImageClick: (image: GeneratedImage) => void;
  onDelete: (imageId: string) => void;
}

const ImageHistoryItem = React.memo(function ImageHistoryItem({
  image,
  onImageClick,
  onDelete,
}: ImageHistoryItemProps) {

  const handleImageClick = useCallback(() => {
    onImageClick(image);
  }, [image, onImageClick]);

  const handleDownload = useCallback(() => {
    if (!isImageActionable(image)) return;

    handleImageDownload(image.imageUrl!, image.id);
  }, [image]);

  const handleCopy = useCallback(async () => {
    if (!isImageActionable(image)) return;
    await handleImageCopy(image.imageUrl!);
  }, [image]);

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this image?')) {
      onDelete(image.id);
    }
  }, [image.id, onDelete]);

  return (
    <div
      onClick={handleImageClick}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleImageClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Open details for image: ${image.prompt.slice(0, 50)}${image.prompt.length > 50 ? '...' : ''}`}
      className="relative aspect-square bg-gray-100 rounded-lg overflow-hidden border border-gray-200 group cursor-pointer hover:shadow-lg focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all animate-in fade-in slide-in-from-left-4 duration-500"
    >
      {image.isLoading ? (
        <div className="flex flex-col items-center justify-center h-full space-y-2 p-4">
          <Skeleton className="h-16 w-16 rounded-lg" />
          <LoadingTimer startTime={image.timestamp} />
        </div>
      ) : image.error ? (
        <div className="flex flex-col items-center justify-center h-full space-y-2 p-4">
          <div className="text-red-500 text-sm">⚠️ Failed</div>
          <div className="text-xs text-gray-500 text-center">{image.error}</div>
        </div>
      ) : image.imageUrl ? (
        <>
          <NextImage
            src={image.imageUrl}
            alt={image.prompt}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, (max-width: 1280px) 20vw, 16.6vw"
          />
          <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200">
            <Button
              size="sm"
              onClick={handleDelete}
              aria-label="Delete image"
              title="Delete image"
              className="h-8 w-8 p-0 bg-red-500/90 hover:bg-red-600 shadow-lg text-white hover:scale-110 active:scale-95 transition-transform duration-150 focus:ring-2 focus:ring-red-500"
              disabled={!isImageActionable(image)}
            >
              <Trash2 size={14} />
            </Button>
            <Button
              size="sm"
              onClick={e => {
                e.stopPropagation();
                handleCopy();
              }}
              aria-label="Copy image to clipboard"
              title="Copy image"
              className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-lg text-gray-700 hover:text-gray-900 cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-150 focus:ring-2 focus:ring-blue-500"
              disabled={!isImageActionable(image)}
            >
              <Copy size={14} />
            </Button>
            <Button
              size="sm"
              onClick={e => {
                e.stopPropagation();
                handleDownload();
              }}
              aria-label="Download image"
              title="Download image"
              className="h-8 w-8 p-0 bg-white/90 hover:bg-white shadow-lg text-gray-700 hover:text-gray-900 cursor-pointer hover:scale-110 active:scale-95 transition-transform duration-150 focus:ring-2 focus:ring-blue-500"
              disabled={!isImageActionable(image)}
            >
              <Download size={14} />
            </Button>
          </div>
        </>
      ) : (
        <div className="flex items-center justify-center h-full text-gray-400">
          No image
        </div>
      )}
    </div>
  );
});

interface ImageHistoryProps {
  imageHistory: GeneratedImage[];
  isLoading?: boolean;
  onDeleteImage?: (imageId: string) => void;
}

export const ImageHistory = React.memo(function ImageHistory({
  imageHistory,
  isLoading = false,
  onDeleteImage,
}: ImageHistoryProps) {
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(
    null
  );

  // Memoize callbacks to prevent unnecessary re-renders
  const handleImageClick = useCallback((image: GeneratedImage) => {
    setSelectedImage(image);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setSelectedImage(null);
  }, []);

  const handleDelete = useCallback(async (imageId: string) => {
    try {
      await deleteImageFromLocal(imageId);
      onDeleteImage?.(imageId);
    } catch (error) {
      console.error('Error deleting image:', error);
    }
  }, [onDeleteImage]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">Generated Images</h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
              <Skeleton className="w-full h-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (imageHistory.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-gray-900">Generated Images</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 transition-all duration-300 ease-out">
        {imageHistory.map(image => (
          <ImageHistoryItem
            key={image.id}
            image={image}
            onImageClick={handleImageClick}
            onDelete={handleDelete}
          />
        ))}
      </div>

      <ImageDetailsDialog
        image={selectedImage}
        onClose={handleCloseDialog}
      />
    </div>
  );
});
