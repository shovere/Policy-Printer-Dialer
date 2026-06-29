/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_API_BASE?: string;
	readonly VITE_DIALER_AUTH_BASE?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
