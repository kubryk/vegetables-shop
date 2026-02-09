export type Product = {
  id: string;
  name: string;
  category: string;
  cardboardWeight: number; // вага картонки/упаковки
  pricePerUnit: number; // ціна за одиницю (кг, шт, пучок)
  unit: string; // одиниця виміру (кг, шт, пучок)
  pricePerCardboard: number; // ціна за картонку
  active: boolean; // чи активний товар
  currency: string; // напр. EUR, UAH
  image: string;
  agregationResult?: string;
};
