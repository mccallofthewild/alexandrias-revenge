export const Env = process.env as {
	NODE_ENV: 'development' | 'staging' | 'test' | 'production';
	READER_SIGNING_SECRET: string;
};
