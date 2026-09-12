import { useMutation, useQuery } from '@tanstack/react-query';
import { useIntakeStore } from '../store/intakeStore';
import { useToast } from '../hooks/use-toast';
import api from '../lib/api';

export function useOCRUpload() {
  const { setReceiptId, setLineItems } = useIntakeStore();
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
      toast({
        title: "Success",
        description: "Receipt processed successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process receipt.",
        variant: "destructive",
      });
    }
  });
}

export function useBarcodeIntake() {
  return useMutation({
    mutationFn: async ({ barcode }) => {
      const { data } = await api.post('/intake/barcode', { barcode });
      return data;
    }
  });
}

export function useConfirmReceipt() {
  const { resetIntake } = useIntakeStore();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (confirmData) => {
      const { data } = await api.post('/intake/confirm', confirmData);
      return data;
    },
    onSuccess: () => {
      resetIntake();
      toast({
        title: "Receipt Confirmed",
        description: "Receipt has been submitted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to confirm receipt.",
        variant: "destructive",
      });
    }
  });
}

export function useReceipts(filters) {
  return useQuery({
    queryKey: ['receipts', filters],
    queryFn: async () => {
      const params = new URLSearchParams(filters).toString();
      const { data } = await api.get(`/intake/receipts?${params}`);
      return data;
    }
  });
}

export function useReceipt(id) {
  return useQuery({
    queryKey: ['receipts', id],
    queryFn: async () => {
      const { data } = await api.get(`/intake/receipts/${id}`);
      return data;
    },
    enabled: !!id,
  });
}
