import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const useMock = env.VITE_USE_MOCK === 'true';

  console.log(`[vite.config] mode=${mode}  useMock=${useMock}`);

  const mockApiPath = path.resolve(__dirname, 'src/utils/mockApi.js');

  return {
    plugins: [react()],
    resolve: {
      alias: useMock
        ? [
            // Redirect any import of src/utils/api (with or without .js)
            // to mockApi.js.  Uses a regex so it matches both
            //   from '../utils/api'
            //   from './api'
            //   from '/abs/path/to/src/utils/api'
            { find: /.*\/utils\/api(\.js)?$/, replacement: mockApiPath },
            { find: /.*\/utils\/realApi(\.js)?$/, replacement: mockApiPath },
          ]
        : [],
    },
  };
});
