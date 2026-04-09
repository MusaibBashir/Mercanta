import { describe, it, expect, vi, beforeEach } from 'vitest';
import { printReceipt } from '../utils/printReceipt';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeWindow() {
  return {
    document: {
      open: vi.fn(),
      write: vi.fn(),
      close: vi.fn(),
    },
  };
}

const shopDetails = { name: 'Test Shop', address: '123 Main St', phone: '9999999999' };

beforeEach(() => {
  vi.restoreAllMocks();
});

// ─── printReceipt ────────────────────────────────────────────────────────────

describe('printReceipt', () => {
  it('writes HTML to the provided window', () => {
    const win = makeWindow() as unknown as Window;

    printReceipt(
      {
        items: [{ itemName: 'Chai', quantity: 2, price: 20 }],
        total: 40,
      },
      shopDetails,
      win
    );

    expect(win.document.open).toHaveBeenCalledOnce();
    expect(win.document.write).toHaveBeenCalledOnce();
    expect(win.document.close).toHaveBeenCalledOnce();
    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(html).toContain('Test Shop');
    expect(html).toContain('Chai');
    expect(html).toContain('40.00');
  });

  it('opens a new window when printWindow is not provided', () => {
    const win = makeWindow();
    vi.spyOn(window, 'open').mockReturnValue(win as unknown as Window);

    printReceipt(
      { items: [{ itemName: 'Coffee', quantity: 1, price: 50 }], total: 50 },
      shopDetails
    );

    expect(window.open).toHaveBeenCalledWith('', '_blank');
  });

  it('includes item discount info when discount is set (percent)', () => {
    const win = makeWindow() as unknown as Window;

    printReceipt(
      {
        items: [
          {
            itemName: 'Burger',
            quantity: 1,
            price: 200,
            discount: 20,
            discountType: 'percent',
            discountValue: 10,
          },
        ],
        total: 180,
      },
      shopDetails,
      win
    );

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(html).toContain('10% off');
    expect(html).toContain('20.00');
  });

  it('includes item discount info when discount is flat', () => {
    const win = makeWindow() as unknown as Window;

    printReceipt(
      {
        items: [{ itemName: 'Dosa', quantity: 1, price: 100, discount: 15, discountType: 'flat' }],
        total: 85,
      },
      shopDetails,
      win
    );

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(html).toContain('-₹15.00');
  });

  it('includes tax information when taxAmount is provided', () => {
    const win = makeWindow() as unknown as Window;

    printReceipt(
      {
        items: [{ itemName: 'Pizza', quantity: 1, price: 500 }],
        subtotal: 500,
        taxRate: 5,
        taxAmount: 25,
        total: 525,
      },
      shopDetails,
      win
    );

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(html).toContain('Tax (5%)');
    expect(html).toContain('25.00');
  });

  it('includes split payment details when paymentMethod is split', () => {
    const win = makeWindow() as unknown as Window;

    printReceipt(
      {
        items: [{ itemName: 'Thali', quantity: 1, price: 300 }],
        total: 300,
        paymentMethod: 'split',
        paymentDetails: { cash: 100, upi: 150, card: 50 },
      },
      shopDetails,
      win
    );

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(html).toContain('Cash: ₹100.00');
    expect(html).toContain('UPI: ₹150.00');
    expect(html).toContain('Card: ₹50.00');
  });

  it('includes transaction ID when provided', () => {
    const win = makeWindow() as unknown as Window;

    printReceipt(
      {
        items: [{ itemName: 'Item', quantity: 1, price: 100 }],
        total: 100,
        paymentMethod: 'upi',
        transactionId: 'TXN123456',
      },
      shopDetails,
      win
    );

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(html).toContain('TXN123456');
  });

  it('handles missing optional fields gracefully', () => {
    const win = makeWindow() as unknown as Window;

    // No customerName, no phone, no tax, no discount
    expect(() =>
      printReceipt({ items: [], total: 0 }, { name: 'Shop' }, win)
    ).not.toThrow();

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(html).toContain('Shop');
  });

  it('formats NaN amounts as 0.00', () => {
    const win = makeWindow() as unknown as Window;

    printReceipt(
      {
        items: [{ itemName: 'Item', quantity: 1, price: NaN }],
        total: NaN,
      },
      shopDetails,
      win
    );

    const html = (win.document.write as ReturnType<typeof vi.fn>).mock.calls[0][0] as string;
    expect(html).toContain('0.00');
  });

  it('does nothing when window.open returns null', () => {
    vi.spyOn(window, 'open').mockReturnValue(null);

    expect(() =>
      printReceipt({ items: [], total: 0 }, shopDetails)
    ).not.toThrow();
  });
});
