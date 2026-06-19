// Product Type → Insert Key mapping (St Frank rules — extensible to other customers).
// Used by the master SKU import (to denormalize insert_key onto master_skus) AND by the
// CUT label display (to render the Insert Requirement or NO INSERT explicit string).
//
// Non-pillow product types have NO entry here. Code should treat absence as "no insert" and
// the UI MUST display the explicit string 'NO INSERT' rather than leaving the field blank.

export const PRODUCT_TYPE_TO_INSERT: Record<string, string> = {
  PIL_12x16_OUT: '12x18-NW',
  PIL_12x16_IN:  '12x18-9010',
  PIL_12x48_IN:  '14x50-9010',
  PIL_15x40_OUT: '17x42-NW',
  PIL_15x40_IN:  '17x42-9010',
  PIL_16x26_IN:  '18x28-9010',
  PIL_18x18_OUT: '18x28-NW',
  PIL_18x18_IN:  '20x20-9010',
  PIL_20x20_IN:  '22x22-9010',
  PIL_22x22_OUT: '26x26-NW',
  PIL_22x22_IN:  '26x26-9010',
  PIL_26x26_OUT: '30x30-NW',
  PIL_26x26_IN:  '30x30-9010',
};

/** Resolve insert key from a product type. Returns null for non-pillow types. */
export function insertKeyFor(productType: string | null | undefined): string | null {
  if (!productType) return null;
  return PRODUCT_TYPE_TO_INSERT[productType] ?? null;
}

/** Display string for the Insert Requirement column / CUT label. Returns 'NO INSERT' explicitly. */
export function insertDisplay(productType: string | null | undefined, insertRequired: string | null | undefined): string {
  // Prefer the stored insert_required value (which was derived at ingest time); fall back
  // to recomputing from product type. Both paths must produce 'NO INSERT' for non-pillows.
  const v = insertRequired ?? insertKeyFor(productType);
  if (v) return v;
  return 'NO INSERT';
}

/** Whether the product type is a pillow (and therefore *might* have an insert). */
export function isPillowProduct(productType: string | null | undefined): boolean {
  if (!productType) return false;
  return productType.startsWith('PIL_');
}
