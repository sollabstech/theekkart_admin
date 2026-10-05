'use client';
import { useEffect, useState } from 'react';
import { Menu, Search } from 'lucide-react';
import QuickSearch from '@/components/QuickSearch';
import NotificationBell from '@/components/NotificationBell';
import ProfileMenu from '@/components/ProfileMenu';

export default function Header({ title, onMenuClick }) {
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K opens quick search from anywhere
  useEffect(() => {
    const onKey = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearchOpen(o => !o); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
    <header className="sticky top-0 z-20 flex items-center gap-4 px-4 lg:px-6 h-16"
      style={{
        background: 'rgba(255,255,255,0.96)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
        boxShadow: '0 1px 12px rgba(0,0,0,0.04)',
      }}>
      {/* Mobile menu toggle */}
      <button onClick={onMenuClick}
        className="lg:hidden w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 transition-colors">
        <Menu size={20} />
      </button>

      {/* Page title */}
      <div className="flex-1">
        <h1 className="text-base font-bold text-gray-900">{title}</h1>
        <p className="text-[11px] text-gray-400 hidden sm:block">TheekKart Admin</p>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Search (desktop) */}
        <button onClick={() => setSearchOpen(true)}
          className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 hover:bg-gray-100 transition-colors"
          style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
          <Search size={14} />
          <span>Quick search…</span>
          <kbd className="ml-4 px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-400">⌘K</kbd>
        </button>
        {/* Search (phone) */}
        <button onClick={() => setSearchOpen(true)} aria-label="Search"
          className="md:hidden w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-orange-500 hover:bg-orange-50 transition-colors">
          <Search size={18} />
        </button>

        <NotificationBell />
        <ProfileMenu />
      </div>
    </header>
    <QuickSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}
