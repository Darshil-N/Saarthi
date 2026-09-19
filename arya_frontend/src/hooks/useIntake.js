import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useIntakeStore } from '../store/intakeStore';
import { useToast } from '../hooks/use-toast';
import api from '../lib/api';
import { cleanFilters } from '../lib/intake';
import { getApiErrorMessage } from '../lib/utils';

export function useOCRUpload() {
  const { setReceiptId, setLineItems, setBillImageUrl, setBillImagePath } = useIntakeStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (formData) => {
      const { data } = await api.post('/intake/ocr', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: (data) => {
      setReceiptId(data.receipt_id);
      setLineItems(data.line_items || []);
      setBillImageUrl(data.bill_image_url || '');
      setBillImagePath(data.bill_image_path || null);
      toast({
        title: "Success",
        description: "Receipt processed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to process receipt."),
        variant: "destructive",
      });
    }
  });
}

export function useBarcodeIntake() {
  return useMutation({
    mutationFn: async ({ barcode }) => {
      const { data } = await api.post('/intake/barcode', { code: barcode });
      return data;
    }
  });
}

export function useConfirmReceipt() {
  const { resetIntake } = useIntakeStore();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (confirmData) => {
      const { data } = await api.post('/intake/confirm', confirmData);
      return data;
    },
    onSuccess: (data) => {
      resetIntake();
      // Home stats, receipt lists and pending approvals all changed.
      queryClient.invalidateQueries({ queryKey: ['receipts'] });
      queryClient.invalidateQueries({ queryKey: ['entry-stats'] });
      queryClient.invalidateQueries({ queryKey: ['matching'] });
      toast({
        title: data.already_confirmed ? "Receipt Already Confirmed" : "Receipt Confirmed",
        description: data.already_confirmed
          ? `${data.gr_number} was already saved earlier. Nothing was duplicated.`
          : `${data.gr_number} saved with ${data.line_items_created} item(s). Stock and price history are updated.`,
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: getApiErrorMessage(error, "Failed to confirm receipt."),
        variant: "destructive",
      });
    }
  });
}

export function useReceipts(filters = {}) {
  const params = cleanFilters(filters);
  return useQuery({
    queryKey: ['receipts', 'list', params],
    queryFn: async () => {
      const { data } = await api.get('/intake/receipts', { params });
      return data;
    }
  });
}

export function useReceipt(id) {
  return useQuery({
    queryKey: ['receipts', 'detail', id],
    queryFn: async () => {
      const { data } = await api.get(`/intake/receipts/${id}`);
      return data;
    },
    enabled: !!id,
  });
}
