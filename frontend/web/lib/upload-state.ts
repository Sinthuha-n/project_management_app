export type UploadState = 'validating' | 'reserved' | 'uploading' | 'finalizing' | 'visible' | 'failed' | 'cancelled';

export const UPLOAD_STATE_MESSAGE: Record<UploadState, string> = {
  validating: 'Validating file…', reserved: 'Preparing secure upload…', uploading: 'Uploading file…',
  finalizing: 'Validating and scanning file…', visible: 'Upload complete.',
  failed: 'Upload failed. Your file was not made visible.', cancelled: 'Upload cancelled.',
};
