'use client';

import { ConnectionProvider } from '@/hooks/useConnection';
import { Quiz } from '@/components/Quiz';

export default function Home() {
  return (
    <ConnectionProvider>
      <Quiz />
    </ConnectionProvider>
  );
}
