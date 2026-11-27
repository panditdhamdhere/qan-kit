import type { ReactNode } from 'react';
import { Providers } from '../lib/wagmi';
import './globals.css';

export const metadata = {
  title: 'QAN notary',
  description: 'Anchor a Merkle root of file hashes on QAN testnet',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <main>
            <nav>
              <strong>QAN notary</strong>
              <a href="/">Upload</a>
              <a href="/anchor">Anchor</a>
              <a href="/verify">Verify</a>
            </nav>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
