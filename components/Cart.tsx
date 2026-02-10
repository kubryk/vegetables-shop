'use client';

import { useState, useEffect } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Order } from '@/types/order';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { Minus, Plus, Trash2, ShoppingCart, CheckCircle2, AlertCircle } from 'lucide-react';

const Cart = () => {
  const {
    items,
    removeFromCart,
    updateQuantity,
    clearCart,
    getTotalPrice,
    getCurrency,
    isOpen,
    closeCart,
  } = useCart();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [lastOrder, setLastOrder] = useState<{
    id: string;
    customerName: string;
    customerEmail: string;
    items: typeof items;
    totalPrice: number;
    currency: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    customerName: '',
    customerEmail: '',
  });



  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleQuantityChange = (productId: string, newQuantity: number) => {
    updateQuantity(productId, newQuantity);
  };

  const handleClose = () => {
    closeCart();
    // Reset success state after closing animation
    setTimeout(() => {
      setSubmitSuccess(false);
      setLastOrder(null);
      setFormData({ customerName: '', customerEmail: '' });
    }, 300);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (items.length === 0) {
      setSubmitError('Warenkorb ist leer');
      return;
    }

    if (!formData.customerName.trim() || !formData.customerEmail.trim()) {
      setSubmitError('Bitte füllen Sie alle Pflichtfelder aus');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const currency = getCurrency();
      const currentItems = [...items];
      const currentTotal = getTotalPrice();

      const order: Order = {
        customerName: formData.customerName.trim(),
        customerPhone: '',
        customerEmail: formData.customerEmail.trim(),
        customerAddress: undefined,
        items: currentItems.map(item => ({
          ...item,
          totalPrice: item.price * item.quantity
        })),
        totalPrice: currentTotal,
        currency,
        orderDate: new Date().toISOString(),
        notes: undefined,
      };

      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(order),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Bestellung konnte nicht erstellt werden');
      }

      const data = await response.json();

      // Trigger Confetti
      const confetti = (await import('canvas-confetti')).default;
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#22c55e', '#16a34a', '#ffffff'] // Green theme
      });

      setLastOrder({
        id: data.id,
        customerName: formData.customerName,
        customerEmail: formData.customerEmail,
        items: currentItems,
        totalPrice: currentTotal,
        currency: currency
      });
      setSubmitSuccess(true);
      clearCart();

    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Fehler beim Erstellen der Bestellung');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={handleClose}>
      <SheetContent className="flex h-full w-full flex-col border-l-2 border-primary/20 bg-white p-0 sm:max-w-2xl dark:border-zinc-800 dark:bg-zinc-900">
        <SheetHeader className="flex-none border-b border-green-100 bg-gradient-green-light px-6 py-4 dark:border-zinc-800">
          <SheetTitle className="flex items-center gap-3 text-2xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-white shadow-md">
              <ShoppingCart className="h-5 w-5" />
            </div>
            <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              {submitSuccess ? 'Bestellung aufgegeben!' : 'Warenkorb'}
            </span>
          </SheetTitle>
        </SheetHeader>

        {submitSuccess && lastOrder ? (
          <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto px-6 py-8 text-center animate-in fade-in zoom-in duration-300">
            <div className="mb-6 rounded-full bg-green-100 p-6 dark:bg-green-900/30">
              <CheckCircle2 className="h-16 w-16 text-green-600 dark:text-green-400" />
            </div>

            <h3 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">
              Vielen Dank für Ihre Bestellung, {lastOrder.customerName}!
            </h3>
            {/* <p className="mb-8 text-gray-500 dark:text-gray-400">
              Ми надіслали деталі на {lastOrder.customerEmail}
            </p> */}

            <Card className="w-full mb-8 border-dashed border-2 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/10">
              <CardContent className="p-6 text-left space-y-4">
                <div className="flex justify-between items-center pb-2 border-b border-green-200 dark:border-green-900">
                  <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Bestellnummer:</span>
                  <span className="font-mono font-bold text-primary">{lastOrder.id}</span>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">Produkte:</p>
                  <ul className="text-sm space-y-2">
                    {lastOrder.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span className="text-gray-900 dark:text-gray-200 truncate pr-2 flex-1">
                          {item.name} <span className="text-gray-400 whitespace-nowrap">× {item.quantity} {item.netWeight > 0 ? `(${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(item.netWeight * item.quantity)} ${item.unit})` : item.unit === 'pcs' && item.unitPerCardboard > 0 ? `(${item.unitPerCardboard * item.quantity} шт)` : ''}</span>
                        </span>
                        <span className="font-semibold whitespace-nowrap">{new Intl.NumberFormat('de-DE', { style: 'currency', currency: lastOrder.currency }).format(item.price * item.quantity)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-green-200 dark:border-green-900">
                  <span className="font-bold text-gray-900 dark:text-white">Gesamt:</span>
                  <span className="text-xl font-extrabold text-primary">
                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: lastOrder.currency }).format(lastOrder.totalPrice)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleClose}
              size="lg"
              className="w-full bg-primary font-bold text-white shadow-green hover:bg-primary/90"
            >
              Weiter einkaufen
            </Button>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center p-8 text-center bg-gradient-green-light/30 dark:bg-zinc-900/50">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-sm dark:bg-zinc-800">
              <ShoppingCart className="h-10 w-10 text-[hsl(142_76%_36%)]/40 dark:text-[hsl(142_70%_50%)]/40" />
            </div>
            <p className="text-lg font-bold text-gray-900 dark:text-zinc-100">
              Warenkorb ist leer
            </p>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-400">
              Fügen Sie Produkte aus dem Katalog hinzu
            </p>
            <Button
              variant="outline"
              onClick={handleClose}
              className="mt-6 rounded-full border-primary/20 hover:bg-primary/5 hover:text-primary dark:border-zinc-700"
            >
              Zurück zum Shop
            </Button>
          </div>
        ) : (
          <>
            {/* Main Scrollable Area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6 scrollbar-hide">
              <div className="space-y-3">
                {items.map((item) => {
                  const itemTotal = item.price * item.quantity;
                  const formattedPrice = new Intl.NumberFormat('de-DE', {
                    style: 'currency',
                    currency: item.currency || getCurrency() || 'UAH',
                    currencyDisplay: 'narrowSymbol',
                    maximumFractionDigits: 2,
                  });

                  return (
                    <Card
                      key={item.productId}
                      className="group border-green-100 bg-white shadow-sm transition-all hover:border-[hsl(142_76%_36%)]/40 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
                    >
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex gap-4">
                          {/* Image */}
                          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-green-100 bg-white dark:border-zinc-800 dark:bg-zinc-900 sm:h-24 sm:w-24">
                            {item.image && item.image.trim() ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-green-light dark:bg-zinc-900">
                                <ShoppingCart className="h-8 w-8 text-[hsl(142_76%_36%)]/40 dark:text-[hsl(142_70%_50%)]/40" />
                              </div>
                            )}
                          </div>

                          {/* Details */}
                          <div className="flex flex-1 flex-col justify-between min-w-0">
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <h3 className="text-base font-bold leading-tight text-gray-900 line-clamp-2 dark:text-zinc-100">
                                  {item.name}
                                </h3>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="-mr-2 -mt-2 h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                                  onClick={() => removeFromCart(item.productId)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                              <div className="mt-1 flex flex-col gap-0.5">
                                {item.netWeight > 0 ? (
                                  <>
                                    <p className="text-sm font-bold text-[hsl(142_76%_36%)] dark:text-green-400">
                                      {new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(item.netWeight * item.quantity)} {item.unit}
                                    </p>
                                    <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                                      {formattedPrice.format(item.price)} / {new Intl.NumberFormat('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(item.netWeight)} {item.unit}
                                    </p>
                                  </>
                                ) : item.unit === 'pcs' && item.unitPerCardboard > 0 ? (
                                  <>
                                    <p className="text-sm font-bold text-[hsl(142_76%_36%)] dark:text-green-400">
                                      {item.unitPerCardboard * item.quantity} шт
                                    </p>
                                    <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                                      {formattedPrice.format(item.price)} / {item.unitPerCardboard} шт
                                    </p>
                                  </>
                                ) : (
                                  <p className="text-xs font-medium text-gray-500 dark:text-zinc-400">
                                    {formattedPrice.format(item.price)} / Packung
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-end justify-between gap-2 mt-2">
                              {/* Quantity Controls */}
                              <div className="flex items-center gap-1 rounded-lg border border-green-100 bg-gradient-green-light p-1 dark:border-zinc-700 dark:bg-zinc-900">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-md bg-white shadow-sm hover:bg-[hsl(142_76%_36%)] hover:text-white disabled:opacity-50 dark:bg-zinc-800 dark:hover:bg-[hsl(142_76%_36%)]"
                                  onClick={() => handleQuantityChange(item.productId, item.quantity - 1)}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <span className="w-8 text-center text-sm font-bold text-gray-900 dark:text-zinc-100">
                                  {item.quantity}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-md bg-white shadow-sm hover:bg-[hsl(142_76%_36%)] hover:text-white disabled:opacity-50 dark:bg-zinc-800 dark:hover:bg-[hsl(142_76%_36%)]"
                                  onClick={() => handleQuantityChange(item.productId, item.quantity + 1)}
                                  disabled={item.quantity >= 99}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>

                              <span className="text-lg font-bold text-[hsl(142_76%_36%)] dark:text-[hsl(142_70%_50%)]">
                                {formattedPrice.format(itemTotal)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

            </div>

            {/* Sticky Footer */}
            <div className="flex-none border-t border-gray-100 bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:bg-zinc-950 dark:border-zinc-800 pb-safe z-20">
              <form id="checkout-form" onSubmit={handleSubmit} className="mb-4 space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Input
                      id="customerName"
                      name="customerName"
                      value={formData.customerName}
                      onChange={handleInputChange}
                      required
                      placeholder="Name des Geschäfts"
                      className="h-10 bg-gray-50 border-0 ring-1 ring-gray-200 focus-visible:ring-primary focus-visible:bg-white transition-all dark:bg-zinc-900 dark:ring-zinc-800"
                    />
                  </div>
                  <div className="space-y-1">
                    <Input
                      type="email"
                      id="customerEmail"
                      name="customerEmail"
                      value={formData.customerEmail}
                      onChange={handleInputChange}
                      required
                      placeholder="Email"
                      className="h-10 bg-gray-50 border-0 ring-1 ring-gray-200 focus-visible:ring-primary focus-visible:bg-white transition-all dark:bg-zinc-900 dark:ring-zinc-800"
                    />
                  </div>
                </div>
              </form>

              {submitError && (
                <div className="mb-3 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-500 dark:text-zinc-400">
                    Gesamtsumme ({items.reduce((total, item) => total + item.quantity, 0)} Stk.)
                  </span>
                  <span className="text-2xl font-extrabold text-[hsl(142_76%_36%)] dark:text-[hsl(142_70%_50%)]">
                    {new Intl.NumberFormat('de-DE', { style: 'currency', currency: getCurrency(), currencyDisplay: 'narrowSymbol', maximumFractionDigits: 2 }).format(getTotalPrice())}
                  </span>
                </div>

                <Button
                  type="submit"
                  form="checkout-form"
                  disabled={isSubmitting}
                  className="w-full h-12 bg-primary font-bold text-white shadow-green text-lg transition-all hover:bg-primary/90 hover:shadow-green-lg disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
                      Verarbeitung...
                    </span>
                  ) : 'Bestellung aufgeben'}
                </Button>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet >
  );
};

export default Cart;
