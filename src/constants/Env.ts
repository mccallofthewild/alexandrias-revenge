export const Env = process.env as {
	NODE_ENV: 'development' | 'staging' | 'test' | 'production';
	WALLET_FILE_SECRET: string;
	PORT?: string;
	HEROKU_DYNAMIC_WALLET_IDENTIFIER?: string;
	HEROKU_DYNAMIC_WALLET_SECRET?: string;
	HEROKU_TRUSTED_PEER_URI?: string;
};
