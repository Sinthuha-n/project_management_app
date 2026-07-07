import { DocumentItem } from '@/lib/dms';
import {
  filterDocuments,
  formatBytes,
  getDocumentTypeFilter,
  sortDocuments,
  toDateLabel,
} from './dmsUtils';
import { DocumentFilters } from './types';

describe('dmsUtils', () => {
  it('formats bytes for zero and megabytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
  });

  it('returns a readable date label', () => {
    const label = toDateLabel('2026-01-10T12:30:00.000Z');
    expect(typeof label).toBe('string');
    expect(label.length).toBeGreaterThan(0);
  });

  const baseFilters: DocumentFilters = {
    search: '',
    type: 'all',
    folderId: 'all',
    uploader: '',
    favoriteOnly: false,
    dateRange: 'all',
  };

  const documents: DocumentItem[] = [
    {
      id: 1,
      name: 'Roadmap.pdf',
      contentType: 'application/pdf',
      fileSize: 1024,
      humanReadableSize: '1 KB',
      status: 'ACTIVE',
      projectId: 1,
      latestVersionNumber: 3,
      uploadedById: 10,
      uploadedByName: 'Alex',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-10T00:00:00.000Z',
      folderId: 2,
      folderName: null,
      downloadUrl: null,
      deletedAt: null,
    },
    {
      id: 2,
      name: 'Budget.xlsx',
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      fileSize: 4096,
      status: 'ACTIVE',
      projectId: 1,
      latestVersionNumber: 1,
      uploadedById: 11,
      uploadedByName: 'Sam',
      createdAt: '2025-12-01T00:00:00.000Z',
      updatedAt: '2025-12-03T00:00:00.000Z',
      folderId: null,
      folderName: null,
      downloadUrl: null,
      deletedAt: null,
    },
    {
      id: 3,
      name: 'Launch image.png',
      contentType: 'image/png',
      fileSize: 2048,
      status: 'SOFT_DELETED',
      projectId: 1,
      latestVersionNumber: 2,
      uploadedById: 10,
      uploadedByName: 'Alex',
      createdAt: '2026-01-05T00:00:00.000Z',
      updatedAt: '2026-01-06T00:00:00.000Z',
      folderId: 3,
      folderName: 'Assets',
      downloadUrl: null,
      deletedAt: '2026-01-07T00:00:00.000Z',
    },
  ];

  it('classifies common document types', () => {
    expect(getDocumentTypeFilter('application/pdf')).toBe('pdf');
    expect(getDocumentTypeFilter('image/png')).toBe('image');
    expect(getDocumentTypeFilter('text/plain')).toBe('text');
    expect(getDocumentTypeFilter('application/octet-stream')).toBe('other');
  });

  it('searches by name, owner, type, folder, status, and version', () => {
    const folderNames = { 2: 'Planning' };

    expect(filterDocuments(documents, { ...baseFilters, search: 'roadmap' }, [], folderNames)).toHaveLength(1);
    expect(filterDocuments(documents, { ...baseFilters, search: 'sam' }, [], folderNames)).toHaveLength(1);
    expect(filterDocuments(documents, { ...baseFilters, search: 'spreadsheet' }, [], folderNames)).toHaveLength(1);
    expect(filterDocuments(documents, { ...baseFilters, search: 'planning' }, [], folderNames)).toHaveLength(1);
    expect(filterDocuments(documents, { ...baseFilters, search: 'soft_deleted' }, [], folderNames)).toHaveLength(1);
    expect(filterDocuments(documents, { ...baseFilters, search: 'v3' }, [], folderNames)).toHaveLength(1);
  });

  it('combines type, folder, uploader, favorite, and date filters', () => {
    const result = filterDocuments(
      documents,
      {
        ...baseFilters,
        type: 'pdf',
        folderId: 2,
        uploader: 'Alex',
        favoriteOnly: true,
        dateRange: 'week',
      },
      [1],
      { 2: 'Planning' },
      new Date('2026-01-12T00:00:00.000Z').getTime(),
    );

    expect(result.map((doc) => doc.id)).toEqual([1]);
  });

  it('filters root documents explicitly', () => {
    expect(filterDocuments(documents, { ...baseFilters, folderId: 'root' }, [], { 2: 'Planning' }).map((doc) => doc.id)).toEqual([2]);
  });

  it('sorts by supported fields in both directions', () => {
    expect(sortDocuments(documents, 'name', 'asc', {}).map((doc) => doc.name)).toEqual([
      'Budget.xlsx',
      'Launch image.png',
      'Roadmap.pdf',
    ]);
    expect(sortDocuments(documents, 'fileSize', 'desc', {}).map((doc) => doc.id)).toEqual([2, 3, 1]);
    expect(sortDocuments(documents, 'updatedAt', 'desc', {}).map((doc) => doc.id)).toEqual([1, 3, 2]);
    expect(sortDocuments(documents, 'latestVersionNumber', 'asc', {}).map((doc) => doc.id)).toEqual([2, 3, 1]);
  });
});
