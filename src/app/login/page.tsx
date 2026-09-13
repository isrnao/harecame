'use client';
import { useRouter } from 'next/navigation';
import { AdminLoginForm } from '@/components/auth/AdminLoginForm';
export default function LoginPage() {
  const router = useRouter();
  return <main className="container mx-auto p-8"><AdminLoginForm onSuccess={() => { router.push('/events'); router.refresh(); }} /></main>;
}
