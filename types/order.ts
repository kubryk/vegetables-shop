export type CartItem = {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  currency: string;
  image: string;
  unit: string;
  cardboardWeight: number;
  agregationResult?: string;
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
