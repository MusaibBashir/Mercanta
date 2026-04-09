import { describe, it, expect, vi, beforeEach } from 'vitest';
import { printBarcode } from '../utils/printBarcode';
import type { InventoryItem } from '../context/InventoryContext';

// ─── Fixture ─────────────────────────────────────────────────────────────────

function makeItem(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    id: 'inv-1',
    sku: 'SKU-001',
    itemName: 'Test Widget',
    category: 'Electronics',
    price: 100,
    quantity: 10,
    ...overrides,
  } as InventoryItem;
}

function makePrintWindow() {
  return {
    document: {
      write: vi.fn(),
      close: vi.fn(),
    },
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── printBarcode ─────────────────────────────────────────────────────────────

describe('printBarcode', () => {
  it('opens a new window and writes HTML', () => {
    const win = makePrintWindow();
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);

    printBarcode(makeItem());

    expect(window.open).toHaveBeenCalledWith('', '_blank');
    expect(win.document.write).toHaveBeenCalledOnce();
    expect(win.document.close).toHaveBeenCalledOnce();
  });

  it('embeds item name in the HTML', () => {
    const win = makePrintWindow();
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);

    printBarcode(makeItem({ itemName: 'Fancy Widget' }));

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(html).toContain('Fancy Widget');
  });

  it('uses barcode field over SKU when barcode is present', () => {
    const win = makePrintWindow();
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);

    printBarcode(makeItem({ sku: 'SKU-001', barcode: 'BC-999' }));

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // The barcode value 'BC-999' must appear in the rendered script (JsBarcode call)
    expect(html).toContain('"BC-999"');
  });

  it('falls back to SKU when barcode is absent', () => {
    const win = makePrintWindow();
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);

    printBarcode(makeItem({ sku: 'SKU-007', barcode: undefined }));

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(html).toContain('SKU-007');
  });

  it('generates one barcode container per requested quantity', () => {
    const win = makePrintWindow();
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);

    printBarcode(makeItem(), 3);

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    // 3 distinct svg class selectors: .barcode-0, .barcode-1, .barcode-2
    expect(html).toContain('barcode-0');
    expect(html).toContain('barcode-1');
    expect(html).toContain('barcode-2');
    expect(html).not.toContain('barcode-3');
  });

  it('defaults quantity to 1', () => {
    const win = makePrintWindow();
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);

    printBarcode(makeItem());

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(html).toContain('barcode-0');
    expect(html).not.toContain('barcode-1');
  });

  it('does nothing when window.open returns null', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(() => printBarcode(makeItem())).not.toThrow();
  });
});
