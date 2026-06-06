import { api } from './api';

export interface DeleteAccountBody {
  password?: string;
  idToken?: string;
}

function filenameFromDisposition(header: string | undefined): string {
  if (!header) return 'my-data.json';
  const match = /filename="?([^";\n]+)"?/i.exec(header);
  return match?.[1]?.trim() || 'my-data.json';
}

export const accountApi = {
  exportData: (): Promise<{ blob: Blob; filename: string }> =>
    api
      .get<Blob>('/account/export', { responseType: 'blob' })
      .then(r => ({
        blob: r.data,
        filename: filenameFromDisposition(
          typeof r.headers['content-disposition'] === 'string'
            ? r.headers['content-disposition']
            : undefined,
        ),
      })),

  deleteAccount: (body: DeleteAccountBody): Promise<void> =>
    api.post('/account/delete', body).then(() => undefined),
};
