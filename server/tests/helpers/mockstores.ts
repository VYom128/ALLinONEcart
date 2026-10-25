import { startMockstores, type Mockstores } from '@allinone/mockstores';
import { afterAll, beforeAll } from 'vitest';

/**
 * Starts mockstores on a random port for the whole file (spec §15.4) and stops it in afterAll.
 * Read `.url` inside tests (it is set in beforeAll). Tests never call real stores.
 */
export function useMockstores(): { readonly url: string } {
  let instance: Mockstores | undefined;
  beforeAll(async () => {
    instance = await startMockstores({ port: 0 });
  });
  afterAll(async () => {
    await instance?.close();
  });
  return {
    get url() {
      if (!instance) throw new Error('mockstores is not running yet (use .url inside a test)');
      return instance.url;
    },
  };
}
