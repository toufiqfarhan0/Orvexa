import React, { createContext, useContext, useState, useEffect } from 'react';

/**
 * Normalizes a URL pathname by trimming redundant trailing slashes while preserving root '/'.
 */
export function normalizePath(path: string | undefined | null): string {
  if (!path || path === '/') return '/';
  const withoutHash = path.split('#')[0];
  const trimmed = withoutHash.trim().replace(/\/+$/, '');
  return trimmed === '' ? '/' : trimmed;
}

interface RouterContextType {
  currentPath: string;
  navigate: (path: string) => void;
}

const RouterContext = createContext<RouterContextType>({
  currentPath: '/',
  navigate: () => {},
});

export const useRouter = () => useContext(RouterContext);

export const RouterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentPath, setCurrentPath] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return normalizePath(window.location.pathname);
    }
    return '/';
  });

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(normalizePath(window.location.pathname));
      if (window.location.hash) {
        const id = window.location.hash.replace(/^#/, '');
        setTimeout(() => {
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }, 50);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigate = (path: string) => {
    if (typeof window !== 'undefined') {
      const parts = path.split('#');
      const targetPath = normalizePath(parts[0]);
      const hash = parts[1];
      const fullTarget = hash ? `${targetPath}#${hash}` : targetPath;

      const pathChanged = normalizePath(window.location.pathname) !== targetPath;
      if (pathChanged || window.location.hash !== (hash ? `#${hash}` : '')) {
        window.history.pushState(null, '', fullTarget);
        setCurrentPath(targetPath);
        if (hash) {
          setTimeout(() => {
            const el = document.getElementById(hash);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth' });
            }
          }, 100);
        } else {
          window.scrollTo(0, 0);
        }
      }
    }
  };

  return (
    <RouterContext.Provider value={{ currentPath, navigate }}>{children}</RouterContext.Provider>
  );
};
