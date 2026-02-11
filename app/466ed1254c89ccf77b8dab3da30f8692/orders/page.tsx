'use client';

import React, { useState, useEffect } from 'react';

import { getPaginatedOrders, getProducts, updateOrderStatus, deleteOrder, getOrderStats, exportAggregationToSheets } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { Loader2, RefreshCw, ShoppingBag, Calendar, User, Mail, ChevronRight, ChevronDown, Trash2, CheckCircle, Clock, ChevronLeft, FileBarChart2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export default function OrdersPage() {
    const [orders, setOrders] = useState<any[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [actionOrderId, setActionOrderId] = useState<string | null>(null);
    const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const [stats, setStats] = useState({ total: 0, day: 0, week: 0, month: 0 });
    const limit = 20;

    // Date Filter State
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        loadOrders(1);
    }, [startDate, endDate]);

    async function loadOrders(page = currentPage) {
        setIsLoading(true);
        try {
            const start = startDate ? new Date(startDate) : undefined;
            const end = endDate ? new Date(endDate) : undefined;

            const [ordersResult, fetchedProducts, statsResult] = await Promise.all([
                getPaginatedOrders(page, limit, start, end),
                getProducts(),
                getOrderStats()
            ]);

            setOrders(ordersResult.orders);
            setTotalPages(ordersResult.totalPages);
            setTotalOrders(ordersResult.totalCount);
            setProducts(fetchedProducts);
            setStats(statsResult);
            setCurrentPage(page);
        } catch (error) {
            console.error(error);
            toast.error('Не вдалося завантажити замовлення');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleExport() {
        if (!startDate || !endDate) {
            toast.error('Будь ласка, виберіть дати');
            return;
        }
        setIsExporting(true);
        try {
            const result = await exportAggregationToSheets(startDate, endDate);
            if (result.success) {
                toast.success(`Звіт успішно експортовано в лист "${result.sheetName}"`);
            } else {
                toast.error(`Не вдалося експортувати: ${result.error}`);
            }
        } catch (error) {
            toast.error('Сталася помилка при експорті');
        } finally {
            setIsExporting(false);
        }
    }

    async function handleUpdateStatus(orderId: string, status: string) {
        setActionOrderId(orderId);
        const result = await updateOrderStatus(orderId, status);
        if (result.success) {
            toast.success('Статус оновлено');
            loadOrders();
        } else {
            toast.error(result.error);
        }
        setActionOrderId(null);
    }

    async function handleDeleteOrder(orderId: string) {
        if (!confirm('Ви впевнені, що хочете видалити це замовлення?')) return;

        setActionOrderId(orderId);
        const result = await deleteOrder(orderId);
        if (result.success) {
            toast.success('Замовлення видалено');
            loadOrders();
        } else {
            toast.error(result.error);
        }
        setActionOrderId(null);
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Замовлення</h2>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-100 dark:border-zinc-800 shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                        <div className="w-full sm:flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="startDate" className="text-xs font-bold text-zinc-500 uppercase">Від</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                    <Input
                                        id="startDate"
                                        type="date"
                                        value={startDate}
                                        onChange={(e) => setStartDate(e.target.value)}
                                        className="pl-9 h-9 text-sm w-full"
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="endDate" className="text-xs font-bold text-zinc-500 uppercase">До</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
                                    <Input
                                        id="endDate"
                                        type="date"
                                        value={endDate}
                                        onChange={(e) => setEndDate(e.target.value)}
                                        className="pl-9 h-9 text-sm w-full"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">


                            <Button
                                onClick={handleExport}
                                disabled={isExporting}
                                className="flex-1 sm:flex-none h-9 rounded-full bg-green-600 hover:bg-green-700 text-white shadow-sm hover:shadow-md transition-all"
                            >
                                {isExporting ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <FileText className="mr-2 h-3.5 w-3.5" />}
                                Звіт (Sheets)
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 py-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl">Список замовлень</CardTitle>
                        <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                            Знайдено: {totalOrders}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center py-20 gap-4">
                            <Loader2 className="h-10 w-10 animate-spin text-primary" />
                            <p className="text-zinc-500 font-medium">Завантаження замовлень...</p>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="text-center py-20 px-6">
                            <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                                <ShoppingBag size={32} />
                            </div>
                            <p className="text-zinc-500">Немає замовлень</p>
                        </div>
                    ) : (
                        <>
                            {/* Desktop View (Table) */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs uppercase font-bold text-zinc-500">
                                        <tr>
                                            <th className="px-4 sm:px-6 py-4 hidden sm:table-cell">Номер</th>
                                            <th className="px-4 sm:px-6 py-4">Дата</th>
                                            <th className="px-4 sm:px-6 py-4">Клієнт</th>
                                            <th className="px-4 sm:px-6 py-4 hidden lg:table-cell">Товари</th>
                                            <th className="px-4 sm:px-6 py-4">Загалом</th>
                                            <th className="px-4 sm:px-6 py-4 text-center">Статус</th>
                                            <th className="px-4 sm:px-6 py-4 text-right">Дії</th>
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
                                                        <td className="px-4 sm:px-6 py-4 hidden sm:table-cell">
                                                            <div className="flex items-center gap-3">
                                                                <div className={`p-1 rounded-full transition-colors ${isExpanded ? 'bg-primary/10 text-primary' : 'text-zinc-400 group-hover:text-zinc-600'}`}>
                                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                                </div>
                                                                <p className="font-bold text-[10px] md:text-sm text-zinc-900 dark:text-zinc-100">
                                                                    #{order.id.slice(0, 8)}
                                                                </p>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4">
                                                            <div className="flex flex-col text-xs text-zinc-500">
                                                                <div className="flex items-center gap-1.5">
                                                                    <Calendar size={12} />
                                                                    {new Date(order.orderDate).toLocaleDateString('uk-UA')}
                                                                </div>
                                                                <div className="flex items-center gap-1.5 ml-[18px] text-[10px] text-zinc-400">
                                                                    <Clock size={10} />
                                                                    {new Date(order.orderDate).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center gap-2">
                                                                <User size={14} className="text-zinc-400" />
                                                                <p className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{order.customerName}</p>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 hidden lg:table-cell">
                                                            <div className="flex flex-col gap-1">
                                                                <Badge variant="outline" className="w-fit text-[9px] bg-zinc-50 dark:bg-zinc-800 border-zinc-200">
                                                                    {items.length} {items.length === 1 ? 'позиція' : 'позицій'}
                                                                </Badge>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4">
                                                            <p className="font-mono font-bold text-primary text-sm sm:text-base">
                                                                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: order.currency || 'EUR' }).format(order.totalPrice)}
                                                            </p>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 text-center">
                                                            <div onClick={(e) => e.stopPropagation()} className="flex justify-center">
                                                                <Select
                                                                    defaultValue={order.status}
                                                                    onValueChange={(value) => handleUpdateStatus(order.id, value)}
                                                                    disabled={actionOrderId === order.id}
                                                                >
                                                                    <SelectTrigger className={cn(
                                                                        "h-8 w-[110px] sm:w-[140px] rounded-full font-bold text-[9px] sm:text-[10px] border-none shadow-none focus:ring-0 cursor-pointer",
                                                                        order.status === 'completed'
                                                                            ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                                                                            : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                                                    )}>
                                                                        <div className="flex items-center gap-1 sm:gap-1.5">
                                                                            {order.status === 'completed' ? <CheckCircle size={10} className="sm:size-[12px]" /> : <Clock size={10} className="sm:size-[12px]" />}
                                                                            <SelectValue />
                                                                        </div>
                                                                    </SelectTrigger>
                                                                    <SelectContent className="rounded-xl shadow-xl border-zinc-100 dark:border-zinc-800">
                                                                        <SelectItem value="processing" className="text-blue-600 font-medium cursor-pointer text-xs sm:text-sm">
                                                                            В обробці
                                                                        </SelectItem>
                                                                        <SelectItem value="completed" className="text-green-600 font-medium cursor-pointer text-xs sm:text-sm">
                                                                            Оброблено
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </td>
                                                        <td className="px-4 sm:px-6 py-4 text-right">
                                                            <div onClick={(e) => e.stopPropagation()}>
                                                                <Button
                                                                    size="sm"
                                                                    variant="ghost"
                                                                    className="h-8 w-8 p-0 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                                    onClick={() => handleDeleteOrder(order.id)}
                                                                    disabled={actionOrderId === order.id}
                                                                    title="Видалити замовлення"
                                                                >
                                                                    {actionOrderId === order.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={16} />}
                                                                </Button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                    {isExpanded && (
                                                        <tr className="bg-zinc-50/50 dark:bg-zinc-800/20 animate-in fade-in slide-in-from-top-2 duration-200">
                                                            <td colSpan={7} className="px-2 sm:px-6 py-4 sm:py-6">
                                                                <OrderDetails order={order} items={items} products={products} />
                                                            </td>
                                                        </tr>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Mobile View (Cards) */}
                            <div className="md:hidden flex flex-col gap-4 p-4 bg-zinc-50 dark:bg-zinc-950">
                                {orders.map((order) => {
                                    const items = Array.isArray(order.items) ? order.items : [];
                                    const isExpanded = expandedOrderId === order.id;

                                    return (
                                        <div
                                            key={order.id}
                                            className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm"
                                        >
                                            <div
                                                className="p-4 cursor-pointer"
                                                onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}
                                            >
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`p-1 rounded-full transition-colors ${isExpanded ? 'bg-primary/10 text-primary' : 'text-zinc-400'}`}>
                                                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        </div>
                                                        <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                                                            #{order.id.slice(0, 8)}
                                                        </span>
                                                    </div>
                                                    <Badge variant="outline" className="text-[10px] bg-zinc-50 dark:bg-zinc-800 border-zinc-200">
                                                        {new Date(order.orderDate).toLocaleDateString('uk-UA')}
                                                    </Badge>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <User size={14} className="text-zinc-400" />
                                                            <span className="text-sm font-medium">{order.customerName}</span>
                                                        </div>
                                                        <span className="font-mono font-bold text-primary">
                                                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: order.currency || 'EUR' }).format(order.totalPrice)}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center justify-between pt-2 border-t border-zinc-50 dark:border-zinc-800">
                                                        <div className="text-xs text-zinc-500">
                                                            {items.length} {items.length === 1 ? 'позиція' : 'позицій'}
                                                        </div>
                                                        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                                            <Select
                                                                defaultValue={order.status}
                                                                onValueChange={(value) => handleUpdateStatus(order.id, value)}
                                                                disabled={actionOrderId === order.id}
                                                            >
                                                                <SelectTrigger className={cn(
                                                                    "h-7 w-[110px] rounded-full font-bold text-[10px] border-none shadow-none focus:ring-0",
                                                                    order.status === 'completed'
                                                                        ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                                                                        : "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                                                                )}>
                                                                    <div className="flex items-center gap-1.5">
                                                                        {order.status === 'completed' ? <CheckCircle size={10} /> : <Clock size={10} />}
                                                                        <SelectValue />
                                                                    </div>
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="processing">В обробці</SelectItem>
                                                                    <SelectItem value="completed">Оброблено</SelectItem>
                                                                </SelectContent>
                                                            </Select>

                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                className="h-7 w-7 p-0 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-full"
                                                                onClick={() => handleDeleteOrder(order.id)}
                                                                disabled={actionOrderId === order.id}
                                                            >
                                                                {actionOrderId === order.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={14} />}
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {isExpanded && (
                                                <div className="border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/20 p-4">
                                                    <OrderDetails order={order} items={items} products={products} isMobile />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </CardContent>
            </Card>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pb-8">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadOrders(currentPage - 1)}
                        disabled={currentPage <= 1 || isLoading}
                        className="rounded-full shadow-sm"
                    >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Назад
                    </Button>
                    <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                        Сторінка {currentPage} з {totalPages}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadOrders(currentPage + 1)}
                        disabled={currentPage >= totalPages || isLoading}
                        className="rounded-full shadow-sm"
                    >
                        Вперед
                        <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                </div>
            )}
        </div>
    );
}

function OrderDetails({ order, items, products, isMobile }: { order: any, items: any[], products: any[], isMobile?: boolean }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
                <h4 className="text-xs uppercase font-bold text-zinc-400 tracking-wider">Клієнт</h4>
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
                        <span className="font-sans">Замовлення від {new Date(order.orderDate).toLocaleString('uk-UA')}</span>
                    </div>
                </div>
            </div>

            <div className="md:col-span-3 space-y-3">
                <h4 className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Склад замовлення</h4>
                <div className="hidden md:block bg-white dark:bg-zinc-900 rounded-xl border border-zinc-100 dark:border-zinc-800 overflow-hidden shadow-sm overflow-x-auto">
                    <table className="w-full text-left text-[10px] sm:text-[11px] min-w-[500px] sm:min-w-0">
                        <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-zinc-500 font-bold border-b border-zinc-100 dark:border-zinc-800">
                            <tr>
                                <th className="px-3 py-2">Товар</th>
                                <th className="px-3 py-2 text-center">К-сть</th>
                                <th className="px-3 py-2 text-right">Ціна/уп</th>
                                <th className="px-3 py-2 text-right">Заг. вага/к-сть</th>
                                <th className="px-3 py-2 text-right">Сума</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-50 dark:divide-zinc-800/50">
                            {items.map((item: any, idx: number) => {
                                // Fallback to current product info if order item info is missing
                                const refProduct = products.find((p: any) => p.id === item.productId || p.id === item.id);

                                const unit = item.unit === 'pcs' ? 'шт' : (item.unit || refProduct?.unit || 'кг');
                                const inPack = Number(item.netWeight || item.unitPerCardboard || item.cardboardWeight || refProduct?.netWeight || refProduct?.unitPerCardboard || 0);
                                const totalCont = (Number(item.quantity) || 0) * inPack;
                                const pPerPack = Number(item.price || refProduct?.pricePerCardboard || 0);

                                return (
                                    <tr key={idx} className="hover:bg-zinc-50/30 dark:hover:bg-zinc-800/20">
                                        <td className="px-3 py-2">
                                            <div className="flex items-center gap-2">
                                                <div className="h-6 w-6 rounded bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                                    {item.image ? <img src={item.image} className="object-cover h-full w-full" alt="" /> : <div className="h-full w-full flex items-center justify-center text-[8px] text-zinc-400">IMG</div>}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-zinc-700 dark:text-zinc-300 truncate">{item.name}</p>
                                                    {item.category && <p className="text-[9px] text-zinc-400 uppercase tracking-tighter">{item.category}</p>}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-3 py-2 text-center text-zinc-600 dark:text-zinc-400">
                                            <Badge variant="secondary" className="text-[9px] px-1.5 h-3.5 font-bold bg-zinc-100 text-zinc-600 border-zinc-200">
                                                {item.quantity} уп
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-zinc-500">
                                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: order.currency || 'EUR' }).format(pPerPack)}
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono text-zinc-600 font-medium">
                                            <div className="font-bold text-sm tracking-tight">{totalCont.toFixed(unit === 'шт' ? 0 : 2)} {unit}</div>
                                            <div className="text-[9px] text-zinc-400 font-normal">({inPack} {unit} в уп)</div>
                                        </td>
                                        <td className="px-3 py-2 text-right font-mono font-bold text-primary">
                                            {new Intl.NumberFormat('de-DE', { style: 'currency', currency: order.currency || 'EUR', maximumFractionDigits: 2 }).format(item.totalPrice || (pPerPack * (item.quantity || 0)))}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Mobile View Items List */}
                <div className="md:hidden flex flex-col gap-3">
                    {items.map((item: any, idx: number) => {
                        // Fallback logic duplicated for mobile view
                        const refProduct = products.find((p: any) => p.id === item.productId || p.id === item.id);
                        const unit = item.unit === 'pcs' ? 'шт' : (item.unit || refProduct?.unit || 'кг');
                        const inPack = Number(item.netWeight || item.unitPerCardboard || item.cardboardWeight || refProduct?.netWeight || refProduct?.unitPerCardboard || 0);
                        const totalCont = (Number(item.quantity) || 0) * inPack;
                        const pPerPack = Number(item.price || refProduct?.pricePerCardboard || 0);

                        return (
                            <div key={idx} className="flex gap-3 bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-100 dark:border-zinc-800">
                                <div className="h-16 w-16 rounded-lg bg-zinc-100 dark:bg-zinc-800 flex-shrink-0 overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                    {item.image ? (
                                        <img src={item.image} className="object-cover h-full w-full" alt="" />
                                    ) : (
                                        <div className="h-full w-full flex items-center justify-center text-[10px] text-zinc-400">IMG</div>
                                    )}
                                </div>
                                <div className="flex-1 flex flex-col justify-between min-w-0">
                                    <div>
                                        <div className="flex justify-between items-start gap-2">
                                            <h5 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 truncate">{item.name}</h5>
                                            <span className="font-mono font-bold text-primary text-sm whitespace-nowrap">
                                                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: order.currency || 'EUR', maximumFractionDigits: 2 }).format(item.totalPrice || (pPerPack * (item.quantity || 0)))}
                                            </span>
                                        </div>
                                        {item.category && <p className="text-[10px] text-zinc-400 uppercase tracking-wider">{item.category}</p>}
                                    </div>

                                    <div className="flex items-center justify-between mt-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="secondary" className="text-[10px] px-1.5 h-4 font-bold bg-zinc-100 text-zinc-600 border-zinc-200">
                                                {item.quantity} уп
                                            </Badge>
                                            <span className="text-[10px] text-zinc-400">
                                                x {new Intl.NumberFormat('de-DE', { style: 'currency', currency: order.currency || 'EUR' }).format(pPerPack)}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-bold text-xs text-zinc-700 dark:text-zinc-300">{totalCont.toFixed(unit === 'шт' ? 0 : 2)} {unit}</div>
                                            <div className="text-[9px] text-zinc-400">({inPack} {unit}/уп)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
