'use client';

import React, { useState, useEffect } from 'react';
import { getOrders, getProducts } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Loader2, RefreshCw, Calendar, PieChart, FileText } from 'lucide-react';

const PREFERRED_PRODUCT_ORDER = [
    'Pomidor malinowy BBB/Tomaten pink BBB',
    'Ogórek/Einlegegurken',
    'SOgórek/Salat gurke',
    'Jabłko/Apfel Gloster',
    'Jabłko/Apfel Idared',
    'Jabłko/Apfel Prince',
    'Jabłko/Apfel Champion',
    'Jabłko/Apfel Golden',
    'Jabłko/Apfel Red Chief',
    'Jabłko/Apfel Jonagored',
    'Jabłko/Apfel Eliza',
    'Jabłko/Apfel Lobo',
    'grusza / birne',
    'grzyby suszone Borowik / Getrocknete Pilze',
    'Zestaw do zup/Suppe gesetzt',
    'Cebula żółta/ Zwiebel gelbe',
    'cebula czerwona',
    'Kapusta pekińska',
    'Burak/Rotebete',
    'Pietruszka/Petersilie',
    'seler/sellerie',
    'marchew / karotte',
    'czarna rzepa/Schwarze Rübe',
    'Kapusta / weiBkohl',
    'Czosnek/Knoblauch'
];

