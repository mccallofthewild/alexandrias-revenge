export const Env = process.env as {
	NODE_ENV: 'development' | 'staging' | 'test' | 'production';
	WALLET_FILE_SECRET: string;
	PORT?: string;
	TEMPLATE_DEPLOY_DYNAMIC_WALLET_IDENTIFIER?: string;
	TEMPLATE_DEPLOY_DYNAMIC_WALLET_SECRET?: string;
	TEMPLATE_DEPLOY_TRUSTED_PEER_URI?: string;
};
