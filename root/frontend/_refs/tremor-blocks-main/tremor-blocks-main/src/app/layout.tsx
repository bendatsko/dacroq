import { Inter } from 'next/font/google';

import './global.css';

const inter = Inter({ subsets: ['latin'] });

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full scroll-auto bg-white antialiased">
      <body className={`${inter.className}`}>{children}</body>
    </html>
  );
}
