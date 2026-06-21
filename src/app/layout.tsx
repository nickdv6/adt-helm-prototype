import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';
import { PrototypeBanner } from '@/components/prototype-banner';
import { PageStrip } from '@/components/page-strip';

export const metadata: Metadata = {
  title: 'Helm — ADT Operations System',
  description: 'ADT Helm clickable prototype',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <PrototypeBanner />
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Topbar />
            <main className="flex-1 overflow-auto bg-gray-50 p-6">
              {children}
              <PageStrip />
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
