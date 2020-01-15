import Mercury from '@postlight/mercury-parser';
import { Env } from '../constants/Env';

export class ReaderService {
	static async read(url: string): Promise<Mercury.ParseResult> {
		const parsed = await Mercury.parse(url);
		return parsed;
	}
}
