'use client';

import {
  PromptInput,
  PromptInputActionAddAttachments,
  PromptInputActionMenu,
  PromptInputActionMenuContent,
  PromptInputActionMenuTrigger,
  PromptInputAttachment,
  PromptInputAttachments,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputModelSelect,
  PromptInputModelSelectContent,
  PromptInputModelSelectItem,
  PromptInputModelSelectTrigger,
  PromptInputModelSelectValue,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
  usePromptInputAttachments,
} from '@/components/ai-elements/prompt-input';
import { Button } from '@/components/ui/button';
import { X, Upload, Image as ImageIcon, Users } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { fileToDataUrl, processImageForUpload, shouldCompressFile } from '@/lib/image-utils';
import { saveImageToLocal, loadImagesFromLocal } from '@/lib/local-db';
import type {
  EditImageRequest,
  GeneratedImage,
  GenerateImageRequest,
  ImageResponse,
  ModelConfig,
  ModelOption,
} from '@/lib/types';
import { ImageHistory } from './image-history';

declare global {
  interface Window {
    __promptInputActions?: {
      addFiles: (files: File[] | FileList) => void;
      clear: () => void;
    };
  }
}

/**
 * Available AI models for image generation
 * These models integrate with the Echo SDK to provide different image generation capabilities
 */
const models: ModelConfig[] = [
  { id: 'openai', name: 'GPT Image' },
  { id: 'gemini', name: 'Gemini Flash Image' },
];

/**
 * API functions for image generation and editing
 * These functions communicate with the Echo SDK backend routes
 */

