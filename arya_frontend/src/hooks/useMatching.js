import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../lib/api';
import { useToast } from './use-toast';
import { getApiErrorMessage } from '../lib/utils';

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
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id) => {
      const { data } = await api.patch(`/matching/${id}/approve`);
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
    onSuccess: () => {
      toast({ title: 'Mapping approved' });
    },
    onError: (err, variables, context) => {
      if (context?.previousMatches) {
        queryClient.setQueryData(['matching'], context.previousMatches);
      }
      toast({
        title: 'Could not approve the mapping',
        description: getApiErrorMessage(err, 'Please try again.'),
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['matching'] });
    },
  });
}

export function useRejectMatch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

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
    onSuccess: () => {
      toast({ title: 'Mapping rejected' });
    },
    onError: (err, variables, context) => {
      if (context?.previousMatches) {
        queryClient.setQueryData(['matching'], context.previousMatches);
      }
      toast({
        title: 'Could not reject the mapping',
        description: getApiErrorMessage(err, 'Please try again.'),
        variant: 'destructive',
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['matching'] });
    },
  });
}
