'use client';
import { useState } from 'react';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import AdminGuard from '@/components/AdminGuard';
import { usePathname } from 'next/navigation';

const PAGE_TITLES = {
  '/dashboard':     'Dashboard',
  '/orders':        'Orders',
  '/products':      'Products',
  '/categories':    'Categories',
  '/customers':     'Customers',
  '/users':         'App Users',
  '/requests':      'Ask TheekKart Requests',
  '/banners':       'Banners & Offers',
  '/notifications': 'Notifications',
  '/reports':       'Reports',
};

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const baseRoute = '/' + pathname.split('/')[1];
  const title = PAGE_TITLES[baseRoute] || 'Admin';

  return (
    <AdminGuard>
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
