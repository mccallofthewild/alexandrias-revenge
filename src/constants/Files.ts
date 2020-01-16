import path from 'path';

const WALLET_PATH = path.join(__dirname, '../../wallet.json');
export const Files = {
	WALLET_PATH,
	ENCRYPTED_WALLET_PATH: WALLET_PATH + '.enc'
} as const;
