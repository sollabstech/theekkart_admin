'use client';
import { useState, useEffect } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AdminGuard from '@/components/AdminGuard';
import NotificationWatcher from '@/components/NotificationWatcher';
import { usePathname, useRouter } from 'next/navigation';

const PAGE_TITLES = {
  '/dashboard':     'Dashboard',
  '/orders':        'Orders',
  '/products':      'Products',
  '/categories':    'Categories',
  '/customers':     'Customers',
  '/users':         'App Users',
  '/requests':      'Requests',
  '/home-services': 'Home Services',
  '/promo-codes':   'Promo Codes',
  '/partners':      'Partner Applications',
  '/riders':        'Rider Management',
  '/vendors':       'Vendor Management',
  '/banners':       'Banners & Offers',
  '/notifications': 'Notifications',
  '/reports':       'Reports',
};

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const baseRoute = '/' + pathname.split('/')[1];
  const title = PAGE_TITLES[baseRoute] || 'Admin';

  // Prevent browser back from leaving the admin panel.
  // On mount, push a sentinel so there is always an admin entry below the
  // current page. On popstate, if the new location would exit the admin,
  // redirect to /dashboard instead.
  useEffect(() => {
    window.history.pushState({ adminSentinel: true }, '');

    function handlePop() {
      const path = window.location.pathname;
      const adminRoutes = Object.keys(PAGE_TITLES);
      const isInsideAdmin = adminRoutes.some(r => path === r || path.startsWith(r + '/'));
      if (!isInsideAdmin) {
        window.history.pushState(null, '', '/dashboard');
        router.replace('/dashboard');
      }
    }

    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, [router]);

  return (
    <AdminGuard>
      <NotificationWatcher />
      <div className="flex h-screen overflow-hidden bg-gray-50">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
          <Header title={title} onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </AdminGuard>
  );
}
