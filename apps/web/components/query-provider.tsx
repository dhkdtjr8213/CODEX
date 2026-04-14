"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// NOTE: Workspace has mixed React type versions (web/react19 + mobile/react18).
// Keep provider boundary flexible to avoid cross-package ReactNode mismatch.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function WebQueryProvider({ children }: { children: any }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 10,
            refetchOnWindowFocus: false
          }
        }
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
