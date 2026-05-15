import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { tenantService } from '../services/tenantService';

export function useTenants(params) {
  return useQuery({
    queryKey: ['tenants', params],
    queryFn: () => tenantService.getAll(params),
    placeholderData: (prev) => prev, // keep old data while fetching next page
  });
}

export function useCreateTenant(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => tenantService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant created successfully');
      options.onSuccess?.();
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useUpdateTenant(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => tenantService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant updated successfully');
      options.onSuccess?.();
    },
    onError: (e) => toast.error(e.message),
  });
}

export function useDeleteTenant(options = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => tenantService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] });
      toast.success('Tenant deleted');
      options.onSuccess?.();
    },
    onError: (e) => toast.error(e.message),
  });
}
