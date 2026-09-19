import { create } from 'zustand';
import { format } from 'date-fns';

// Local calendar date (not UTC) so the default matches the operator's "today".
const todayISO = () => format(new Date(), 'yyyy-MM-dd');

const getInitialState = () => ({
  receipt_id: null,
  vendor_id: null,
  po_number: '',
  receipt_date: todayISO(),
  bill_image_url: '',
  line_items: [],
});

export const useIntakeStore = create((set) => ({
  ...getInitialState(),
  setReceiptId: (id) => set({ receipt_id: id }),
  setVendorId: (id) => set({ vendor_id: id }),
  setPoNumber: (po) => set({ po_number: po }),
  setReceiptDate: (date) => set({ receipt_date: date }),
  setBillImageUrl: (url) => set({ bill_image_url: url }),
  setLineItems: (items) => set({ line_items: items }),
  addLineItem: (item) => set((state) => ({ line_items: [...state.line_items, item] })),
  updateLineItem: (line_id, patch) => set((state) => ({
    line_items: state.line_items.map((item) => 
      item.line_id === line_id ? { ...item, ...patch } : item
    )
  })),
  removeLineItem: (line_id) => set((state) => ({
    line_items: state.line_items.filter((item) => item.line_id !== line_id)
  })),
  resetIntake: () => set(getInitialState()),
}));
