'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { CartItem } from '@/types/order';
import { Product } from '@/types/product';
import { getPackageCount } from '@/lib/weights';

type CartContextType = {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number, additionalInfo?: string, baseAdditionalInfo?: string, packageCount?: number, packageType?: string) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number, additionalInfo?: string, baseAdditionalInfo?: string, packageCount?: number, packageType?: string) => void;
  clearCart: () => void;
  getTotalPrice: () => number;
  getTotalItems: () => number;
  getCurrency: () => string;
  isOpen: boolean;
  openCart: () => void;
  closeCart: () => void;
};

const CART_STORAGE_KEY = 'vegetables-shop-cart';
const DEFAULT_CURRENCY = 'UAH';

const loadCartFromStorage = (): CartItem[] => {
  if (typeof window === 'undefined') return [];

  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return [];

      // Міграція старих записів (до додавання полів currency та image)
      return parsed
        .filter((x) => x && typeof x === 'object')
        .map((x) => {
          const raw = x as Partial<CartItem>;

          return {
            productId: String(raw.productId ?? ''),
            name: String(raw.name ?? ''),
            price: Number(raw.price ?? 0),
            quantity: Number(raw.quantity ?? 1),
            currency: typeof raw.currency === 'string' && raw.currency.trim()
              ? raw.currency.trim().toUpperCase()
              : DEFAULT_CURRENCY,
            image: typeof raw.image === 'string' && raw.image.trim()
              ? raw.image.trim()
              : '',
            category: String(raw.category || 'Інше'),
            unit: String(raw.unit || 'kg'),
            unitsPerPackage: Number(raw.unitsPerPackage || raw.unitPerCardboard || 0),
            weightMode: raw.weightMode,
            weightPerUnitKg: Number(raw.weightPerUnitKg || 0) || undefined,
            weightPerPackageKg: Number(raw.weightPerPackageKg || raw.netWeight || (raw as any).cardboardWeight || 0) || undefined,
            calculatedWeightKg: Number(raw.calculatedWeightKg || 0) || undefined,
            manualWeightKg: Number(raw.manualWeightKg || 0) || undefined,
            weightSource: raw.weightSource,
            netWeight: Number(raw.netWeight || (raw as any).cardboardWeight || 0),
            unitPerCardboard: Number(raw.unitPerCardboard || 0),
            additionalInfo: typeof raw.additionalInfo === 'string' ? raw.additionalInfo : undefined,
            baseAdditionalInfo: typeof raw.baseAdditionalInfo === 'string' ? raw.baseAdditionalInfo : undefined,
            packageCount: raw.packageCount !== undefined ? Number(raw.packageCount || 0) : undefined,
            packageType: typeof raw.packageType === 'string' ? raw.packageType : undefined,
          } satisfies CartItem;
        })
        .filter((x) => x.productId && x.quantity > 0);
    }
  } catch (error) {
    console.error('Failed to load cart from localStorage:', error);
  }
  return [];
};

const saveCartToStorage = (items: CartItem[]) => {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save cart to localStorage:', error);
  }
};

