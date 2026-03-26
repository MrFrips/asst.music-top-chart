import './globals.css';

export const metadata = {
  title: 'asst.music API зонд',
  description: 'JSON API для просмотра топ-чартов Spotify, полученный путем парсинга данных с Kworb.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
