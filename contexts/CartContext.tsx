'use client';

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { CartItem } from '@/types/order';
import { Product } from '@/types/product';

type CartContextType = {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
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
            unit: String(raw.unit || 'кг'),
            cardboardWeight: Number(raw.cardboardWeight || 0),
            agregationResult: raw.agregationResult,
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

  const addToCart = useCallback((product: Product, quantity: number = 1) => {
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
              unit: product.unit || item.unit,
              cardboardWeight: product.cardboardWeight || item.cardboardWeight,
              agregationResult: product.agregationResult || item.agregationResult
            }
            : item
        );
      }

      return [
        ...prevItems,
        {
          productId: product.id,
          name: product.name,
          price: product.pricePerCardboard,
          quantity,
          currency: (product.currency || DEFAULT_CURRENCY).toUpperCase(),
          image: product.image || '',
          unit: product.unit || 'кг',
          cardboardWeight: product.cardboardWeight || 0,
          agregationResult: product.agregationResult,
        },
      ];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prevItems) => prevItems.filter((item) => item.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setItems((prevItems) =>
      prevItems.map((item) =>
        item.productId === productId ? { ...item, quantity } : item
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
    return items.reduce((total, item) => total + item.quantity, 0);
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
