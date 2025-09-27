import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Fuzzy Pancake',
  description: 'AI Image Generation with Fuzzy Pancake - Create stunning images using advanced AI models',
  icons: {
    icon: [
      { url: '/logo/fuzzy-pancake favicon.png', sizes: '32x32', type: 'image/png' },
      { url: '/logo/fuzzy-pancake favicon.png', sizes: '16x16', type: 'image/png' },
      { url: '/logo/fuzzy-pancake favicon.png', sizes: '192x192', type: 'image/png' },
    ],
    shortcut: '/logo/fuzzy-pancake favicon.png',
    apple: '/logo/fuzzy-pancake favicon.png',
  },
  openGraph: {
    title: 'Fuzzy Pancake',
    description: 'AI Image Generation with Fuzzy Pancake - Create stunning images using advanced AI models',
    type: 'website',
    images: ['/logo/fuzzy-pancake favicon.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Fuzzy Pancake',
    description: 'AI Image Generation with Fuzzy Pancake - Create stunning images using advanced AI models',
    images: ['/logo/fuzzy-pancake favicon.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
