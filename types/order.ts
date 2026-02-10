export type CartItem = {
  productId: string;
  name: string;
  category: string;
  price: number; // This is price per package
  pricePerUnit: number;
  quantity: number;
  currency: string;
  image: string;
  unit: string;
  netWeight: number;
  unitPerCardboard: number;
};

export type Order = {
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  customerAddress?: string;
  items: CartItem[];
  totalPrice: number;
  currency: string;
  orderDate: string;
  notes?: string;
};
