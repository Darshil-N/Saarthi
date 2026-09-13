import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';

export function useMatchingQueue() {
  return useQuery({
    queryKey: ['matching'],
    queryFn: async () => {
      const { data } = await api.get('/matching');
      return data;
    }
  });
}

export function useApproveMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data } = await api.patch(`/matching/${id}/approve`, payload);
      return data;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: ['matching'] });
      const previousMatches = queryClient.getQueryData(['matching']);
      queryClient.setQueryData(['matching'], (old) => 
        old ? old.filter((item) => item.id !== id) : []
      );
      return { previousMatches };
    },
    onError: (err, variables, context) => {
      if (context?.previousMatches) {
        queryClient.setQueryData(['matching'], context.previousMatches);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['matching'] });
    },
  });
}

export function useRejectMatch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.patch(`/matching/${id}/reject`);
      return data;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['matching'] });
      const previousMatches = queryClient.getQueryData(['matching']);
      queryClient.setQueryData(['matching'], (old) => 
        old ? old.filter((item) => item.id !== id) : []
      );
      return { previousMatches };
    },
    onError: (err, variables, context) => {
      if (context?.previousMatches) {
        queryClient.setQueryData(['matching'], context.previousMatches);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['matching'] });
    },
  });
}
