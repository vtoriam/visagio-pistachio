import type { Metadata } from 'next';
import '../styles/globals.css';

export const metadata: Metadata = {
  title: 'UrgentNow — Perth Emergency & Urgent Care',
  description: 'Real-time emergency room wait times, urgent care clinics, and pharmacies near you in Perth, WA.',
  themeColor: '#E63946',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