const getDisplayItemCount = (item: CartItem) => {
  const packageCount = getPackageCount(item);
  if (packageCount > 0) {
    const baseInfo = item.baseAdditionalInfo || item.additionalInfo;
    const match = baseInfo?.match(/^\s*(\d+(?:\.\d+)?)\s+/);

    if (match) {
      const baseCount = parseFloat(match[1]) || 1;
      const bundleCount = packageCount / baseCount;
      if (Number.isFinite(bundleCount) && bundleCount > 0) {
        return bundleCount;
      }
    }

    return packageCount;
  }

  return item.quantity;
};

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Завантажуємо кошик з localStorage при ініціалізації
  useEffect(() => {
    const savedItems = loadCartFromStorage();
    setItems(savedItems);
    setIsInitialized(true);
  }, []);

  // Зберігаємо кошик в localStorage при кожній зміні
  useEffect(() => {
    if (isInitialized) {
      saveCartToStorage(items);
    }
  }, [items, isInitialized]);

  const addToCart = useCallback((product: Product, quantity: number = 1, additionalInfo?: string, baseAdditionalInfo?: string, packageCount?: number, packageType?: string) => {
    if (!product.active) return;
    if (quantity <= 0) return;

    setItems((prevItems) => {
      const existingItem = prevItems.find((item) => item.productId === product.id);

      if (existingItem) {
        return prevItems.map((item) =>
          item.productId === product.id
            ? {
              ...item,
              quantity: item.quantity + quantity,
              image: product.image || item.image || '',
              category: product.category || item.category || 'Інше',
              unit: product.unit || item.unit,
              unitsPerPackage: product.unitsPerPackage || product.unitPerCardboard || item.unitsPerPackage || item.unitPerCardboard,
              weightMode: product.weightMode || item.weightMode,
              weightPerUnitKg: product.weightPerUnitKg || item.weightPerUnitKg,
              weightPerPackageKg: product.weightPerPackageKg || product.netWeight || item.weightPerPackageKg,
              netWeight: product.netWeight || item.netWeight,
              unitPerCardboard: product.unitPerCardboard || item.unitPerCardboard,
              price: product.pricePerUnit || item.price,
              additionalInfo: additionalInfo || item.additionalInfo || product.additionalInfo,
              baseAdditionalInfo: baseAdditionalInfo || item.baseAdditionalInfo,
              packageCount: (packageCount || 0) + (item.packageCount || 0),
              packageType: packageType || item.packageType,
            }
            : item
        );
      }

      return [
        ...prevItems,
        {
          productId: product.id,
          name: product.name,
          category: product.category || 'Інше',
          price: product.pricePerUnit || 0,
          quantity,
          currency: (product.currency || DEFAULT_CURRENCY).toUpperCase(),
          image: product.image || '',
          unit: product.unit || 'kg',
          unitsPerPackage: product.unitsPerPackage || product.unitPerCardboard || 0,
          weightMode: product.weightMode,
          weightPerUnitKg: product.weightPerUnitKg,
          weightPerPackageKg: product.weightPerPackageKg || product.netWeight,
          netWeight: product.netWeight || 0,
          unitPerCardboard: product.unitPerCardboard || 0,
          additionalInfo: additionalInfo || product.additionalInfo,
          baseAdditionalInfo: baseAdditionalInfo,
          packageCount: packageCount,
          packageType: packageType,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, additionalInfo?: string, baseAdditionalInfo?: string, packageCount?: number, packageType?: string) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.productId === productId ? {
          ...item,
          quantity,
          unitsPerPackage: item.unitsPerPackage,
          weightMode: item.weightMode,
          weightPerUnitKg: item.weightPerUnitKg,
          weightPerPackageKg: item.weightPerPackageKg,
          manualWeightKg: item.manualWeightKg,
          additionalInfo: additionalInfo || item.additionalInfo,
          baseAdditionalInfo: baseAdditionalInfo || item.baseAdditionalInfo,
          packageCount: packageCount !== undefined ? packageCount : item.packageCount,
          packageType: packageType || item.packageType
        } : item
      )
    );
  }, [removeFromCart]);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const getTotalPrice = useCallback(() => {
    const total = items.reduce((total, item) => total + item.price * item.quantity, 0);
    // Round to 2 decimal places to prevent floating point errors (e.g. 21.939999...)
    return Math.round((total + Number.EPSILON) * 100) / 100;
  }, [items]);

  const getTotalItems = useCallback(() => {
    return items.reduce((total, item) => {
      return total + getDisplayItemCount(item);
    }, 0);
  }, [items]);

  const getCurrency = useCallback(() => {
    return items[0]?.currency || DEFAULT_CURRENCY;
  }, [items]);

  const openCart = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeCart = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getTotalPrice,
        getTotalItems,
        getCurrency,
        isOpen,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
