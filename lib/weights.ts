import type { Product } from '@/types/product';
import type { CartItem } from '@/types/order';
import type { WeightMode, WeightSource } from '@/types/weight';

type WeightCarrier = Partial<
  Pick<
    Product,
    | 'unit'
    | 'weightMode'
    | 'weightPerUnitKg'
    | 'weightPerPackageKg'
    | 'unitsPerPackage'
    | 'netWeight'
    | 'unitPerCardboard'
  >
> &
  Partial<
    Pick<
      CartItem,
      | 'quantity'
      | 'packageCount'
      | 'additionalInfo'
      | 'baseAdditionalInfo'
      | 'manualWeightKg'
      | 'calculatedWeightKg'
      | 'weightSource'
    >
  >;

export function isWeightUnit(unit?: string | null) {
  const normalized = String(unit || '').trim().toLowerCase();
  return ['kg', 'кг', 'g', 'г'].includes(normalized);
}

export function toKg(value: number, unit?: string | null) {
  const normalized = String(unit || '').trim().toLowerCase();
  if (['g', 'г'].includes(normalized)) {
    return value / 1000;
  }
  return value;
}

export function getUnitsPerPackage(source?: WeightCarrier | null) {
  return Number(source?.unitsPerPackage ?? source?.unitPerCardboard ?? 0) || 0;
}

export function getWeightPerPackageKg(source?: WeightCarrier | null) {
  return Number(source?.weightPerPackageKg ?? source?.netWeight ?? 0) || 0;
}

export function getWeightMode(source?: WeightCarrier | null): WeightMode {
  const explicit = source?.weightMode;
  if (explicit) {
    return explicit;
  }

  if (isWeightUnit(source?.unit)) {
    return 'by_invoice_quantity';
  }

  if (Number(source?.weightPerUnitKg || 0) > 0) {
    return 'per_unit_exact';
  }

  if (getWeightPerPackageKg(source) > 0) {
    return 'per_package_exact';
  }

  return 'unknown';
}

export function parsePackageCountFromInfo(additionalInfo?: string) {
  if (!additionalInfo) return 0;
  const parsed = parseFloat(additionalInfo);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export function getPackageWeightBasisCount(item?: WeightCarrier | null, product?: WeightCarrier | null) {
  const itemBase = parsePackageCountFromInfo(item?.baseAdditionalInfo);
  if (itemBase > 0) {
    return itemBase;
  }

  const productBase = parsePackageCountFromInfo(product?.additionalInfo);
  if (productBase > 0) {
    return productBase;
  }

  const itemCurrent = parsePackageCountFromInfo(item?.additionalInfo);
  if (itemCurrent > 0) {
    return itemCurrent;
  }

  return 1;
}

export function getPackageCount(item?: WeightCarrier | null, product?: WeightCarrier | null) {
  const explicit = Number(item?.packageCount);
  if (Number.isFinite(explicit) && explicit > 0) {
    return explicit;
  }

  const parsed = parsePackageCountFromInfo(item?.additionalInfo);
  if (parsed > 0) {
    return parsed;
  }

  const qty = Number(item?.quantity || 0);
  const unitsPerPackage = getUnitsPerPackage(item) || getUnitsPerPackage(product);
  if (qty > 0 && unitsPerPackage > 0) {
    return qty / unitsPerPackage;
  }

  return 0;
}

export function calculateItemWeight(
  item?: WeightCarrier | null,
  product?: WeightCarrier | null,
  options?: { preferCurrentProduct?: boolean }
): { calculatedWeightKg?: number; weightSource: WeightSource; weightMode: WeightMode } {
  const itemMode = getWeightMode(item);
  const productMode = getWeightMode(product);
  const preferCurrentProduct = options?.preferCurrentProduct === true;
  const mode = preferCurrentProduct && productMode !== 'unknown'
    ? productMode
    : (itemMode !== 'unknown' ? itemMode : productMode);

  const stored = Number(item?.calculatedWeightKg);
  const hasStoredWeight = item?.calculatedWeightKg !== undefined
    && item?.calculatedWeightKg !== null
    && Number.isFinite(stored);
  const manualWeightKg = Number(item?.manualWeightKg || 0);
  const hasManualWeight = manualWeightKg > 0;

  if (hasManualWeight && (item?.weightSource === 'manual' || itemMode === 'manual_per_order' || mode === 'manual_per_order')) {
    return {
      calculatedWeightKg: manualWeightKg,
      weightSource: 'manual',
      weightMode: 'manual_per_order',
    };
  }

  if (hasStoredWeight && (!preferCurrentProduct || productMode === 'unknown')) {
    return {
      calculatedWeightKg: stored,
      weightSource: item.weightSource || 'unknown',
      weightMode: mode,
    };
  }

  const qty = Number(item?.quantity || 0);

  if (mode === 'by_invoice_quantity' && qty > 0) {
    return {
      calculatedWeightKg: toKg(qty, item?.unit || product?.unit),
      weightSource: 'exact',
      weightMode: mode,
    };
  }

  if (mode === 'per_unit_exact') {
    const weightPerUnitKg = preferCurrentProduct && Number(product?.weightPerUnitKg ?? 0) > 0
      ? Number(product?.weightPerUnitKg ?? 0)
      : Number(item?.weightPerUnitKg ?? product?.weightPerUnitKg ?? 0);
    if (qty > 0 && weightPerUnitKg > 0) {
      return {
        calculatedWeightKg: qty * weightPerUnitKg,
        weightSource: 'exact',
        weightMode: mode,
      };
    }
  }

  if (mode === 'per_package_exact') {
    const packageCount = getPackageCount(item, product);
    const packageWeightBasisCount = getPackageWeightBasisCount(item, product);
    const weightPerPackageKg = preferCurrentProduct && getWeightPerPackageKg(product) > 0
      ? getWeightPerPackageKg(product)
      : (getWeightPerPackageKg(item) || getWeightPerPackageKg(product));
    if (packageCount > 0 && weightPerPackageKg > 0 && packageWeightBasisCount > 0) {
      return {
        calculatedWeightKg: (packageCount / packageWeightBasisCount) * weightPerPackageKg,
        weightSource: 'exact',
        weightMode: mode,
      };
    }
  }

  if (mode === 'manual_per_order') {
    if (manualWeightKg > 0) {
      return {
        calculatedWeightKg: manualWeightKg,
        weightSource: 'manual',
        weightMode: mode,
      };
    }
  }

  if (hasStoredWeight) {
    return {
      calculatedWeightKg: stored,
      weightSource: item?.weightSource || 'unknown',
      weightMode: itemMode,
    };
  }

  return { calculatedWeightKg: undefined, weightSource: 'unknown', weightMode: mode };
}
