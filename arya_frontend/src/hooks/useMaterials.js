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
      // Mocked vendors since /vendors endpoint is not implemented
      return [
        { id: 'v1', name: 'Bharat Hardware Co.' },
        { id: 'v2', name: 'Delhi Supply Pvt Ltd' },
        { id: 'v3', name: 'Global Tech Equipments' },
      ];
    }
  });
}
