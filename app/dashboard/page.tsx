'use client';

import React, { useState, useEffect } from 'react';
import { getProducts, addProduct, updateProduct, toggleProductStatus, syncProducts, deleteProduct } from '@/app/actions/products';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, RefreshCw, Save, Trash2, LayoutDashboard, Utensils, Search, Package, Image as ImageIcon } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';

export default function ProductsPage() {
    const [products, setProducts] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [newProduct, setNewProduct] = useState({
        name: '',
        category: 'Vreča',
        price: '' as any,
        pricePerCardboard: '' as any,
        cardboardWeight: '' as any,
        unit: 'kg',
        currency: 'EUR',
        image: '',
        active: true,
    });

    useEffect(() => {
        loadProducts();
    }, []);

    async function loadProducts() {
        setIsLoading(true);
        const data = await getProducts();
        setProducts(data);
        setIsLoading(false);
    }

    async function handleSync() {
        setIsSyncing(true);
        const result = await syncProducts();
        if (result.success) {
            alert(`Successfully synced ${result.count} products from Google Sheets!`);
            loadProducts();
        } else {
            alert('Sync failed: ' + result.error);
        }
        setIsSyncing(false);
    }

    async function handleAddProduct(e: React.FormEvent) {
        e.preventDefault();

        // Validation
        const requiredFields = [
            { key: 'name', label: 'Product Name' },
            { key: 'category', label: 'Category' },
            { key: 'unit', label: 'Base Unit' },
            { key: 'price', label: 'Price Per Unit' },
            { key: 'pricePerCardboard', label: 'Price Per Pack' },
            { key: 'cardboardWeight', label: 'Pack Weight' },
        ];

        for (const field of requiredFields) {
            const value = (newProduct as any)[field.key];
            if (value === '' || value === undefined || value === null) {
                alert(`${field.label} is required`);
                return;
            }
        }

        const submissionData = {
            ...newProduct,
            price: parseFloat(newProduct.price.toString()) || 0,
            pricePerCardboard: parseFloat(newProduct.pricePerCardboard.toString()) || 0,
            cardboardWeight: parseFloat(newProduct.cardboardWeight.toString()) || 0,
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
                price: '' as any,
                pricePerCardboard: '' as any,
                cardboardWeight: '' as any,
                unit: 'kg',
                currency: 'EUR',
                image: '',
                active: true,
            });
            loadProducts();
        } else {
            alert('Error: ' + result.error);
        }
    }

    async function handleToggleStatus(id: string, currentStatus: boolean) {
        await toggleProductStatus(id, !currentStatus);
        loadProducts();
    }

    async function handleDeleteProduct(id: string, name: string) {
        if (confirm(`Are you sure you want to delete ${name}?`)) {
            const result = await deleteProduct(id);
            if (result.success) {
                loadProducts();
            } else {
                alert('Error: ' + result.error);
            }
        }
    }

    function resetForm() {
        setEditingId(null);
        setNewProduct({
            name: '',
            category: 'Vreča',
            price: '' as any,
            pricePerCardboard: '' as any,
            cardboardWeight: '' as any,
            unit: 'kg',
            currency: 'EUR',
            image: '',
            active: true,
        });
    }

    function handleAddButtonClick() {
        if (showAddForm && !editingId) {
            setShowAddForm(false);
        } else {
            resetForm();
            setShowAddForm(true);
        }
    }

    function startEdit(product: any) {
        setEditingId(product.id);
        setNewProduct({
            name: product.name,
            category: product.category,
            price: product.price.toString() as any,
            pricePerCardboard: (product.pricePerCardboard || 0).toString() as any,
            cardboardWeight: (product.cardboardWeight || 0).toString() as any,
            unit: product.unit || 'kg',
            currency: product.currency || 'EUR',
            image: product.image || '',
            active: product.active,
        });
        setShowAddForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const filteredProducts = products.filter(p =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-black tracking-tight text-zinc-900 dark:text-zinc-50">Products Library</h2>
                    <p className="text-zinc-500 dark:text-zinc-400">Manage your product catalog and inventory</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="rounded-full shadow-sm hover:shadow-md transition-all"
                    >
                        {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                        Sync from Sheets
                    </Button>
                    <Button
                        onClick={handleAddButtonClick}
                        className="rounded-full bg-primary hover:bg-primary/90 text-white shadow-md hover:shadow-lg transition-all"
                    >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Product
                    </Button>
                </div>
            </div>

            {/* Stats / Quick Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-3 text-primary/10">
                        <Package size={80} strokeWidth={1} />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription>Total Products</CardDescription>
                        <CardTitle className="text-4xl font-black">{products.length}</CardTitle>
                    </CardHeader>
                </Card>
                <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-3 text-green-500/10">
                        <Utensils size={80} strokeWidth={1} />
                    </div>
                    <CardHeader className="pb-2">
                        <CardDescription>Active Products</CardDescription>
                        <CardTitle className="text-4xl font-black text-green-600">
                            {products.filter(p => p.active).length}
                        </CardTitle>
                    </CardHeader>
                </Card>
            </div>

            {/* Add Product Form */}
            {showAddForm && (
                <Card className="border-2 border-primary/20 shadow-xl animate-in fade-in slide-in-from-top-4 duration-300">
                    <CardHeader>
                        <CardTitle>{editingId ? 'Edit Product' : 'Add New Product'}</CardTitle>
                        <CardDescription>
                            {editingId ? 'Update the details of the selected product' : 'Fill in the details to add a product to the database'}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {/* Basic Info Group */}
                            <div className="space-y-2 lg:col-span-2">
                                <Label htmlFor="name">Product Name *</Label>
                                <Input
                                    id="name"
                                    placeholder="e.g. Red Tomatoes"
                                    value={newProduct.name}
                                    onChange={e => setNewProduct({ ...newProduct, name: e.target.value })}
                                    className="rounded-lg h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="category">Category *</Label>
                                <Input
                                    id="category"
                                    placeholder="e.g. Vegetables"
                                    value={newProduct.category}
                                    onChange={e => setNewProduct({ ...newProduct, category: e.target.value })}
                                    className="rounded-lg h-11"
                                />
                            </div>

                            <div className="space-y-4 lg:col-span-3">
                                <Separator className="my-2" />
                                <h4 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Pricing & Units</h4>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="unit">Base Unit *</Label>
                                <Input
                                    id="unit"
                                    placeholder="e.g. kg, шт., Vreča"
                                    value={newProduct.unit}
                                    onChange={e => setNewProduct({ ...newProduct, unit: e.target.value })}
                                    className="rounded-lg h-11"
                                />
                            </div>
                            <div className="space-y-2 font-bold text-primary">
                                <Label htmlFor="price">Price Per Unit * ({newProduct.currency})</Label>
                                <Input
                                    id="price"
                                    type="number"
                                    step="0.01"
                                    value={newProduct.price}
                                    onChange={e => setNewProduct({ ...newProduct, price: e.target.value })}
                                    className="rounded-lg h-11 border-primary/30"
                                />
                            </div>
                            <div className="hidden lg:block"></div>

                            <div className="space-y-2">
                                <Label htmlFor="weight">Pack Weight *</Label>
                                <Input
                                    id="weight"
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g. 5"
                                    value={newProduct.cardboardWeight}
                                    onChange={e => setNewProduct({ ...newProduct, cardboardWeight: e.target.value })}
                                    className="rounded-lg h-11"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="pricePerCardboard">Price Per Pack *</Label>
                                <Input
                                    id="pricePerCardboard"
                                    type="number"
                                    step="0.01"
                                    value={newProduct.pricePerCardboard}
                                    onChange={e => setNewProduct({ ...newProduct, pricePerCardboard: e.target.value })}
                                    className="rounded-lg h-11"
                                />
                            </div>
                            <div className="hidden lg:block"></div>

                            <div className="space-y-4 lg:col-span-3">
                                <Separator className="my-2" />
                                <h4 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">Media</h4>
                            </div>

                            <div className="space-y-2 lg:col-span-3">
                                <Label htmlFor="image">Image URL</Label>
                                <Input
                                    id="image"
                                    placeholder="https://..."
                                    value={newProduct.image}
                                    onChange={e => setNewProduct({ ...newProduct, image: e.target.value })}
                                    className="rounded-lg h-11"
                                />
                            </div>

                            <div className="flex items-end pt-6 lg:col-span-3">
                                <Button type="submit" size="lg" className="w-full md:w-auto px-12 rounded-full font-bold shadow-lg hover:shadow-primary/20 transition-all">
                                    <Save className="mr-2 h-5 w-5" />
                                    {editingId ? 'Update Product' : 'Create & Add to Store'}
                                </Button>
                                {editingId && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => {
                                            resetForm();
                                            setShowAddForm(false);
                                        }}
                                        className="ml-4 text-zinc-500"
                                    >
                                        Cancel
                                    </Button>
                                )}
                            </div>
                        </form>
                    </CardContent>
                </Card>
            )}

            {/* Product List */}
            <Card className="border-none shadow-sm bg-white dark:bg-zinc-900 overflow-hidden">
                <CardHeader className="border-b border-zinc-100 dark:border-zinc-800 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-xl">Product Library</CardTitle>
                        <CardDescription>View and manage all your products</CardDescription>
                    </div>
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                        <Input
                            placeholder="Search products..."
                            className="pl-10 rounded-full h-9 bg-zinc-50 dark:bg-zinc-800 border-none"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="p-20 flex flex-col items-center justify-center gap-4 text-zinc-500">
                            <Loader2 size={40} className="animate-spin text-primary" />
                            <p className="font-medium animate-pulse">Loading product database...</p>
                        </div>
                    ) : filteredProducts.length === 0 ? (
                        <div className="p-20 text-center space-y-4">
                            <div className="h-16 w-16 bg-zinc-100 rounded-full flex items-center justify-center mx-auto text-zinc-400">
                                <Package size={32} />
                            </div>
                            <p className="text-zinc-500">No products found.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-zinc-50 dark:bg-zinc-800/50 text-xs uppercase font-bold text-zinc-500">
                                    <tr>
                                        <th className="px-6 py-4">Product</th>
                                        <th className="px-6 py-4">Price / Pack</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                    {filteredProducts.map((p) => (
                                        <tr key={p.id} className="group hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="h-12 w-12 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden flex items-center justify-center border border-zinc-200 dark:border-zinc-700">
                                                        {p.image ? (
                                                            <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                                                        ) : (
                                                            <ImageIcon size={20} className="text-zinc-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-zinc-900 dark:text-zinc-100">{p.name}</p>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                            <Badge variant="secondary" className="px-1.5 py-0 h-4 text-[10px] rounded-sm font-medium">
                                                                {p.category}
                                                            </Badge>
                                                            <span className="text-[10px] text-zinc-400 font-mono">ID: {p.id}</span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="font-mono font-bold text-primary">
                                                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: p.currency || 'EUR' }).format(p.price)}
                                                </span>
                                                <p className="text-[10px] text-zinc-400">
                                                    Pack: {new Intl.NumberFormat('de-DE', { style: 'currency', currency: p.currency || 'EUR' }).format(p.pricePerCardboard || 0)}
                                                </p>
                                            </td>
                                            <td className="px-6 py-4">
                                                <button
                                                    onClick={() => handleToggleStatus(p.id, p.active)}
                                                    className={`px-3 py-1 rounded-full text-xs font-bold transition-all shadow-sm ${p.active
                                                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                                        : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                                                        }`}
                                                >
                                                    {p.active ? 'Active' : 'Hidden'}
                                                </button>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full"
                                                        onClick={() => startEdit(p)}
                                                    >
                                                        <Save size={14} className="text-zinc-400" />
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-full text-red-500 hover:bg-red-50 hover:text-red-600 border-red-100"
                                                        onClick={() => handleDeleteProduct(p.id, p.name)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
