'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { adminLogout, getAdminUser } from '@/lib/auth';
import {
  LayoutDashboard, ShoppingBag, Package, Grid3X3,
  UserCheck, Image, BarChart3, MessageCircle, Wrench,
  LogOut, X, Tag, Handshake
} from 'lucide-react';
import clsx from 'clsx';

const NAV = [
  { href: '/dashboard',     label: 'Dashboard',     icon: LayoutDashboard, group: 'main' },
  { href: '/orders',        label: 'Orders',         icon: ShoppingBag,     group: 'main' },
  { href: '/products',      label: 'Products',       icon: Package,         group: 'main' },
  { href: '/categories',    label: 'Categories',     icon: Grid3X3,         group: 'main' },
  { href: '/users',         label: 'App Users',      icon: UserCheck,       group: 'engage' },
  { href: '/requests',      label: 'Requests',       icon: MessageCircle,   group: 'engage' },
  { href: '/home-services', label: 'Home Services',  icon: Wrench,          group: 'engage' },
  { href: '/promo-codes',   label: 'Promo Codes',    icon: Tag,             group: 'engage' },
  { href: '/partners',      label: 'Partners',       icon: Handshake,       group: 'engage' },
  { href: '/banners',       label: 'Banners',        icon: Image,           group: 'engage' },
  { href: '/reports',       label: 'Reports',        icon: BarChart3,       group: 'reports' },
];

export default function Sidebar({ open, onClose }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    adminLogout();
    router.replace('/login');
  }

  const adminName = getAdminUser();
  const adminInitial = adminName ? adminName.charAt(0).toUpperCase() : 'A';

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm" onClick={onClose} />
      )}

      <aside className={clsx(
        'fixed top-0 left-0 h-full w-64 z-40 flex flex-col transition-transform duration-300 lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full'
      )} style={{ background: 'linear-gradient(180deg, #0f0f1a 0%, #111827 60%, #0f172a 100%)' }}>

        {/* Subtle glow at top */}
        <div style={{
          position: 'absolute', top: -80, left: '50%', transform: 'translateX(-50%)',
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(249,115,22,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Logo header */}
        <div className="relative flex items-center justify-between px-5 py-5"
          style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/dashboard" onClick={onClose} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', boxShadow: '0 4px 14px rgba(249,115,22,0.4)' }}>
              <span style={{ fontSize: 18 }}>🛒</span>
            </div>
            <div>
              <p className="font-bold text-white text-sm leading-none">TheekKart</p>
              <p className="text-[10px] mt-0.5 font-medium" style={{ color: '#f97316' }}>Admin Panel</p>
            </div>
          </Link>
          <button onClick={onClose} className="lg:hidden text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {/* Group: Main */}
          <p className="px-3 py-2 text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: 'rgba(255,255,255,0.25)' }}>Main</p>
          {NAV.filter(n => n.group === 'main').map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group',
                  active ? 'text-white' : 'text-gray-400 hover:text-white'
                )}
                style={active ? {
                  background: 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(234,88,12,0.15) 100%)',
                  border: '1px solid rgba(249,115,22,0.3)',
                  boxShadow: '0 0 12px rgba(249,115,22,0.1)',
                } : { background: 'transparent', border: '1px solid transparent' }}>
                <Icon size={16} style={{ color: active ? '#f97316' : undefined }} />
                <span className="flex-1">{label}</span>
                {active && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', display: 'block', flexShrink: 0 }} />
                )}
              </Link>
            );
          })}

          {/* Group: Engage */}
          <p className="px-3 pt-4 pb-2 text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: 'rgba(255,255,255,0.25)' }}>Engage</p>
          {NAV.filter(n => n.group === 'engage').map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active ? 'text-white' : 'text-gray-400 hover:text-white'
                )}
                style={active ? {
                  background: 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(234,88,12,0.15) 100%)',
                  border: '1px solid rgba(249,115,22,0.3)',
                  boxShadow: '0 0 12px rgba(249,115,22,0.1)',
                } : { background: 'transparent', border: '1px solid transparent' }}>
                <Icon size={16} style={{ color: active ? '#f97316' : undefined }} />
                <span className="flex-1">{label}</span>
                {active && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', display: 'block', flexShrink: 0 }} />
                )}
              </Link>
            );
          })}

          {/* Group: Reports */}
          <p className="px-3 pt-4 pb-2 text-[10px] font-semibold tracking-widest uppercase"
            style={{ color: 'rgba(255,255,255,0.25)' }}>Analytics</p>
          {NAV.filter(n => n.group === 'reports').map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link key={href} href={href} onClick={onClose}
                className={clsx(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all',
                  active ? 'text-white' : 'text-gray-400 hover:text-white'
                )}
                style={active ? {
                  background: 'linear-gradient(135deg, rgba(249,115,22,0.25) 0%, rgba(234,88,12,0.15) 100%)',
                  border: '1px solid rgba(249,115,22,0.3)',
                  boxShadow: '0 0 12px rgba(249,115,22,0.1)',
                } : { background: 'transparent', border: '1px solid transparent' }}>
                <Icon size={16} style={{ color: active ? '#f97316' : undefined }} />
                <span className="flex-1">{label}</span>
                {active && (
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f97316', display: 'block', flexShrink: 0 }} />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User footer */}
        <div className="px-3 py-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3 px-3 py-2 mb-2 rounded-xl"
            style={{ background: 'rgba(255,255,255,0.04)' }}>
            <div className="w-8 h-8 rounded-xl flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
              {adminInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white capitalize truncate">{adminName}</p>
              <p className="text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>Administrator</p>
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-gray-400 hover:text-red-400"
            style={{ border: '1px solid transparent' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
            <LogOut size={15} />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
