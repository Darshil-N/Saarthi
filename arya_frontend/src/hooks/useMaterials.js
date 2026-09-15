import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

export function useEntryStats() {
  return useQuery({
    queryKey: ['entry-stats'],
    queryFn: async () => {
      const { data } = await api.get('/dashboard/entry');
      return data;
    }
  });
}

export function useVendors() {
  return useQuery({
    queryKey: ['vendors'],
    queryFn: async () => {
      const { data } = await api.get('/vendors');
      return data;
    }
  });
}

export function useLocations() {
  return useQuery({
    queryKey: ['locations'],
    queryFn: async () => {
      const { data } = await api.get('/inventory/locations');
      return data;
    }
  });
}
