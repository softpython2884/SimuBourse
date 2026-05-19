import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    redirect('/login?next=/admin');
  }
  if (session.role !== 'admin') {
    redirect('/');
  }
  return <>{children}</>;
}
