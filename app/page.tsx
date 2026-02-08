'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import Cart from '@/components/Cart';
import { Product } from '@/types/product';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ThemeToggle from '@/components/ThemeToggle';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Loader2, AlertCircle, Leaf, ListFilter, X, Search } from 'lucide-react';
import Image from 'next/image';

const Home = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('Alle');

  type SortOption =
    | 'default'
    | 'name-asc'
    | 'name-desc'
    | 'priceUnit-asc'
    | 'priceUnit-desc'
    | 'pricePack-asc'
    | 'pricePack-desc';
  const [sortOption, setSortOption] = useState<SortOption>('default');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const { openCart, getTotalItems } = useCart();
  const [searchQuery, setSearchQuery] = useState('');

  const handleCartClick = () => {
    openCart();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openCart();
    }
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/products');

        if (!response.ok) {
          throw new Error('Fehler beim Laden der Produkte');
        }

        const data = await response.json();
        setProducts(data.products || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Fehler beim Laden der Produkte');
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const categories = useMemo(() => {
    return ['Alle', ...Array.from(new Set(products.map((p) => p.category)))];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesCategory = selectedCategory === 'Alle' || p.category === selectedCategory;
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [products, selectedCategory, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, sortOption, searchQuery]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentPage]);

  const sortedProducts = useMemo(() => {
    if (filteredProducts.length <= 1) return filteredProducts;

    const withFallbackAsc = (value: number) => (Number.isFinite(value) ? value : Number.POSITIVE_INFINITY);
    const withFallbackDesc = (value: number) => (Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY);

    const list = [...filteredProducts];

    if (sortOption === 'default') return list;

    if (sortOption === 'name-asc') {
      return list.sort((a, b) => a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }));
    }

    if (sortOption === 'name-desc') {
      return list.sort((a, b) => b.name.localeCompare(a.name, 'de', { sensitivity: 'base' }));
    }

    if (sortOption === 'priceUnit-asc') {
      return list.sort((a, b) => withFallbackAsc(a.pricePerUnit) - withFallbackAsc(b.pricePerUnit));
    }

    if (sortOption === 'priceUnit-desc') {
      return list.sort((a, b) => withFallbackDesc(b.pricePerUnit) - withFallbackDesc(a.pricePerUnit));
    }

    if (sortOption === 'pricePack-asc') {
      return list.sort((a, b) => withFallbackAsc(a.pricePerCardboard) - withFallbackAsc(b.pricePerCardboard));
    }

    if (sortOption === 'pricePack-desc') {
      return list.sort((a, b) => withFallbackDesc(b.pricePerCardboard) - withFallbackDesc(a.pricePerCardboard));
    }

    return list;
  }, [filteredProducts, sortOption]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / itemsPerPage));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const startIndex = (safeCurrentPage - 1) * itemsPerPage;
    return sortedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedProducts, safeCurrentPage]);

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  };

  const handlePageSelect = (page: number) => {
    setCurrentPage(page);
  };

  const handleSelectCategory = (category: string) => {
    setSelectedCategory(category);
  };

  const handleResetFilters = () => {
    setSelectedCategory('Alle');
    setSortOption('default');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // ... if (loading) ... if (error) ...

  return (
    <div className="min-h-screen bg-linear-to-br from-green-50 via-white to-green-50/50 dark:from-zinc-950 dark:via-zinc-950 dark:to-zinc-900">
      {/* ... header ... */}
      <header className="sticky top-0 z-40 w-full border-b border-green-100 bg-white/95 backdrop-blur-md shadow-sm dark:border-zinc-800 dark:bg-zinc-950/80">
        <div className="container mx-auto px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              onClick={(e) => {
                e.preventDefault();
                handleResetFilters();
              }}
              className="flex cursor-pointer items-center gap-4 transition-opacity hover:opacity-80"
              aria-label="Zurück zur Startseite, Filter zurücksetzen"
            >
              <div className="gradient-green flex  items-center justify-center rounded-xl text-white ">
                {/* <Leaf className="h-7 w-7" /> */}
                <Image src="/logo.jpeg" alt="Logo" width={64} height={64} />
              </div>
              <div>
                <h1 className="bg-linear-to-r from-[hsl(142_76%_36%)] to-[hsl(142_70%_45%)] bg-clip-text text-xl font-bold tracking-tight text-transparent sm:text-2xl">
                  MATSKOV ENTERPRISES
                </h1>
              </div>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />

              <Button
                variant="outline"
                size="icon"
                className="relative h-11 w-11 border-2 border-[hsl(142_76%_36%)]/20 bg-white hover:border-[hsl(142_76%_36%)] hover:bg-[hsl(142_76%_36%)]/5 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                onClick={handleCartClick}
                onKeyDown={handleKeyDown}
                aria-label="Warenkorb öffnen"
                tabIndex={0}
              >
                <ShoppingCart className="h-5 w-5 text-[hsl(142_76%_36%)]" />
                {getTotalItems() > 0 && (
                  <Badge
                    className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 p-0 text-xs font-bold text-white shadow-md dark:bg-red-500"
                  >
                    {getTotalItems()}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 sm:px-6 lg:px-8">
        {/* Mobile Categories: Horizontal Scroll - COMMENTED OUT
        <div className="lg:hidden sticky top-[89px] z-30 -mx-4 mb-6 bg-white/95 backdrop-blur-md px-4 py-4 border-b border-gray-100 dark:bg-zinc-950/90 dark:border-zinc-800">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => handleSelectCategory(category)}
                className={`flex-none rounded-full px-4 py-1.5 text-sm font-bold transition-all ${selectedCategory === category
                  ? 'bg-[hsl(142_76%_36%)] text-white shadow-green-md'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700'
                  }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
        */}

        <div className="w-full">
          {/* Sidebar: Desktop Categories - COMMENTED OUT
          <aside className="hidden lg:block lg:sticky lg:top-28 self-start">
             ...
          </aside>
          */}

          {/* Main: Products */}
          <section>

            {/* Controls Header: Search & Sort */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              {/* Search Input */}
              <div className="relative w-full sm:max-w-md">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  type="search"
                  placeholder="Produktsuche..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-xl border-0 bg-white pl-10 ring-1 ring-gray-200 focus-visible:ring-2 focus-visible:ring-[hsl(142_76%_36%)] dark:bg-zinc-900 dark:ring-zinc-800"
                />
              </div>

              {/* Sort Dropdown */}
              <div className="relative w-full sm:w-auto">
                <select
                  id="sortSelect"
                  value={sortOption}
                  onChange={(e) => setSortOption(e.target.value as SortOption)}
                  className="h-11 w-full min-w-[200px] appearance-none rounded-xl border-0 bg-white px-4 pr-8 text-sm font-bold text-gray-700 shadow-sm ring-1 ring-gray-200 outline-none transition-all hover:bg-gray-50 focus:ring-2 focus:ring-[hsl(142_76%_36%)] dark:bg-zinc-900 dark:text-zinc-200 dark:ring-zinc-800 dark:hover:bg-zinc-800"
                  aria-label="Produktsortierung"
                >
                  <option value="default">Sortierung: Standard</option>
                  <option value="name-asc">Name: A → Z</option>
                  <option value="name-desc">Name: Z → A</option>
                  <option value="priceUnit-asc">Preis pro Einheit: ↑</option>
                  <option value="priceUnit-desc">Preis pro Einheit: ↓</option>
                  <option value="pricePack-asc">Preis pro Packung: ↑</option>
                  <option value="pricePack-desc">Preis pro Packung: ↓</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-500">
                  <ListFilter className="h-4 w-4" />
                </div>
              </div>
            </div>

            {/* Catalog */}
            {loading ? (
              <div className="flex flex-col items-center justify-center rounded-3xl bg-white/50 py-24 text-center backdrop-blur-sm dark:bg-zinc-900/50">
                <Loader2 className="h-12 w-12 animate-spin text-[hsl(142_76%_36%)]" />
                <p className="mt-4 text-sm font-medium text-gray-500 dark:text-zinc-400">
                  Produkte werden geladen...
                </p>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center rounded-3xl bg-red-50/50 py-20 text-center dark:bg-red-950/10">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm dark:bg-zinc-800">
                  <AlertCircle className="h-10 w-10 text-red-500" />
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-zinc-200">
                  Ein Fehler ist aufgetreten
                </p>
                <p className="mt-2 text-sm text-gray-500 dark:text-zinc-400">
                  {error}
                </p>
                <Button
                  variant="outline"
                  onClick={() => window.location.reload()}
                  className="mt-6 border-red-200 hover:bg-red-50 dark:border-red-900/50 dark:hover:bg-red-900/20"
                >
                  Erneut versuchen
                </Button>
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-3xl bg-gray-50/50 py-20 text-center dark:bg-zinc-900/50">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm dark:bg-zinc-800">
                  <Leaf className="h-10 w-10 text-gray-300 dark:text-zinc-600" />
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-zinc-200">
                  {searchQuery ? 'Keine Produkte für Ihre Suchanfrage gefunden' : 'Keine Produkte gefunden'}
                </p>
                <p className="mt-2 text-sm text-gray-500">
                  {searchQuery ? 'Versuchen Sie, Ihre Suchanfrage zu ändern' : 'Versuchen Sie, die Seite zu aktualisieren'}
                </p>
                {searchQuery && (
                  <Button
                    variant="outline"
                    onClick={() => setSearchQuery('')}
                    className="mt-6 border-dashed"
                  >
                    Suche löschen
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {paginatedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex flex-col items-center justify-center gap-6 pt-8">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={handlePrevPage}
                        disabled={safeCurrentPage === 1}
                        aria-label="Vorherige Seite"
                        className="h-10 w-10 rounded-xl border-0 bg-white p-0 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      >
                        ←
                      </Button>

                      <div className="flex items-center gap-1 rounded-xl bg-gray-100 p-1 dark:bg-zinc-900">
                        {Array.from({ length: totalPages }).slice(0, 7).map((_, idx) => {
                          const page = idx + 1;
                          const isActive = page === safeCurrentPage;

                          return (
                            <button
                              key={page}
                              onClick={() => handlePageSelect(page)}
                              className={`h-8 min-w-[2rem] rounded-lg text-sm font-bold transition-all ${isActive
                                ? 'bg-white text-gray-900 shadow-sm dark:bg-zinc-800 dark:text-white'
                                : 'text-gray-500 hover:text-gray-900 dark:text-zinc-500 dark:hover:text-zinc-300'
                                }`}
                            >
                              {page}
                            </button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        onClick={handleNextPage}
                        disabled={safeCurrentPage === totalPages}
                        aria-label="Nächste Seite"
                        className="h-10 w-10 rounded-xl border-0 bg-white p-0 shadow-sm hover:bg-gray-50 disabled:opacity-50 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                      >
                        →
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </main>

      <Cart />
    </div>
  );
};

export default Home;
