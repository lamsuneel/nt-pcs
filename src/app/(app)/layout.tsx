import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/session';
import { SideNav } from '@/components/nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession();
  if (!session) redirect('/login');

  return (
    <div className="flex min-h-screen bg-nt-bg">
      <SideNav fullName={session.fullName} roles={session.roles} />
      <main className="flex-1 px-8 py-8 max-w-6xl">{children}</main>
    </div>
  );
}