// ===== API FUNCTIONS =====
async function generateImage(
  request: GenerateImageRequest
): Promise<ImageResponse> {
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

async function editImage(request: EditImageRequest): Promise<ImageResponse> {
  const response = await fetch('/api/edit-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errorText}`);
  }

  return response.json();
}

/**
 * Main ImageGenerator component
 *
 * This component demonstrates how to integrate Echo SDK with AI image generation:
 * - Uses PromptInput for unified input handling with attachments
 * - Supports both text-to-image generation and image editing
 * - Maintains history of all generated/edited images
 * - Provides seamless model switching between OpenAI and Gemini
 */
export default function ImageGenerator() {
  const [model, setModel] = useState<ModelOption>('gemini');
  const [imageHistory, setImageHistory] = useState<GeneratedImage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const promptInputRef = useRef<HTMLFormElement>(null);
  const [photoSlots, setPhotoSlots] = useState<{ id: string; file: File | null; preview: string | null }[]>([
    { id: 'photo1', file: null, preview: null },
    { id: 'photo2', file: null, preview: null }
  ]);
  const [usePhotoCombinePrompt, setUsePhotoCombinePrompt] = useState(false);
  const [compressionStatus, setCompressionStatus] = useState<Record<string, 'compressing' | 'compressed' | null>>({});

  // Handle adding files to the input from external triggers (like from image history)
  const handleAddToInput = useCallback((files: File[]) => {
    const actions = window.__promptInputActions;
    if (actions) {
      actions.addFiles(files);
    }
  }, []);

  // Handle deleting images from history
  const handleDeleteImage = useCallback((imageId: string) => {
    setImageHistory(prev => prev.filter(img => img.id !== imageId));
  }, []);

  const clearForm = useCallback(() => {
    promptInputRef.current?.reset();
    const actions = window.__promptInputActions;
    if (actions) {
      actions.clear();
    }
    // Clear photo slots
    setPhotoSlots([
      { id: 'photo1', file: null, preview: null },
      { id: 'photo2', file: null, preview: null }
    ]);
  }, []);

  // Handle photo slot file selection
  const handlePhotoSlotChange = useCallback(async (slotId: string, file: File | null) => {
    if (file) {
      try {
        const needsCompression = shouldCompressFile(file);
        const unsupportedFormats = ['image/avif', 'image/heic', 'image/heif'];
        const needsConversion = unsupportedFormats.includes(file.type);

        if (needsCompression || needsConversion) {
          setCompressionStatus(prev => ({ ...prev, [slotId]: 'compressing' }));
        }

        // Process the image (compress/convert if needed)
        const processedFile = await processImageForUpload(file);
        const preview = await fileToDataUrl(processedFile);

        setPhotoSlots(prev => prev.map(slot =>
          slot.id === slotId ? { ...slot, file: processedFile, preview } : slot
        ));

        if (needsCompression || needsConversion) {
          setCompressionStatus(prev => ({ ...prev, [slotId]: 'compressed' }));
          // Clear compression status after 3 seconds
          setTimeout(() => {
            setCompressionStatus(prev => ({ ...prev, [slotId]: null }));
          }, 3000);
        }
      } catch (error) {
        console.error('Error processing image:', error);
        setCompressionStatus(prev => ({ ...prev, [slotId]: null }));
        // Fallback to original file if compression fails
        const preview = await fileToDataUrl(file);
        setPhotoSlots(prev => prev.map(slot =>
          slot.id === slotId ? { ...slot, file, preview } : slot
        ));
      }
    } else {
      setPhotoSlots(prev => prev.map(slot =>
        slot.id === slotId ? { ...slot, file: null, preview: null } : slot
      ));
      setCompressionStatus(prev => ({ ...prev, [slotId]: null }));
    }
  }, []);

  // Clear individual photo slot
  const clearPhotoSlot = useCallback((slotId: string) => {
    setPhotoSlots(prev => prev.map(slot =>
      slot.id === slotId ? { ...slot, file: null, preview: null } : slot
    ));
  }, []);

  // Load saved images on component mount
  useEffect(() => {
    const loadSavedImages = async () => {
      try {
        const savedImages = await loadImagesFromLocal();
        setImageHistory(savedImages);
      } catch (error) {
        console.error('Error loading saved images:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadSavedImages();
  }, []);

  // Auto-enable photo combine prompt when both slots are filled
  useEffect(() => {
    const filledSlots = photoSlots.filter(slot => slot.file !== null);
    if (filledSlots.length === 2) {
      setUsePhotoCombinePrompt(true);
    } else if (filledSlots.length === 0) {
      setUsePhotoCombinePrompt(false);
    }
  }, [photoSlots]);

  // Custom drag and drop handler for the entire container
  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
    }
  }, []);

  const handleContainerDrop = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer?.types?.includes('Files')) {
      e.preventDefault();
    }

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      const imageFiles = files.filter(f => f.type.startsWith('image/'));

      if (imageFiles.length > 0) {
        // Fill photo slots first
        const emptySlots = photoSlots.filter(slot => slot.file === null);

        for (let i = 0; i < Math.min(imageFiles.length, emptySlots.length); i++) {
          handlePhotoSlotChange(emptySlots[i].id, imageFiles[i]);
        }

        // If there are remaining images, add to prompt input
        const remainingImages = imageFiles.slice(emptySlots.length);
        if (remainingImages.length > 0) {
          const actions = window.__promptInputActions;
          if (actions) {
            actions.addFiles(remainingImages);
          }
        }
      }
    }
  }, [photoSlots, handlePhotoSlotChange]);

  // Component to bridge PromptInput context with external file operations
  function FileInputManager() {
    const attachments = usePromptInputAttachments();

    // Custom file handler that prioritizes photo slots (for button clicks and paste)
    const customAddFiles = useCallback((files: File[] | FileList) => {
      const fileArray = Array.from(files);
      const imageFiles = fileArray.filter(f => f.type.startsWith('image/'));

      if (imageFiles.length > 0) {
        // Try to fill photo slots first
        const emptySlots = photoSlots.filter(slot => slot.file === null);

        for (let i = 0; i < Math.min(imageFiles.length, emptySlots.length); i++) {
          handlePhotoSlotChange(emptySlots[i].id, imageFiles[i]);
        }

        // If there are remaining images and photo slots are full, add to prompt input
        const remainingImages = imageFiles.slice(emptySlots.length);
        if (remainingImages.length > 0) {
          attachments.add(remainingImages);
        }
      }

      // Add non-image files directly to prompt input
      const nonImageFiles = fileArray.filter(f => !f.type.startsWith('image/'));
      if (nonImageFiles.length > 0) {
        attachments.add(nonImageFiles);
      }
    }, [attachments, photoSlots, handlePhotoSlotChange]);

    // Store reference to attachment actions for external use
    useEffect(() => {
      window.__promptInputActions = {
        addFiles: customAddFiles,
        clear: () => {
          attachments.clear();
          setPhotoSlots([
            { id: 'photo1', file: null, preview: null },
            { id: 'photo2', file: null, preview: null }
          ]);
        },
      };

      return () => {
        delete window.__promptInputActions;
      };
    }, [attachments, customAddFiles]);

    return null;
  }

  /**
   * Handles form submission for both image generation and editing
   * - Text-only: generates new image using selected model
   * - Text + attachments: edits uploaded images using Gemini
   */
  const handleSubmit = useCallback(
    async (message: PromptInputMessage) => {
      const hasText = Boolean(message.text?.trim());
      const hasAttachments = Boolean(message.files?.length);
      const hasPhotoSlots = photoSlots.some(slot => slot.file !== null);

      const isEdit = hasAttachments || hasPhotoSlots;
      let prompt = message.text?.trim() || '';

      // Apply system prompt for photo combination if enabled and we have two photos
      const hasPhotoCombineConditions = usePhotoCombinePrompt && photoSlots.filter(slot => slot.file !== null).length === 2;
      if (hasPhotoCombineConditions) {
        const systemPrompt = "Place the people from both photos together in a natural, realistic scene. Position them side by side or in a natural group arrangement as if they're genuinely together. Match the lighting, shadows, and color tones across both subjects. Ensure consistent image quality, focus, and style. Create a seamless, believable composition where both people appear to be in the same location at the same time.";
        prompt = prompt ? `${systemPrompt} ${prompt}` : systemPrompt;
      }

      // Require either text prompt (including system prompt), attachments, or photo slots
      if (!(prompt || hasAttachments || hasPhotoSlots)) {
        return;
      }

      // Combine photo slot files with regular attachments
      const photoSlotFiles = photoSlots
        .filter(slot => slot.file !== null)
        .map(slot => ({
          url: slot.preview!,
          filename: slot.file!.name,
          mediaType: slot.file!.type,
          type: 'file' as const
        }));

      const allFiles = [
        ...(message.files || []),
        ...photoSlotFiles
      ];

      // Debug logging
      console.log('Debug - handleSubmit:', {
        hasText,
        hasAttachments,
        hasPhotoSlots,
        prompt,
        usePhotoCombinePrompt,
        hasPhotoCombineConditions,
        photoSlotFiles: photoSlotFiles.length,
        allFiles: allFiles.length
      });

      // Generate unique ID for this request
      const imageId = `img_${Date.now()}`;

      // Convert attachment blob URLs to permanent data URLs for persistent display
      const attachmentDataUrls =
        allFiles && allFiles.length > 0
          ? await Promise.all(
              allFiles
                .filter(f => f.mediaType?.startsWith('image/'))
                .map(async f => {
                  try {
                    // If it's already a data URL from photo slots, use it directly
                    if (f.url.startsWith('data:')) {
                      return f.url;
                    }
                    const response = await fetch(f.url);
                    const blob = await response.blob();
                    return await fileToDataUrl(
                      new File([blob], f.filename || 'image', {
                        type: f.mediaType,
                      })
                    );
                  } catch (error) {
                    console.error(
                      'Failed to convert attachment to data URL:',
                      error
                    );
                    return f.url; // fallback
                  }
                })
            )
          : undefined;

      // Create placeholder entry immediately for optimistic UI
      const placeholderImage: GeneratedImage = {
        id: imageId,
        prompt,
        model: model,
        timestamp: new Date(),
        attachments: attachmentDataUrls,
        isEdit,
        isLoading: true,
      };

      // Add to history immediately for responsive UI
      setImageHistory(prev => [placeholderImage, ...prev]);

      try {
        let imageUrl: ImageResponse['imageUrl'];

        if (isEdit) {
          const imageFiles = allFiles.filter(
            file =>
              file.mediaType?.startsWith('image/') || file.type === 'file'
          );

          if (imageFiles.length === 0) {
            throw new Error('No image files found in attachments');
          }

          try {
            const imageUrls = await Promise.all(
              imageFiles.map(async imageFile => {
                // If it's already a data URL from photo slots, use it directly
                if (imageFile.url.startsWith('data:')) {
                  return imageFile.url;
                }
                // Convert blob URL to data URL for API
                const response = await fetch(imageFile.url);
                const blob = await response.blob();
                return await fileToDataUrl(
                  new File([blob], 'image', { type: imageFile.mediaType })
                );
              })
            );

            const result = await editImage({
              prompt,
              imageUrls,
              provider: model,
            });
            imageUrl = result.imageUrl;
          } catch (error) {
            console.error('Error processing image files:', error);
            throw error;
          }
        } else {
          const result = await generateImage({ prompt, model });
          imageUrl = result.imageUrl;
        }

        // Update the existing placeholder entry with the result
        const updatedImage = { ...placeholderImage, imageUrl, isLoading: false };
        setImageHistory(prev =>
          prev.map(img =>
            img.id === imageId ? updatedImage : img
          )
        );

        // Save to local storage
        try {
          await saveImageToLocal(updatedImage);
        } catch (error) {
          console.error('Error saving image to local storage:', error);
        }
      } catch (error) {
        console.error(
          `Error ${isEdit ? 'editing' : 'generating'} image:`,
          error
        );

        // Update the placeholder entry with error state
        setImageHistory(prev =>
          prev.map(img =>
            img.id === imageId
              ? {
                  ...img,
                  isLoading: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : 'Failed to generate image',
                }
              : img
          )
        );
      }
    },
    [model, photoSlots, usePhotoCombinePrompt]
  );

  return (
    <div
      className="space-y-6"
      onDragOver={handleContainerDragOver}
      onDrop={handleContainerDrop}
    >
      {/* Photo Slots */}
      <div className="grid grid-cols-2 gap-4">
        {photoSlots.map((slot, index) => (
          <div key={slot.id} className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Photo {index + 1}
            </label>
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  handlePhotoSlotChange(slot.id, file);
                }}
                className="hidden"
                id={`photo-slot-${slot.id}`}
              />
              <label
                htmlFor={`photo-slot-${slot.id}`}
                className={`
                  relative block w-full h-32 border-2 border-dashed rounded-lg cursor-pointer transition-colors overflow-hidden
                  ${slot.file ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-gray-400 bg-gray-50 hover:bg-gray-100'}
                `}
              >
                {slot.preview ? (
                  <>
                    <img
                      src={slot.preview}
                      alt={`Photo ${index + 1} - ${slot.file?.name}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white text-xs p-1 truncate">
                      {slot.file?.name}
                    </div>
                    {compressionStatus[slot.id] === 'compressing' && (
                      <div className="absolute inset-0 bg-blue-500 bg-opacity-75 flex items-center justify-center">
                        <div className="text-white text-xs font-medium">Compressing...</div>
                      </div>
                    )}
                    {compressionStatus[slot.id] === 'compressed' && (
                      <div className="absolute top-2 left-2 bg-green-500 text-white rounded-full px-2 py-1 text-xs font-medium">
                        Compressed
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        clearPhotoSlot(slot.id);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg"
                    >
                      <X size={14} />
                    </button>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-400">
                    <Upload size={24} className="mb-2" />
                    <span className="text-sm">Click to upload</span>
                    <span className="text-xs text-gray-300">JPG, PNG, etc.</span>
                  </div>
                )}
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* Photo Combine Settings */}
      {photoSlots.some(slot => slot.file !== null) && (
        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border">
          <div className="flex items-center space-x-3">
            <Users className="w-5 h-5 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                Photo Combination Mode
              </p>
              <p className="text-xs text-gray-500">
                {photoSlots.filter(slot => slot.file !== null).length}/2 photos loaded • Combines people from uploaded photos
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={usePhotoCombinePrompt}
                onChange={(e) => setUsePhotoCombinePrompt(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            {usePhotoCombinePrompt && photoSlots.filter(slot => slot.file !== null).length === 2 && (
              <span className="text-xs text-green-600 font-medium">Active</span>
            )}
          </div>
        </div>
      )}

      <PromptInput
        ref={promptInputRef}
        onSubmit={handleSubmit}
        className="relative"
        globalDrop={false}
        multiple
        accept="image/*"
      >
        <FileInputManager />
        <PromptInputBody>
          <PromptInputAttachments>
            {attachment => <PromptInputAttachment data={attachment} />}
          </PromptInputAttachments>
          <PromptInputTextarea placeholder="Describe the image you want to generate, or attach an image and describe how to edit it..." />
        </PromptInputBody>
        <PromptInputToolbar>
          <PromptInputTools>
            <PromptInputActionMenu>
              <PromptInputActionMenuTrigger />
              <PromptInputActionMenuContent>
                <PromptInputActionAddAttachments label="Add photos to slots" />
              </PromptInputActionMenuContent>
            </PromptInputActionMenu>
            <PromptInputModelSelect
              onValueChange={value => {
                setModel(value as ModelOption);
              }}
              value={model}
            >
              <PromptInputModelSelectTrigger>
                <PromptInputModelSelectValue />
              </PromptInputModelSelectTrigger>
              <PromptInputModelSelectContent>
                {models.map(model => (
                  <PromptInputModelSelectItem key={model.id} value={model.id}>
                    {model.name}
                  </PromptInputModelSelectItem>
                ))}
              </PromptInputModelSelectContent>
            </PromptInputModelSelect>
          </PromptInputTools>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearForm}
              className="h-9 w-9 p-0"
            >
              <X size={16} />
            </Button>
            <PromptInputSubmit />
          </div>
        </PromptInputToolbar>
      </PromptInput>

      <ImageHistory
        imageHistory={imageHistory}
        isLoading={isLoadingHistory}
        onDeleteImage={handleDeleteImage}
      />
    </div>
  );
}
