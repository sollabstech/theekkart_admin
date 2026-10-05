'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, Settings, MapPinned, Wallet } from 'lucide-react';
import { adminLogout, getAdminUser } from '@/lib/auth';

// The header avatar: who is signed in, shortcuts, and Sign out.
export default function ProfileMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('Admin');
  const ref = useRef(null);

  useEffect(() => { setName(getAdminUser()); }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const initial = name ? name.charAt(0).toUpperCase() : 'A';

  function logout() {
    adminLogout();
    router.replace('/login');
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)} aria-label="Profile menu" title={name}
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold"
        style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 2px 8px rgba(249,115,22,0.3)' }}>
        {initial}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden z-50">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="font-semibold text-gray-800 text-sm capitalize truncate">{name}</p>
            <p className="text-xs text-gray-400">Administrator</p>
          </div>
          <div className="py-1">
            {[
              { href: '/delivery-area', icon: MapPinned, label: 'Delivery area' },
              { href: '/settlements', icon: Wallet, label: 'Settlements & commission' },
              { href: '/notifications', icon: Settings, label: 'Push notifications' },
            ].map(i => (
              <Link key={i.href} href={i.href} onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50">
                <i.icon size={15} className="text-gray-400" /> {i.label}
              </Link>
            ))}
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50 border-t border-gray-100">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}
