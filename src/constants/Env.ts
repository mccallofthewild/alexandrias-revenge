export const Env = process.env as {
	NODE_ENV: 'development' | 'staging' | 'test' | 'production';
	WALLET_FILE_SECRET: string;
	PORT?: string;
};
