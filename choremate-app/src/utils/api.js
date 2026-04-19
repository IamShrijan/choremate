/**
 * api.js — re-exports from realApi.js (the real backend client).
 *
 * When VITE_USE_MOCK=true, vite.config.js aliases realApi → mockApi,
 * so this file transparently serves mock data instead.
 *
 * All page imports stay:  import { ... } from '../utils/api'
 * No page changes required.
 */
export {
  authAPI,
  houseAPI,
  userAPI,
  preferencesAPI,
  choresAPI,
  statsAPI,
  chatbotAPI,
  notificationsAPI,
  default,
} from './realApi.js';