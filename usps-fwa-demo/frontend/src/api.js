import axios from 'axios';

// No hostnames or ports here. vite.config.js proxies these paths using the root .env.
export const api = axios.create({ baseURL: '/api' });
export const feed = axios.create({ baseURL: '/feed' });

export const WATCH_ACCOUNT = 'ACCT-0042';
export const QUERY_CHIPS = ['counterfeit label', 'fake postage on a package', 'shipping slip that will not scan'];
