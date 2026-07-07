'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import api from '@/lib/axios';
import { normalizeApiError } from '@/lib/api-error';

export default function GitHubCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state'); // projectId or profile

    if (!code) {
      setError('No authorization code received from GitHub.');
      return;
    }

    const exchangeToken = async () => {
      try {
        const res = await api.post('/api/github/token', { code });

        if (res.data?.error) {
          throw new Error(res.data.error_description || res.data.error || 'Token exchange failed');
        }

        // Fetch the updated user profile from the backend to get the newly linked githubUsername
        const profileRes = await api.get('/api/user/profile');
        if (profileRes.data) {
          localStorage.setItem('userProfile', JSON.stringify(profileRes.data));
        }

        if (state === 'profile') {
          router.replace('/profile?github_connected=1');
        } else if (state) {
          router.replace(`/github/${state}?select_repo=1`);
        } else {
          router.replace('/dashboard');
        }
      } catch (err: unknown) {
        setError(normalizeApiError(err, 'GitHub authentication failed'));
      }
    };

    void exchangeToken();
  }, [searchParams, router]);
  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center">
          <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
            <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="text-slate-700 font-outfit font-semibold text-center">{error}</p>
        <button
          onClick={() => router.replace('/dashboard')}
          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 font-outfit font-semibold text-sm hover:bg-slate-200 transition-colors"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-blue-100 animate-pulse" />
      <p className="text-slate-400 font-outfit font-medium text-sm">Connecting to GitHub…</p>
    </div>
  );
}
