import crypto from 'crypto';
import { Env } from '../constants/Env';
import fs from 'fs';
import { Files } from '../constants/Files';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { GraphQL } from '../utils/GraphQL';
import { PermawebService } from './PermawebService';
import { UltraArQL } from '../utils/UltraArQL';
export class WalletService {
	private static ALGORITHM = 'aes-256-ctr';

	private static async loadRemoteWalletFromPermaweb(): Promise<JWKInterface> {
		const wallets = await PermawebService.search({
			walletIdentifier: Env.HEROKU_DYNAMIC_WALLET_IDENTIFIER
		});
		const wallet = wallets.pop();
		if (!wallet) {
			throw new Error('Failed to load remote wallet from permaweb.');
		}
		return (wallet.__data as unknown) as JWKInterface;
	}
	private static async createRemoteWallet() {
		if (
			!(
				Env.HEROKU_TRUSTED_PEER_URI &&
				Env.HEROKU_DYNAMIC_WALLET_IDENTIFIER &&
				Env.HEROKU_DYNAMIC_WALLET_SECRET
			)
		) {
			throw new Error(
				'Environment variables not configured for remote wallet creation.'
			);
		}
		const graphql = GraphQL.createRequester(Env.HEROKU_TRUSTED_PEER_URI);
		const wallet = await PermawebService.arweave.wallets.generate();
		const stringifiedWallet = JSON.stringify(wallet);
		const encryptedWallet = this.encrypt(
			Buffer.from(stringifiedWallet, 'utf8'),
			Env.HEROKU_DYNAMIC_WALLET_SECRET
		);
		const { walletTxId } = await graphql`
			mutation publishEncryptedWalletForPeer(
				$encryptedWalletJWK: String!
				$walletIdentifier: ID!
			) {
				walletTxId: publishEncryptedWalletForPeer(
					encryptedWalletJWK: $encryptedWalletJWK
					walletIdentifier: $walletIdentifier
				)
			}
		`({
			encryptedWalletJWK: encryptedWallet,
			walletIdentifier: Env.HEROKU_DYNAMIC_WALLET_IDENTIFIER
		});
		return walletTxId as string;
	}

	static async loadWalletFromFile(): Promise<JWKInterface> {
		const jsonString = this.decryptFile(
			Files.ENCRYPTED_WALLET_PATH,
			Env.WALLET_FILE_SECRET
		);
		return (JSON.parse(jsonString) as unknown) as JWKInterface;
	}
	static async loadWallet(): Promise<JWKInterface> {
		const _loadWallet = async () => {
			try {
				let wallet = await this.loadWalletFromFile();
				return wallet;
			} catch (e) {}
			try {
				let wallet = await this.loadRemoteWalletFromPermaweb();
				if (wallet) return wallet;
			} catch (e) {}
			const txId = await this.createRemoteWallet();
			const startTime = Date.now();
			while (true) {
				if (Date.now() - startTime > 30 * 60 * 1000) break;
				await new Promise(r => setTimeout(r, 20000));
				const status = await PermawebService.getHumanReadableTransactionStatus(
					txId
				);
				if (status == 'SUCCESS') {
					let wallet = await this.loadRemoteWalletFromPermaweb();
					if (wallet) return wallet;
				}
				throw new Error('failed to create wallet');
			}
		};
		const wallet = await _loadWallet();
		if (wallet) {
			this.loadWallet = () => Promise.resolve(wallet);
			return wallet;
		}
		throw new Error('failed to load wallet');
	}
	static encryptFile(
		inputFilePath: string,
		password: string,
		outputFilePath?: string
	): Buffer {
		const buffer = fs.readFileSync(inputFilePath);
		const encryptedBuffer = this.encrypt(buffer, password);
		if (outputFilePath) fs.writeFileSync(outputFilePath, encryptedBuffer);
		return encryptedBuffer;
	}

	private static decryptFile(filePath: string, password: string): string {
		const buffer = fs.readFileSync(filePath);
		const decryptedBuffer = this.decrypt(buffer, password);
		return decryptedBuffer.toString();
	}
	private static createKey(secret: string): string {
		return crypto
			.createHash('sha256')
			.update(secret)
			.digest('base64')
			.substr(0, 32);
	}
	private static encrypt(buffer: Buffer, password: string): Buffer {
		// Create an initialization vector
		const iv = crypto.randomBytes(16);
		// Create a new cipher using the algorithm, key, and iv
		const cipher = crypto.createCipheriv(
			this.ALGORITHM,
			this.createKey(password),
			iv
		);
		// Create the new (encrypted) buffer
		const result = Buffer.concat([iv, cipher.update(buffer), cipher.final()]);
		return result;
	}

	private static decrypt(encrypted: Buffer, password: string): Buffer {
		// Get the iv: the first 16 bytes
		const iv = encrypted.slice(0, 16);
		// Get the rest
		encrypted = encrypted.slice(16);
		// Create a decipher
		const decipher = crypto.createDecipheriv(
			this.ALGORITHM,
			this.createKey(password),
			iv
		);
		// Actually decrypt it
		const result = Buffer.concat([
			decipher.update(encrypted),
			decipher.final()
		]);
		return result;
	}
}
