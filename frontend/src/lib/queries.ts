import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import type { Paginated } from './types';

export type Params = Record<string, string | number | boolean | undefined | null>;
const clean = (p: Params) =>
  Object.fromEntries(
    Object.entries(p).filter(([, v]) => v !== '' && v !== undefined && v !== null),
  );

export function useList<T>(
  path: string,
  params: Params = {},
  enabled = true,
  refetchInterval?: number,
) {
  return useQuery({
    queryKey: [path, 'list', clean(params)],
    queryFn: async () => (await api.get<Paginated<T>>(`/${path}/`, { params: clean(params) })).data,
    placeholderData: keepPreviousData,
    enabled,
    refetchInterval,
  });
}
export function useOne<T>(path: string, id?: string | number, enabled = true) {
  return useQuery({
    queryKey: [path, 'one', String(id)],
    queryFn: async () => (await api.get<T>(`/${path}/${id}/`)).data,
    enabled: enabled && id !== undefined,
  });
}
/** Petites listes de référence (menus déroulants), mises en cache longtemps. */
export function useOptions<T>(path: string, params: Params = {}, enabled = true) {
  return useQuery({
    queryKey: [path, 'options', clean(params)],
    queryFn: async () =>
      (await api.get<Paginated<T>>(`/${path}/`, { params: { page_size: 100, ...clean(params) } }))
        .data.results,
    staleTime: 5 * 60_000,
    enabled,
  });
}
export function useSave<T = unknown>(path: string, createPath?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: number | string; data: Record<string, unknown> }) =>
      id
        ? (await api.patch<T>(`/${path}/${id}/`, data)).data
        : (await api.post<T>(`/${createPath ?? path}/`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: [path] }),
  });
}
export function useRemove(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number | string) => api.delete(`/${path}/${id}/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: [path] }),
  });
}
export function useAction<T = unknown>(path: string, invalidate: string[] = []) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      url,
      method = 'post',
      data,
    }: {
      url: string;
      method?: 'post' | 'patch';
      data?: unknown;
    }) => (await api.request<T>({ url: `/${path}/${url}`, method, data })).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [path] });
      invalidate.forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    },
  });
}
