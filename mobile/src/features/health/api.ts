import type { ApiSuccess, HealthData } from '@allinone/shared';
import { api } from '@/store/api';

const healthApi = api.injectEndpoints({
  endpoints: (build) => ({
    /** GET /health (spec §7.2). */
    getHealth: build.query<HealthData, void>({
      query: () => '/health',
      transformResponse: (body: ApiSuccess<HealthData>) => body.data,
    }),
  }),
});

export const { useGetHealthQuery } = healthApi;
