import type { WeightMode } from '@/types/weight';

export type Product = {
  id: string;
  name: string;
  category: string;
  unit: string; // одиниця з Fakturownia для фактури
  unitsPerPackage?: number; // скільки invoice units в одному пакуванні
  weightMode?: WeightMode; // як визначається вага рядка
  weightPerUnitKg?: number; // точна вага однієї invoice unit
  weightPerPackageKg?: number; // точна вага одного пакування
  netWeight?: number; // вага нетто (колишній cardboardWeight)
  unitPerCardboard?: number; // одиниць в упаковці
  pricePerUnit: number; // ціна за одиницю (кг, шт, пучок)
  pricePerCardboard?: number; // ціна за картонку
  active: boolean; // чи активний товар
  currency: string; // напр. EUR, UAH
  image?: string;
  agregationResult?: string;
  position?: number;
  externalUrl?: string;
  additionalInfo?: string; // додаткова інформація (пакування)
  weightManagedByFakturownia?: boolean;
};
