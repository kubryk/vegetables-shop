'use client';

import React, { useState, useEffect } from 'react';
import { getOrders } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, ShoppingBag, Calendar, User, Mail, ChevronRight, ChevronDown } from 'lucide-react';

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

    useEffect(() => {
        loadOrders();
    }, []);

    async function loadOrders() {
        setIsLoading(true);
        const fetchedOrders = await getOrders();
        setOrders(fetchedOrders);
        setIsLoading(false);
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Orders Management</h2>
                    <p className="text-zinc-500 dark:text-zinc-400">View and manage customer orders</p>
                </div>
                <Button
                    variant="outline"
                    onClick={loadOrders}
                    className="rounded-full shadow-sm hover:shadow-md transition-all"
                >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Orders
                </Button>
            </div>

            <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-3 text-blue-500/10">
                    <ShoppingBag size={80} strokeWidth={1} />
                </div>
                <CardHeader className="pb-2">
                    <CardDescription>Total Orders</CardDescription>
                    <CardTitle className="text-4xl font-black text-blue-600">
                        {orders.length}
                    </CardTitle>
                </CardHeader>
            </Card>

            <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800">
                    <CardTitle className="text-xl">Orders List</CardTitle>
                    <CardDescription>Manage your customer orders and status</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-zinc-500 font-medium">Loading orders...</p>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-20 px-6">
                            <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                                <ShoppingBag size={32} />
                            </div>
                            <p className="text-zinc-500">No orders found in the database yet.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs uppercase font-bold text-zinc-500">
                                    <tr>
                                        <th className="px-6 py-4">Order</th>
                                        <th className="px-6 py-4">Date</th>
                                        <th className="px-6 py-4">Customer</th>
                                        <th className="px-6 py-4">Summary</th>
                                        <th className="px-6 py-4">Total</th>
                                        <th className="px-6 py-4">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {orders.map((order) => {
                                        const items = Array.isArray(order.items) ? order.items : [];
                                        const isExpanded = expandedOrderId === order.id;
                                        return (
                                            <React.Fragment key={order.id}>
                                                <tr
                                                    className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors cursor-pointer group"
                                                    onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-1 rounded-full transition-colors ${isExpanded ? 'bg-primary/10 text-primary' : 'text-zinc-400 group-hover:text-zinc-600'}`}>
                                                                {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                            </div>
                                                            <p className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                                                #{order.id.slice(0, 8)}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                                                            <Calendar size={12} />
                                                            {new Date(order.orderDate).toLocaleDateString('uk-UA')}
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <User size={14} className="text-zinc-400" />
                                                            <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{order.customerName}</p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-2">
                                                            <Badge variant="outline" className="text-[10px] bg-zinc-50 dark:bg-zinc-800 border-zinc-200">
                                                                {items.length} {items.length === 1 ? 'item' : 'items'}
                                                            </Badge>
                                                            <p className="text-[10px] text-zinc-400 truncate max-w-[150px]">
                                                                {order.itemsSummary?.replace(/\n/g, ', ')}
                                                            </p>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <p className="font-mono font-bold text-primary">
                                                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: order.currency || 'EUR' }).format(order.totalPrice)}
                                                        </p>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <Badge variant="outline" className="rounded-full bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800 capitalize font-bold text-[10px]">
                                                            {order.status}
                                                        </Badge>
                                                    </td>
                                                </tr>
                                                {isExpanded && (
                                                    <tr className="bg-zinc-50/50 dark:bg-zinc-800/20 animate-in fade-in slide-in-from-top-2 duration-200">
                                                        <td colSpan={6} className="px-6 py-6">
                                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                                                <div className="space-y-4">
                                                                    <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Customer Info</h4>
                                                                    <div className="space-y-2">
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <User size={14} className="text-zinc-400" />
                                                                            <span className="font-medium font-sans">{order.customerName}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-sm">
                                                                            <Mail size={14} className="text-zinc-400" />
                                                                            <span className="font-sans">{order.customerEmail}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-sm text-zinc-500">
                                                                            <Calendar size={14} className="text-zinc-400" />
                                                                            <span className="font-sans">Ordered on {new Date(order.orderDate).toLocaleString('uk-UA')}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                <div className="md:col-span-2 space-y-3">
                                                                    <h4 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Order Items</h4>
                                                                    <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm">
                                                                        <table className="w-full text-left text-[11px]">
                                                                            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 font-bold border-b border-zinc-100 dark:border-zinc-800">
                                                                                <tr>
                                                                                    <th className="px-3 py-2">Item</th>
                                                                                    <th className="px-3 py-2 text-center">Packs</th>
                                                                                    <th className="px-3 py-2 text-right">In Pack</th>
                                                                                    <th className="px-3 py-2 text-right">Total Cont.</th>
                                                                                    <th className="px-3 py-2 text-right">Price/Pack</th>
                                                                                    <th className="px-3 py-2 text-right">Subtotal</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                                                                                {items.map((item: any, idx: number) => (
                                                                                    <tr key={idx} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-800/20">
                                                                                        <td className="px-3 py-2">
                                                                                            <div className="flex items-center gap-2">
                                                                                                <div className="h-6 w-6 rounded bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                                                                                    {item.image ? <img src={item.image} className="object-cover h-full w-full" alt="" /> : <div className="h-full w-full flex items-center justify-center text-[8px] text-zinc-400">IMG</div>}
                                                                                                </div>
                                                                                                <span className="font-bold text-zinc-700 dark:text-zinc-300">{item.name}</span>
                                                                                            </div>
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-center text-zinc-600 dark:text-zinc-400">
                                                                                            <Badge variant="secondary" className="text-[9px] px-1.5 h-3.5 font-bold bg-zinc-100 text-zinc-600 border-zinc-200">
                                                                                                {item.quantity} pks
                                                                                            </Badge>
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-right font-mono text-zinc-500">{item.cardboardWeight || 0} {item.unit || 'kg'}</td>
                                                                                        <td className="px-3 py-2 text-right font-mono text-zinc-600 font-medium">
                                                                                            {((item.quantity || 0) * (item.cardboardWeight || 0)).toFixed(1)} {item.unit || 'kg'}
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-right font-mono text-zinc-500">
                                                                                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: order.currency || 'EUR', maximumFractionDigits: 2 }).format(item.price || 0)}
                                                                                        </td>
                                                                                        <td className="px-3 py-2 text-right font-mono font-bold text-primary">
                                                                                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: order.currency || 'EUR', maximumFractionDigits: 2 }).format(item.totalPrice || ((item.price || 0) * (item.quantity || 0)))}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
