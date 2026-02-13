'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, ShoppingBag, PieChart, Store } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';

export default function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();

    const tabs = [
        { name: 'Товари', href: '/466ed1254c89ccf77b8dab3da30f8692', icon: LayoutDashboard },
        { name: 'Замовлення', href: '/466ed1254c89ccf77b8dab3da30f8692/orders', icon: ShoppingBag },
    ];

    return (
        <div className="min-h-screen bg-zinc-50 dark:bg-black font-sans selection:bg-primary/10">
            {/* Header / Sidebar Refactored to Top Nav for Dashboard */}
            <header className="sticky top-0 z-50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-2">
                            <div className="h-8 w-8 bg-primary rounded-xl flex items-center justify-center shadow-lg glow-primary shrink-0">
                                <LayoutDashboard className="text-white" size={18} />
                            </div>
                            <h1 className="text-lg font-black tracking-tight text-zinc-900 dark:text-zinc-50 hidden sm:block">Адмін-панель</h1>
                        </div>

                        <div className="flex items-center gap-4">
                            <nav className="flex items-center gap-1">
                                {tabs.map((tab) => {
                                    const isActive = pathname === tab.href;
                                    return (
                                        <Link
                                            key={tab.name}
                                            href={tab.href}
                                            className={`px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${isActive
                                                ? 'bg-primary/10 text-primary'
                                                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                                                }`}
                                        >
                                            <tab.icon size={16} />
                                            {tab.name}
                                        </Link>
                                    );
                                })}
                            </nav>

                            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block" />

                            <div className="flex items-center gap-2">
                                <Link
                                    href="/"
                                    target="_blank"
                                    className="p-2 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                                    title="Перейти в магазин"
                                >
                                    <Store size={20} />
                                </Link>
                                <ThemeToggle />
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-[1600px] mx-auto p-4 sm:p-6 lg:p-8">
                {children}
            </main>
        </div>
    );
}
