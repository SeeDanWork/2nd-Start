import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'ADCP Scenario Lab',
  description: 'Internal testing environment for co-parenting scheduling engine',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <nav className="border-b border-lab-200 bg-white">
          <div className="max-w-7xl mx-auto px-4 h-12 flex items-center gap-6">
            <Link href="/" className="font-semibold text-lab-700 text-sm tracking-wide">
              ADCP Scenario Lab
            </Link>
            <div className="h-4 w-px bg-lab-200" />
            <Link href="/" className="text-sm text-lab-500 hover:text-lab-700">
              Dashboard
            </Link>
            <Link href="/scenarios/new" className="text-sm text-lab-500 hover:text-lab-700">
              New Scenario
            </Link>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
