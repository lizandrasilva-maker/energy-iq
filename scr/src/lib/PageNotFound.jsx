import { useLocation } from 'react-router-dom';
import { base44 } from '../api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function PageNotFound() {
  const location = useLocation();
  const pageName = location.pathname.substring(1);

  const { data: authData } = useQuery({
    queryKey: ['user'],
    queryFn: async () => {
      try {
        if (base44?.auth?.me) {
          const user = await base44.auth.me();
          return { user, isAuthenticated: true };
        }
        return { user: null, isAuthenticated: false };
      } catch {
        return { user: null, isAuthenticated: false };
      }
    }
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-50">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold text-slate-800 mb-2">404</h1>
        <p className="text-lg text-slate-600 mb-4">
          A página <code className="bg-slate-200 px-2 py-1 rounded">{pageName}</code> não foi encontrada.
        </p>
        {authData?.isAuthenticated && (
          <p className="text-sm text-slate-500">
            Sessão iniciada como: {authData.user?.name || authData.user?.email}
          </p>
        )}
      </div>
    </div>
  );
}