export type CartItem = {
  productId: string;
  name: string;
  category: string;
  price: number; // Price per unit (kg or pcs)
  quantity: number;
  currency: string;
  image: string;
  unit: string;
  netWeight: number;
  unitPerCardboard: number;
  additionalInfo?: string;
  baseAdditionalInfo?: string;
  packageCount?: number;
  packageType?: string;
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
