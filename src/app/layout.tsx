import type { Metadata } from 'next';
import './globals.css';
import { Sidebar } from '@/components/sidebar';
import { Topbar } from '@/components/topbar';

export const metadata: Metadata = {
  title: 'Helm — ADT Operations System',
  description: 'ADT Helm clickable prototype',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="flex-1 flex flex-col">
            <Topbar />
            <main className="flex-1 overflow-auto bg-gray-50 p-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
