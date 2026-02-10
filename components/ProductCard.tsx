import { Product } from '@/types/product';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Minus, Plus, ShoppingCart, Leaf } from 'lucide-react';

type ProductCardProps = {
  product: Product;
};

const ProductCard = ({ product }: ProductCardProps) => {
  const { addToCart } = useCart();
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [isJustAdded, setIsJustAdded] = useState(false);
  const justAddedTimeoutRef = useRef<number | null>(null);

  const currency = (product.currency || 'UAH').toUpperCase();

  const formatMoney = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatKg = (value: number) => {
    return new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: value % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formattedPricePerCardboard = formatMoney(product.pricePerCardboard || 0);
  const packageWeightKg = product.netWeight || 0;
  // If we have unitPerCardboard, use it for total quantity calculation if unit is pieces, otherwise weight
  const unitsPerPackage = product.unitPerCardboard || 1;
  const packagePrice = product.pricePerCardboard || 0;

  const derivedPricePerUnit =
    packageWeightKg > 0 && packagePrice > 0 ? packagePrice / packageWeightKg : 0;
  const pricePerUnit = product.pricePerUnit > 0 ? product.pricePerUnit : derivedPricePerUnit;

  const totalPackages = selectedQuantity;
  const totalKg = packageWeightKg > 0 ? packageWeightKg * totalPackages : 0;
  // If product uses unitPerCardboard (e.g. pieces in a box), we might want to show total pieces instead of Kg?
  // Current logic focuses on Kg, let's keep it but use netWeight as per request.

  const totalMoney = packagePrice > 0 ? packagePrice * totalPackages : 0;

  const formattedPricePerUnit = formatMoney(pricePerUnit || 0);
  const formattedTotalMoney = formatMoney(totalMoney || 0);

  const hasPackage = (packageWeightKg > 0 || unitsPerPackage > 1) && packagePrice > 0;
  const hasPerUnit = pricePerUnit > 0;

  const handleAddToCart = () => {
    addToCart(product, selectedQuantity);
    setSelectedQuantity(1);

    setIsJustAdded(true);
    if (justAddedTimeoutRef.current) {
      window.clearTimeout(justAddedTimeoutRef.current);
    }
    justAddedTimeoutRef.current = window.setTimeout(() => {
      setIsJustAdded(false);
      justAddedTimeoutRef.current = null;
    }, 700);
  };

  useEffect(() => {
    return () => {
      if (justAddedTimeoutRef.current) {
        window.clearTimeout(justAddedTimeoutRef.current);
        justAddedTimeoutRef.current = null;
      }
    };
  }, []);

  const handleDecreaseQuantity = () => {
    setSelectedQuantity((prev) => Math.max(1, prev - 1));
  };

  const handleIncreaseQuantity = () => {
    setSelectedQuantity((prev) => Math.min(99, prev + 1));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleAddToCart();
    }
  };

  return (
    <Card className="group relative flex h-full flex-col overflow-hidden rounded-[2rem] border-0 bg-white shadow-xl shadow-gray-200/80 transition-all duration-500 hover:-translate-y-1 hover:shadow-2xl hover:shadow-green-500/20 dark:bg-zinc-900 dark:shadow-black/50">
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        {product.image ? (
          <Image
            src={product.image}
            alt={product.name}
            fill
            className="object-cover transition-transform duration-700 ease-out group-hover:scale-110"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-linear-to-br from-green-50 to-green-100">
            <Leaf className="h-16 w-16 text-[hsl(142_76%_36%)]/20" />
          </div>
        )}

        {/* Badges Overlay */}
        <div className="absolute inset-0 p-4 flex flex-col justify-between pointer-events-none">
          <div className="flex justify-end items-start">
            {!product.active && (
              <Badge variant="destructive" className="shadow-md">
                Nicht vorrätig
              </Badge>
            )}
          </div>
        </div>


      </div>

      <CardContent className="flex flex-1 flex-col p-6 pt-5">
        <h3 className="mb-2 line-clamp-2 text-xl font-bold leading-tight text-gray-900 dark:text-zinc-50 tracking-tight group-hover:text-green-700 transition-colors">
          {product.name}
        </h3>

        <div className="mt-auto pt-4 space-y-4">
          {/* Price section */}
          <div className="flex items-baseline gap-2 flex-wrap">
            {hasPackage && (
              <div className="flex flex-col">
                <span className="text-3xl font-extrabold text-[hsl(142_76%_36%)] dark:text-green-400 tracking-tight">
                  {formattedPricePerCardboard}
                </span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  pro {packageWeightKg > 0 ? formatKg(packageWeightKg) : (product.unitPerCardboard || 1)} {product.unit}
                </span>
              </div>
            )}
            {!hasPackage && hasPerUnit && (
              <div className="flex flex-col">
                <span className="text-3xl font-extrabold text-[hsl(142_76%_36%)] dark:text-green-400 tracking-tight">
                  {formattedPricePerUnit}
                </span>
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  pro 1 {product.unit}
                </span>
              </div>
            )}
            {hasPackage && hasPerUnit && (
              <div className="ml-auto text-right">
                <div className="text-sm font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded-lg">
                  {formattedPricePerUnit} / {product.unit}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>

      <CardFooter className="p-6 pt-0 mt-auto grid gap-4">
        {product.active ? (
          <>
            <div className="flex items-center justify-between p-1 bg-gray-100 dark:bg-zinc-800/50 rounded-2xl border border-gray-200 dark:border-zinc-700">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleDecreaseQuantity}
                disabled={selectedQuantity <= 1}
                className="h-10 w-10 rounded-xl hover:bg-white dark:hover:bg-zinc-700 hover:shadow-sm transition-all text-gray-600 dark:text-gray-200"
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="flex flex-col items-center justify-center px-4">
                <span className="font-bold text-lg leading-none font-mono text-gray-900 dark:text-gray-100">
                  {selectedQuantity}
                </span>
                {hasPackage && (
                  <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                    {packageWeightKg > 0
                      ? `${formatKg(totalKg)} ${product.unit}`
                      : `${selectedQuantity * (product.unitPerCardboard || 1)} ${product.unit}`
                    }
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleIncreaseQuantity}
                disabled={selectedQuantity >= 99}
                className="h-10 w-10 rounded-xl hover:bg-white dark:hover:bg-zinc-700 hover:shadow-sm transition-all text-green-700"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            <Button
              onClick={handleAddToCart}
              className={`w-full h-14 rounded-2xl text-lg font-bold shadow-green-lg transition-all active:scale-95 ${isJustAdded ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-[hsl(142_76%_36%)] hover:bg-[hsl(142_70%_40%)]'
                }`}
            >
              {isJustAdded ? (
                <span className="flex items-center gap-2">
                  <Check className="h-6 w-6" />
                  Im Warenkorb
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  {formattedTotalMoney}
                </span>
              )}
            </Button>
          </>
        ) : (
          <div className="w-full py-3 text-center text-sm font-medium text-gray-400 bg-gray-50 dark:bg-zinc-900 rounded-2xl border border-dashed border-gray-200">
            Produkt vorübergehend nicht verfügbar
          </div>
        )}
      </CardFooter>
    </Card>
  );
};

export default ProductCard;
