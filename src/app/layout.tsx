import './globals.css';

export const metadata = {
  title: 'Meww.me API Explorer',
  description: 'JSON API for Spotify top charts scraped from Kworb',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
