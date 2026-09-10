'use client';
import { Menu, Bell, Search } from 'lucide-react';
import { getAdminUser } from '@/lib/auth';

export default function Header({ title, onMenuClick }) {
  const adminName = getAdminUser();
  const adminInitial = adminName ? adminName.charAt(0).toUpperCase() : 'A';

  return (
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
        {/* Search (desktop only) */}
        <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400 cursor-pointer hover:bg-gray-100 transition-colors"
          style={{ border: '1px solid rgba(0,0,0,0.07)' }}>
          <Search size={14} />
          <span>Quick search…</span>
          <kbd className="ml-4 px-1.5 py-0.5 rounded text-[10px] font-mono bg-gray-100 text-gray-400">⌘K</kbd>
        </div>

        {/* Notification bell */}
        <button className="relative w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:text-orange-500 hover:bg-orange-50 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full ring-2 ring-white" />
        </button>

        {/* Admin avatar */}
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-sm font-bold cursor-pointer"
          style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 2px 8px rgba(249,115,22,0.3)' }}
          title={adminName}>
          {adminInitial}
        </div>
      </div>
    </header>
  );
}
