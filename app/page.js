'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isAdminLoggedIn } from '@/lib/auth';

export default function Root() {
  const router = useRouter();
  useEffect(() => {
    if (isAdminLoggedIn()) {
      router.replace('/dashboard');
    } else {
      router.replace('/login');
    }
  }, [router]);
  return null;
}
