import crypto from 'crypto';
import { Env } from '../constants/Env';
import fs from 'fs';
import { Files } from '../constants/Files';
import { JWKInterface } from 'arweave/node/lib/wallet';
import { GraphQL } from '../utils/GraphQL';
import { PermawebService } from './PermawebService';
import { UltraArQL } from '../utils/UltraArQL';
import { Encrypt } from '../utils/Encrypt';

export class WalletService {
	private static ALGORITHM = 'aes-256-ctr';
	static async loadWallet(): Promise<JWKInterface> {
		const _loadWallet = async () => {
			try {
				let wallet = await this.loadWalletFromEncryptedFile();
				console.log('loaded wallet from file');
				return wallet;
			} catch (e) {}
			try {
				let wallet = await this.loadRemoteWalletFromPermaweb();
				console.log('loaded remote wallet from permaweb');
				if (wallet) return wallet;
			} catch (e) {}
			// return;
			const txId = await this.createRemoteWallet();
			const startTime = Date.now();
			while (true) {
				if (Date.now() - startTime > 30 * 60 * 1000) break;
				await new Promise(r => setTimeout(r, 20000));
				try {
					let wallet = await this.loadRemoteWalletFromPermaweb();
					if (wallet) return wallet;
				} catch (e) {}
			}
			throw new Error('failed to create wallet');
		};
		try {
			const walletPromise = _loadWallet();
			this.loadWallet = () => walletPromise;
			const wallet = await walletPromise;
			if (wallet) {
				this.loadWallet = () => Promise.resolve(wallet);
				return wallet;
			}
		} catch (e) {
			console.error(e);
			this.loadWallet = () => _loadWallet();
		}
		throw new Error('failed to load wallet');
	}
	static updateEncryptedWalletFile() {
		if (!fs.existsSync(Files.WALLET_PATH)) return false;
		const buffer = fs.readFileSync(Files.WALLET_PATH);
		const encryptedBuffer = Encrypt.encryptBuffer(
			buffer,
			Env.WALLET_FILE_SECRET
		);
		fs.writeFileSync(Files.ENCRYPTED_WALLET_PATH, encryptedBuffer);
		return true;
	}
	private static async loadRemoteWalletFromPermaweb(): Promise<JWKInterface> {
		if (!Env.TEMPLATE_DEPLOY_DYNAMIC_WALLET_SECRET) {
			throw new Error('Environment vars not configured for remote wallet.');
		}
		const wallets = await PermawebService.search({
			walletIdentifier: Env.TEMPLATE_DEPLOY_DYNAMIC_WALLET_IDENTIFIER
		});
		const walletTxInfo = wallets.pop();
		if (!walletTxInfo) {
			throw new Error('Failed to load remote wallet from permaweb.');
		}
		const walletStr = Encrypt.decryptText(
			walletTxInfo.__data as string,
			Env.TEMPLATE_DEPLOY_DYNAMIC_WALLET_SECRET
		);
		const wallet = JSON.parse(walletStr) as JWKInterface;
		return wallet;
	}
	private static async createRemoteWallet() {
		if (
			!(
				Env.TEMPLATE_DEPLOY_TRUSTED_PEER_URI &&
				Env.TEMPLATE_DEPLOY_DYNAMIC_WALLET_IDENTIFIER &&
				Env.TEMPLATE_DEPLOY_DYNAMIC_WALLET_SECRET
			)
		) {
			throw new Error(
				'Environment variables not configured for remote wallet creation.'
			);
		}
		console.log('creating remote wallet');
		const graphql = GraphQL.createRequester(
			Env.TEMPLATE_DEPLOY_TRUSTED_PEER_URI + '/graphql'
		);
		const wallet = await PermawebService.arweave.wallets.generate();
		const stringifiedWallet = JSON.stringify(wallet);
		const encryptedWallet = Encrypt.encryptText(
			stringifiedWallet,
			Env.TEMPLATE_DEPLOY_DYNAMIC_WALLET_SECRET
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
			walletIdentifier: Env.TEMPLATE_DEPLOY_DYNAMIC_WALLET_IDENTIFIER
		});
		return walletTxId as string;
	}

	static async loadWalletFromEncryptedFile(): Promise<JWKInterface> {
		const buffer = fs.readFileSync(Files.ENCRYPTED_WALLET_PATH);
		const decryptedBuffer = Encrypt.decryptBuffer(
			buffer,
			Env.WALLET_FILE_SECRET
		);
		const jsonString = decryptedBuffer.toString();
		return (JSON.parse(jsonString) as unknown) as JWKInterface;
	}
}