export default function AggregationPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 7)).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [aggregatedData, setAggregatedData] = useState<any[]>([]);
    const [aggregatedByCustomer, setAggregatedByCustomer] = useState<any[]>([]);
    const [productHeaders, setProductHeaders] = useState<{ name: string, unit: string }[]>([]);
    const [isAggregating, setIsAggregating] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        const p = await getProducts();
        setProducts(p);
        // Trigger initial aggregation
        loadAggregation(p);
    }

    async function loadAggregation(currentProducts = products) {
        setIsAggregating(true);
        try {
            const start = new Date(startDate);
            const end = new Date(endDate);
            const filteredOrders = await getOrders(start, end);

            // Pivot data: Record<CustomerName, Record<ProductName, { packs: number, weight: number, unit: string }>>
            const pivotMap: Record<string, {
                products: Record<string, { packs: number, weight: number, unit: string }>,
                totalWeight: number,
                email: string
            }> = {};
            const productSet = new Set<string>();
            const productInfoMap: Record<string, string> = {}; // Name -> Unit

            // Add all available products from the current products state
            currentProducts.forEach(p => {
                productSet.add(p.name);
                productInfoMap[p.name] = p.unit || 'kg';
            });

            filteredOrders.forEach((order: any) => {
                const customerKey = order.customerName;
                if (!pivotMap[customerKey]) {
                    pivotMap[customerKey] = {
                        products: {},
                        totalWeight: 0,
                        email: order.customerEmail
                    };
                }

                const items = Array.isArray(order.items) ? order.items : [];
                items.forEach((item: any) => {
                    const productName = item.name;
                    productSet.add(productName);

                    const qty = item.quantity || 0;
                    const cweight = item.cardboardWeight || 0;
                    const itemTotalWeight = qty * cweight;
                    const unit = item.unit || productInfoMap[productName] || 'kg';

                    if (!pivotMap[customerKey].products[productName]) {
                        pivotMap[customerKey].products[productName] = { packs: 0, weight: 0, unit };
                    }

                    pivotMap[customerKey].products[productName].packs += qty;
                    pivotMap[customerKey].products[productName].weight += itemTotalWeight;
                    pivotMap[customerKey].totalWeight += itemTotalWeight;

                    productInfoMap[productName] = unit;
                });
            });

            const sortedProducts = Array.from(productSet).sort((a, b) => {
                const indexA = PREFERRED_PRODUCT_ORDER.indexOf(a);
                const indexB = PREFERRED_PRODUCT_ORDER.indexOf(b);
                if (indexA === -1 && indexB === -1) return a.localeCompare(b);
                if (indexA === -1) return 1;
                if (indexB === -1) return -1;
                return indexA - indexB;
            });

            const headers = sortedProducts.map(name => ({
                name,
                unit: productInfoMap[name] || 'kg'
            }));

            setProductHeaders(headers);

            const customerData = Object.entries(pivotMap).map(([name, data]) => ({
                customerName: name,
                ...data
            }));
            setAggregatedByCustomer(customerData);

            // Total stats per product for summary
            const productsMap: Record<string, any> = {};
            filteredOrders.forEach((order: any) => {
                const items = Array.isArray(order.items) ? order.items : [];
                items.forEach((item: any) => {
                    const key = item.productId || item.name;
                    if (!productsMap[key]) {
                        productsMap[key] = {
                            name: item.name,
                            totalPacks: 0,
                            totalRevenue: 0,
                            currency: order.currency || 'EUR'
                        };
                    }
                    productsMap[key].totalPacks += (item.quantity || 0);
                    productsMap[key].totalRevenue += (item.totalPrice || ((item.price || 0) * (item.quantity || 0)));
                });
            });
            setAggregatedData(Object.values(productsMap));

        } catch (error) {
            console.error('Aggregation failed:', error);
        } finally {
            setIsAggregating(false);
        }
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Aggregation & Reporting</h2>
                    <p className="text-zinc-500 dark:text-zinc-400">Analyze sales performance and consolidated orders</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => loadAggregation()}
                    disabled={isAggregating}
                    className="rounded-full shadow-sm hover:shadow-md transition-all bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                >
                    {isAggregating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
                    Create Report
                </Button>
            </div>

            <Card className="border-none shadow-sm bg-white dark:bg-zinc-900">
                <CardHeader className="pb-4">
                    <CardTitle className="text-xl">Filters</CardTitle>
                    <CardDescription>Select date range for aggregation</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="space-y-1.5 flex-1 min-w-[200px]">
                            <Label htmlFor="startDate" className="text-xs font-bold text-zinc-500 uppercase">From Date</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="pl-10 h-10 w-full"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5 flex-1 min-w-[200px]">
                            <Label htmlFor="endDate" className="text-xs font-bold text-zinc-500 uppercase">To Date</Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <Input
                                    id="endDate"
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="pl-10 h-10 w-full"
                                />
                            </div>
                        </div>
                        <Button
                            onClick={() => loadAggregation()}
                            disabled={isAggregating}
                            className="h-10 bg-primary shadow-lg glow-primary px-6 rounded-full"
                        >
                            {isAggregating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            Update Data
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg">Shops Aggregation</CardTitle>
                        <CardDescription>Consolidated orders by shop (packs per product)</CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto relative no-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[1200px]">
                            <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-[10px] uppercase font-bold text-zinc-500 sticky top-0 z-10 border-b border-zinc-100 dark:border-zinc-800">
                                <tr>
                                    <th className="px-4 py-3 sticky left-0 z-20 bg-zinc-50 dark:bg-zinc-800 border-r border-zinc-100 dark:border-zinc-700 w-[200px] min-w-[200px]">Магазини</th>
                                    {productHeaders.map(header => (
                                        <th key={header.name} className="px-2 py-3 text-center border-r border-zinc-100 dark:border-zinc-700 min-w-[100px] max-w-[150px]">
                                            <span className="block truncate" title={header.name}>{header.name}</span>
                                            <span className="block text-[8px] font-normal text-zinc-400 normal-case">{header.unit}</span>
                                        </th>
                                    ))}
                                    <th className="px-4 py-3 text-right bg-zinc-50 dark:bg-zinc-800 border-l border-zinc-100 dark:border-zinc-700 w-[100px] min-w-[100px]">waga</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {aggregatedByCustomer.length === 0 ? (
                                    <tr>
                                        <td colSpan={productHeaders.length + 2} className="px-6 py-12 text-center text-zinc-500 font-medium">
                                            No data for selected range.
                                        </td>
                                    </tr>
                                ) : (
                                    aggregatedByCustomer.map((customer, idx) => (
                                        <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors group">
                                            <td className="px-4 py-3 sticky left-0 z-20 bg-white dark:bg-zinc-900 border-r border-zinc-100 dark:border-zinc-800 font-bold text-zinc-700 dark:text-zinc-300 group-hover:bg-zinc-50 dark:group-hover:bg-zinc-800">
                                                <div className="flex flex-col">
                                                    <span className="truncate">{customer.customerName}</span>
                                                    <span className="text-[9px] font-normal text-zinc-400">{customer.email}</span>
                                                </div>
                                            </td>
                                            {productHeaders.map(header => {
                                                const itemData = customer.products[header.name];
                                                const qty = itemData?.packs || 0;
                                                const weight = itemData?.weight || 0;
                                                const unit = itemData?.unit || header.unit;

                                                return (
                                                    <td key={header.name} className={`px-2 py-2 text-center border-r border-zinc-50 dark:border-zinc-800 ${qty > 0 ? 'bg-primary/5 dark:bg-primary/10' : ''}`}>
                                                        {qty > 0 ? (
                                                            <div className="flex flex-col items-center">
                                                                <span className="font-mono text-xs font-bold text-primary">{qty} <span className="text-[8px] opacity-70">pks</span></span>
                                                                <span className="text-[9px] font-mono font-medium text-zinc-500 whitespace-nowrap">
                                                                    {weight.toFixed(1)} <span className="text-[8px]">{unit}</span>
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-zinc-300">-</span>
                                                        )}
                                                    </td>
                                                );
                                            })}
                                            <td className="px-4 py-3 text-right bg-zinc-50/30 dark:bg-zinc-800/20 font-mono font-bold text-zinc-600 dark:text-zinc-400 border-l border-zinc-100 dark:border-zinc-800">
                                                {customer.totalWeight.toFixed(1)}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                            <tfoot className="bg-zinc-50 dark:bg-zinc-800/50 border-t-2 border-zinc-200 dark:border-zinc-700">
                                <tr className="font-bold text-[10px] text-zinc-600 dark:text-zinc-300">
                                    <td className="px-4 py-3 sticky left-0 z-20 bg-zinc-100 dark:bg-zinc-800 border-r border-zinc-200 dark:border-zinc-700">SUBTOTAL</td>
                                    {productHeaders.map(header => {
                                        const totalPacks = aggregatedByCustomer.reduce((sum, c) => sum + (c.products[header.name]?.packs || 0), 0);
                                        const totalWeight = aggregatedByCustomer.reduce((sum, c) => sum + (c.products[header.name]?.weight || 0), 0);
                                        return (
                                            <td key={header.name} className="px-2 py-2 text-center border-r border-zinc-200 dark:border-zinc-700 font-mono">
                                                <div className="flex flex-col items-center">
                                                    <span className="text-zinc-800 dark:text-zinc-200">{totalPacks}</span>
                                                    <span className="text-[9px] font-normal text-zinc-400">{totalWeight.toFixed(1)}</span>
                                                </div>
                                            </td>
                                        );
                                    })}
                                    <td className="px-4 py-3 text-right bg-zinc-100 dark:bg-zinc-800 border-l border-zinc-200 dark:border-zinc-700 font-mono text-primary text-xs">
                                        TOT: {aggregatedByCustomer.reduce((sum, c) => sum + (c.totalWeight || 0), 0).toFixed(1)}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm bg-primary text-white overflow-hidden relative min-h-[160px]">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <PieChart size={120} />
                    </div>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg">Revenue Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-baseline gap-2">
                            <p className="text-[10px] uppercase font-bold text-primary-foreground/60 tracking-wider">Total Sales:</p>
                            <p className="text-3xl font-black">
                                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(
                                    aggregatedData.reduce((acc, item) => acc + item.totalRevenue, 0)
                                )}
                            </p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
                            <div>
                                <p className="text-[9px] opacity-60 uppercase">Shops</p>
                                <p className="font-bold">{aggregatedByCustomer.length}</p>
                            </div>
                            <div>
                                <p className="text-[9px] opacity-60 uppercase">Products</p>
                                <p className="font-bold">{productHeaders.length}</p>
                            </div>
                            <div>
                                <p className="text-[9px] opacity-60 uppercase">Packs</p>
                                <p className="font-bold">{aggregatedData.reduce((acc, item) => acc + item.totalPacks, 0)}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 flex flex-col justify-center p-6 text-center">
                    <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-2">Detailed Report Info</h3>
                    <p className="text-zinc-400 text-xs italic">
                        This view aggregates all orders between {new Date(startDate).toLocaleDateString()} and {new Date(endDate).toLocaleDateString()}.
                    </p>
                </Card>
            </div>
        </div >
    );
}
