'use client';

import React, { useState, useEffect } from 'react';
import { getPaginatedProducts, getProducts, addProduct, updateProduct, toggleProductStatus, syncProducts, deleteProduct, exportProductsToSheets, getSheetName } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, RefreshCw, Save, Trash2, LayoutDashboard, Utensils, Search, Package, Image as ImageIcon, Pencil, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface ProductFormProps {
    newProduct: any;
    setNewProduct: (val: any) => void;
    editingId: string | null;
    handleAddProduct: (e: React.FormEvent) => void;
    resetForm: () => void;
    setShowAddForm: (val: boolean) => void;
    setEditingId: (val: string | null) => void;
    isInline?: boolean;
}

const ProductForm = ({
    newProduct,
    setNewProduct,
    editingId,
    handleAddProduct,
    resetForm,
    setShowAddForm,
    setEditingId,
    isInline = false
}: ProductFormProps) => (
    <form onSubmit={handleAddProduct} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-12 xl:col-span-7 space-y-4">
            <div className={cn("bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700 space-y-4", isInline && "p-3")}>
                <h3 className="font-semibold text-base flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                    <Package className="h-4 w-4 text-primary" />
                    Інформація про товар
                </h3>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-[10px] font-bold uppercase text-zinc-400">Назва товару *</Label>
                        <Input
                            id="name"
                            placeholder="напр. Помідори Червоні"
                            value={newProduct.name}
                            onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                            className="rounded-lg h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 focus:border-primary"
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="category" className="text-[10px] font-bold uppercase text-zinc-400">Категорія *</Label>
                            <Input
                                id="category"
                                placeholder="напр. Овочі"
                                value={newProduct.category}
                                onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                                className="rounded-lg h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="image" className="text-[10px] font-bold uppercase text-zinc-400">Фото</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="image"
                                    placeholder="https://..."
                                    value={newProduct.image}
                                    onChange={e => setNewProduct({ ...newProduct, image: e.target.value })}
                                    className="rounded-lg h-10 bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
                                />
                                {newProduct.image && (
                                    <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                                        <img src={newProduct.image} alt="Preview" className="h-full w-full object-cover" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="lg:col-span-12 xl:col-span-5 space-y-4">
            <div className={cn("bg-zinc-50 dark:bg-zinc-800/50 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-700 h-full flex flex-col", isInline && "p-3")}>
                <h3 className="font-semibold text-base flex items-center gap-2 text-zinc-900 dark:text-zinc-100 mb-4">
                    <Utensils className="h-4 w-4 text-green-600" />
                    Ціна та Пакування
                </h3>
                <div className="space-y-4 flex-1">
                    <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                        <div className={cn("grid gap-4", newProduct.unit === 'pcs' ? "grid-cols-1 sm:grid-cols-3" : "grid-cols-1 sm:grid-cols-2")}>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-zinc-400">Од. вим.</Label>
                                <Select value={newProduct.unit} onValueChange={(v) => setNewProduct({ ...newProduct, unit: v })}>
                                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="kg">кг</SelectItem><SelectItem value="pcs">шт</SelectItem></SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-zinc-400">Ціна за {newProduct.unit === 'kg' ? 'кг' : 'шт'}</Label>
                                <div className="relative">
                                    <Input
                                        type="number" step="0.01" value={newProduct.pricePerUnit}
                                        onChange={e => {
                                            const p = parseFloat(e.target.value) || 0;
                                            const w = parseFloat(newProduct.netWeight.toString()) || 0;
                                            const c = parseFloat(newProduct.unitPerCardboard.toString()) || 0;
                                            let pc = newProduct.pricePerCardboard;
                                            if (newProduct.unit === 'kg') pc = w > 0 ? (p * w).toFixed(2) : pc;
                                            else if (newProduct.unit === 'pcs') pc = c > 0 ? (p * c).toFixed(2) : pc;
                                            setNewProduct({ ...newProduct, pricePerUnit: e.target.value, pricePerCardboard: pc });
                                        }}
                                        className="rounded-lg h-10 pl-7 font-mono font-bold text-green-700 bg-zinc-50/50"
                                    />
                                    <span className="absolute left-2.5 top-2.5 text-xs font-bold text-green-600/50">€</span>
                                </div>
                            </div>
                            {newProduct.unit === 'pcs' && (
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-bold uppercase text-zinc-400">Шт/Уп</Label>
                                    <Input
                                        type="number" value={newProduct.unitPerCardboard}
                                        onChange={e => {
                                            const c = parseFloat(e.target.value) || 0;
                                            const pu = parseFloat(newProduct.pricePerUnit.toString()) || 0;
                                            const pc = c > 0 ? (pu * c).toFixed(2) : newProduct.pricePerCardboard;
                                            setNewProduct({ ...newProduct, unitPerCardboard: e.target.value, pricePerCardboard: pc });
                                        }}
                                        className="rounded-lg h-10"
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-zinc-400">Вага Уп (кг)</Label>
                                <div className="relative">
                                    <Input
                                        type="number" step="0.01" value={newProduct.netWeight}
                                        onChange={e => {
                                            const w = parseFloat(e.target.value) || 0;
                                            const pu = parseFloat(newProduct.pricePerUnit.toString()) || 0;
                                            let pc = newProduct.pricePerCardboard;
                                            if (newProduct.unit === 'kg') pc = w > 0 ? (pu * w).toFixed(2) : pc;
                                            setNewProduct({ ...newProduct, netWeight: e.target.value, pricePerCardboard: pc });
                                        }}
                                        className="rounded-lg h-10 pr-7"
                                    />
                                    <span className="absolute right-2.5 top-2.5 text-[10px] text-zinc-400">кг</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-bold uppercase text-zinc-400">Ціна Уп</Label>
                                <div className="relative">
                                    <Input
                                        type="number" step="0.01" value={newProduct.pricePerCardboard}
                                        onChange={e => setNewProduct({ ...newProduct, pricePerCardboard: e.target.value })}
                                        className="rounded-lg h-10 pl-7 font-mono font-bold bg-amber-50/20"
                                    />
                                    <span className="absolute left-2.5 top-2.5 text-xs font-bold text-amber-600/50">€</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-zinc-900 p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-bold uppercase text-zinc-400">Тип агрегації у звіті</Label>
                            <Select
                                value={newProduct.agregationResult}
                                onValueChange={(v) => setNewProduct({ ...newProduct, agregationResult: v })}
                            >
                                <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="weight">Вага (Total Weight)</SelectItem>
                                    <SelectItem value="cardboard">Штуки (Pcs / Boxes)</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-zinc-400">
                                Визначає, як цей товар буде відображатися у зведеному звіті: як загальна вага або як кількість ящиків/штук.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-4 lg:col-span-12">
            <Button type="submit" size="sm" className="w-full sm:w-auto px-8 rounded-full font-bold shadow-lg">
                <Save className="mr-2 h-4 w-4" />
                {editingId ? 'Зберегти зміни' : 'Додати товар'}
            </Button>
            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                    resetForm();
                    setShowAddForm(false);
                    setEditingId(null);
                }}
                className="w-full sm:w-auto text-zinc-400 rounded-full"
            >
                Скасувати
            </Button>
        </div>
    </form>
);

export default function ProductsPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isMounted, setIsMounted] = useState(false);
    const [sheetName, setSheetName] = useState('...');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalProducts, setTotalProducts] = useState(0);
    const [activeCount, setActiveCount] = useState(0);
    const limit = 20;

    const [newProduct, setNewProduct] = useState({
        name: '',
        category: 'Vreča',
        pricePerUnit: '' as any,
        pricePerCardboard: '' as any,
        netWeight: '' as any,
        unitPerCardboard: '' as any,
        unit: 'kg',
        currency: 'EUR',
        image: '',
        agregationResult: 'weight',
        active: true,
    });

    const isFirstRender = React.useRef(true);

    useEffect(() => {
        setIsMounted(true);
        loadProducts();
        getSheetName().then(setSheetName);
    }, []);

    // Search debounce
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }

        const handler = setTimeout(() => {
            loadProducts(1, searchQuery);
        }, 500);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    async function loadProducts(page = currentPage, query = searchQuery) {
        setIsLoading(true);
        setLoadError(null);
        try {
            const data = await getPaginatedProducts(page, limit, query);
            setProducts(data.products);
            setTotalProducts(data.totalCount);
            setTotalPages(data.totalPages);
            setActiveCount(data.activeCount);
            setCurrentPage(page);
        } catch (error) {
            setLoadError('Не вдалося завантажити список товарів');
        } finally {
            setIsLoading(false);
        }
    }

    async function handleSync() {
        setIsSyncing(true);
        const result = await syncProducts();
        if (result.success) {
            toast.success(`Успішно синхронізовано ${result.count} товарів з Google Sheets!`);
            loadProducts();
        } else {
            toast.error('Помилка синхронізації: ' + result.error);
        }
        setIsSyncing(false);
    }

    async function handleAddProduct(e: React.FormEvent) {
        e.preventDefault();

        // Validation
        const requiredFields = [
            { key: 'name', label: 'Назва товару' },
            { key: 'category', label: 'Категорія' },
            { key: 'unit', label: 'Базова одиниця' },
            { key: 'pricePerUnit', label: 'Ціна за одиницю' },
            { key: 'pricePerCardboard', label: 'Ціна за упаковку' },
            { key: 'netWeight', label: 'Вага упаковки' },
        ];

        for (const field of requiredFields) {
            const value = (newProduct as any)[field.key];
            if (value === '' || value === undefined || value === null) {
                toast.warning(`Поле "${field.label}" є обов'язковим`);
                return;
            }
        }

        const submissionData = {
            ...newProduct,
            pricePerUnit: parseFloat(newProduct.pricePerUnit.toString()) || 0,
            pricePerCardboard: parseFloat(newProduct.pricePerCardboard.toString()) || 0,
            netWeight: parseFloat(newProduct.netWeight.toString()) || 0,
            unitPerCardboard: parseFloat(newProduct.unitPerCardboard.toString()) || 0,
        };

        const result = editingId
            ? await updateProduct(editingId, submissionData)
            : await addProduct(submissionData);

        if (result.success) {
            setShowAddForm(false);
            setEditingId(null);
            setNewProduct({
                name: '',
                category: 'Vreča',
                pricePerUnit: '' as any,
                pricePerCardboard: '' as any,
                netWeight: '' as any,
                unitPerCardboard: '' as any,
                unit: 'kg',
                currency: 'EUR',
                image: '',
                agregationResult: 'weight',
                active: true,
            });
            loadProducts();
        } else {
            toast.error('Помилка: ' + result.error);
        }
    }

    async function handleToggleStatus(id: string, currentStatus: boolean) {
        const result = await toggleProductStatus(id, !currentStatus);
        if (!result.success) {
            toast.error('Помилка при зміні статусу: ' + result.error);
        } else {
            toast.success('Статус оновлено');
        }
        loadProducts();
    }

    async function handleDeleteProduct(id: string, name: string) {
        if (confirm(`Ви впевнені, що хочете видалити ${name}?`)) {
            const result = await deleteProduct(id);
            if (result.success) {
                toast.success('Товар видалено');
                loadProducts();
            } else {
                toast.error('Помилка: ' + result.error);
            }
        }
    }

    function resetForm() {
        setEditingId(null);
        setNewProduct({
            name: '',
            category: 'Vreča',
            pricePerUnit: '' as any,
            pricePerCardboard: '' as any,
            netWeight: '' as any,
            unitPerCardboard: '' as any,
            unit: 'kg',
            currency: 'EUR',
            image: '',
            agregationResult: 'weight',
            active: true,
        });
    }

    function handleAddButtonClick() {
        setEditingId(null);
        if (showAddForm) {
            setShowAddForm(false);
        } else {
            resetForm();
            setShowAddForm(true);
        }
    }

    function startEdit(product: any) {
        if (editingId === product.id) {
            setEditingId(null);
            return;
        }
        setShowAddForm(false);
        setEditingId(product.id);
        setNewProduct({
            name: product.name,
            category: product.category,
            pricePerUnit: (product.pricePerUnit || 0).toString() as any,
            pricePerCardboard: (product.pricePerCardboard || 0).toString() as any,
            netWeight: (product.netWeight || 0).toString() as any,
            unitPerCardboard: (product.unitPerCardboard || 0).toString() as any,
            unit: product.unit || 'kg',
            currency: product.currency || 'EUR',
            image: product.image || '',
            agregationResult: product.agregationResult || '',
            active: product.active,
        });
    }


    const filteredProducts = products;

    if (!isMounted) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-8">
                <div className="flex flex-col items-center gap-4 text-zinc-500">
                    <Loader2 size={40} className="animate-spin text-primary" />
                    <p className="font-medium">Завантаження...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-zinc-100 dark:bg-zinc-950 p-2 sm:p-4 md:p-8 space-y-4 sm:space-y-6">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Бібліотека товарів</h2>
                    <p className="text-[10px] text-zinc-500 font-medium mt-1 flex items-center gap-1">
                        <RefreshCw size={10} className="text-green-600 animate-spin-slow" />
                        Автоматична синхронізація з Google Sheets (лист: {sheetName})
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        onClick={handleAddButtonClick}
                        className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all h-9 px-4 sm:h-10 sm:px-6"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Додати товар
                    </Button>
                </div>
            </div>

            {/* Stats / Quick Info */}
            <div className="grid grid-cols-2 gap-4 sm:gap-6">
                <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                    <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2 text-center">
                        <CardDescription className="text-[10px] sm:text-xs uppercase font-bold tracking-wider">Всього</CardDescription>
                        <CardTitle className="text-2xl sm:text-3xl font-black">{totalProducts}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                    <CardHeader className="p-2 sm:p-4 pb-1 sm:pb-2 text-center">
                        <CardDescription className="text-[10px] sm:text-xs uppercase font-bold tracking-wider">Активні</CardDescription>
                        <CardTitle className="text-2xl sm:text-3xl font-black text-green-600">
                            {activeCount}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Add Product Form (Top-level) */}
            {showAddForm && !editingId && (
                <Card className="border-2 border-primary/20 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-xl font-black">Новий товар</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6">
                        <ProductForm
                            newProduct={newProduct}
                            setNewProduct={setNewProduct}
                            editingId={editingId}
                            handleAddProduct={handleAddProduct}
                            resetForm={resetForm}
                            setShowAddForm={setShowAddForm}
                            setEditingId={setEditingId}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Список товарів */}
            <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-4 p-3 sm:p-6">

                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Пошук товарів..."
                            className="pl-10 rounded-full h-10 bg-zinc-50 dark:bg-zinc-800 border-none"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-20 flex flex-col items-center justify-center gap-4 text-zinc-500">
                            <Loader2 size={40} className="animate-spin text-primary" />
                            <p className="font-medium animate-pulse">Завантаження бази даних...</p>
                        </div>
                    ) : loadError ? (
                        <div className="p-20 text-center space-y-4">
                            <div className="h-16 w-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto">
                                <Package size={32} />
                            </div>
                            <p className="text-red-600 font-medium">{loadError}</p>
                            <Button variant="outline" size="sm" onClick={() => loadProducts()} className="rounded-full">
                                Спробувати ще раз
                            </Button>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="p-20 text-center space-y-4">
                            <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                                <Package size={32} />
                            </div>
                            <p className="text-zinc-500">Товарів не знайдено.</p>
                        </div>
                    ) : (
                        <div>
                            {/* Mobile View (Cards) */}
                            <div className="grid grid-cols-1 gap-0 divide-y divide-zinc-100 dark:divide-zinc-800 md:hidden">
                                {filteredProducts.map((p) => (
                                    <div key={p.id} className={cn("flex flex-col bg-white dark:bg-zinc-900 transition-all", editingId === p.id && "ring-2 ring-primary ring-inset border-primary shadow-lg")}>
                                        <div
                                            className="p-3 flex flex-col gap-3 cursor-pointer"
                                            onClick={() => startEdit(p)}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="h-16 w-16 shrink-0 rounded-xl bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                                                    {p.image ? (
                                                        <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                                                    ) : (
                                                        <ImageIcon size={24} className="text-zinc-400" />
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate text-lg leading-tight">{p.name}</p>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <Badge variant="secondary" className="px-2 py-0 h-5 text-[10px] rounded-md font-semibold bg-zinc-100 text-zinc-600 border-none">
                                                            {p.category}
                                                        </Badge>
                                                        {p.agregationResult && (
                                                            <Badge variant="outline" className="px-2 py-0 h-5 text-[10px] rounded-md font-semibold border-zinc-200 text-zinc-400">
                                                                {p.agregationResult}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(p.id, p.active); }}
                                                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all shadow-sm cursor-pointer ${p.active
                                                            ? 'bg-green-100 text-green-700'
                                                            : 'bg-zinc-100 text-zinc-500'
                                                            }`}
                                                    >
                                                        {p.active ? 'Активний' : 'Прихований'}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-zinc-50 dark:border-zinc-800/50">
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-1">Ціна за {p.unit}</p>
                                                    <p className="font-mono font-bold text-primary text-base">
                                                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: p.currency || 'EUR' }).format(p.pricePerUnit)}
                                                    </p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider mb-1">За упаковку</p>
                                                    <p className="font-mono font-bold text-zinc-600 dark:text-zinc-400">
                                                        {new Intl.NumberFormat('de-DE', { style: 'currency', currency: p.currency || 'EUR' }).format(p.pricePerCardboard || 0)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {editingId === p.id && (
                                            <div className="p-4 border-t-2 border-primary/10 bg-zinc-50/50 dark:bg-zinc-800/30 animate-in slide-in-from-top-2 duration-300">
                                                <ProductForm
                                                    newProduct={newProduct}
                                                    setNewProduct={setNewProduct}
                                                    editingId={editingId}
                                                    handleAddProduct={handleAddProduct}
                                                    resetForm={resetForm}
                                                    setShowAddForm={setShowAddForm}
                                                    setEditingId={setEditingId}
                                                    isInline
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Desktop View (Table) */}
                            <div className="hidden md:block overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                                        <tr>
                                            <th className="px-6 py-4">Товар / Категорія</th>
                                            <th className="px-6 py-4 text-center">Пакування</th>
                                            <th className="px-6 py-4">Ціна (Од / Уп)</th>
                                            <th className="px-6 py-4">Статус</th>
                                            <th className="px-6 py-4 text-right">Дії</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                        {filteredProducts.map((p) => (
                                            <React.Fragment key={p.id}>
                                                <tr
                                                    className={cn(
                                                        "group transition-colors cursor-pointer",
                                                        editingId === p.id ? "bg-primary/5 dark:bg-primary/10" : "hover:bg-zinc-50/10 dark:hover:bg-zinc-800/20"
                                                    )}
                                                    onClick={() => startEdit(p)}
                                                >
                                                    <td className="px-6 py-4">
                                                        <div className="flex items-center gap-4">
                                                            <div className="h-12 w-12 shrink-0 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                                                                {p.image ? (
                                                                    <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                                                                ) : (
                                                                    <ImageIcon size={20} className="text-zinc-400" />
                                                                )}
                                                            </div>
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <p className="font-bold text-zinc-900 dark:text-zinc-100 truncate">{p.name}</p>
                                                                    {p.agregationResult && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                                                                            {p.agregationResult}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex items-center gap-2 mt-0.5">
                                                                    <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] rounded-sm font-medium bg-zinc-100 text-zinc-500 group-hover:bg-white transition-colors">
                                                                        {p.category}
                                                                    </Badge>
                                                                    <span className="text-[10px] text-zinc-300 font-mono">#{p.id.slice(0, 8)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="inline-flex flex-col items-center">
                                                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                                                {p.unit === 'kg' ? `${p.netWeight} кг` : `${p.unitPerCardboard} шт. ${p.netWeight > 0 ? `(${p.netWeight} кг)` : ''}`}
                                                            </span>
                                                            <span className="text-[10px] text-zinc-400 uppercase tracking-tighter">в упаковці</span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <div className="flex flex-col">
                                                            <span className="font-mono font-bold text-primary">
                                                                {new Intl.NumberFormat('de-DE', { style: 'currency', currency: p.currency || 'EUR' }).format(p.pricePerUnit)}
                                                            </span>
                                                            <span className="text-[10px] font-medium text-zinc-400">
                                                                Уп: {new Intl.NumberFormat('de-DE', { style: 'currency', currency: p.currency || 'EUR' }).format(p.pricePerCardboard || 0)}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleToggleStatus(p.id, p.active); }}
                                                            className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm cursor-pointer ${p.active
                                                                ? 'bg-green-50 text-green-600 hover:bg-green-100 border border-green-100'
                                                                : 'bg-zinc-50 text-zinc-400 hover:bg-zinc-100 border border-zinc-100'
                                                                }`}
                                                        >
                                                            {p.active ? 'Активний' : 'Прихований'}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 text-right">
                                                        <div className="flex items-center justify-end gap-1">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className={cn("h-8 w-8 rounded-full transition-colors", editingId === p.id ? "bg-primary text-white" : "hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-blue-900/20")}
                                                                onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                                                            >
                                                                <Pencil size={14} />
                                                            </Button>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 rounded-full text-red-400 hover:bg-red-50 hover:text-red-600"
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteProduct(p.id, p.name); }}
                                                            >
                                                                <Trash2 size={16} />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                                {editingId === p.id && (
                                                    <tr>
                                                        <td colSpan={5} className="px-6 py-8 bg-zinc-50/50 dark:bg-zinc-800/30 border-b-2 border-primary/20">
                                                            <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-top-2 duration-300">
                                                                <div className="flex items-center justify-between mb-6">
                                                                    <h3 className="text-lg font-black flex items-center gap-2">
                                                                        <Pencil className="text-primary h-5 w-5" />
                                                                        Редагування: <span className="text-zinc-500">{p.name}</span>
                                                                    </h3>
                                                                </div>
                                                                <ProductForm
                                                                    newProduct={newProduct}
                                                                    setNewProduct={setNewProduct}
                                                                    editingId={editingId}
                                                                    handleAddProduct={handleAddProduct}
                                                                    resetForm={resetForm}
                                                                    setShowAddForm={setShowAddForm}
                                                                    setEditingId={setEditingId}
                                                                    isInline
                                                                />
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pb-8">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => loadProducts(currentPage - 1)}
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
                        onClick={() => loadProducts(currentPage + 1)}
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
