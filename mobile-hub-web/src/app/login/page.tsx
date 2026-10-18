import { AuthForm } from '@/components/auth-form';

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const params = await searchParams;
  return <AuthForm mode="login" sessionExpired={params.reason === 'session-expired'} />;
}
