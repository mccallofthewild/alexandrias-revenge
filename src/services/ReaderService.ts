import Mercury from '@postlight/mercury-parser';
import { Env } from '../constants/Env';
import fs from 'fs';
import path from 'path';
import cheerio from 'cheerio';
import fetch from 'cross-fetch';
import { Archive } from '../@types/Archive';
import Sentiment from 'sentiment';
const sentiment = new Sentiment();
export class ReaderService {
	static async parse(url: string): Promise<Archive.Article> {
		const parsed = await Mercury.parse(url);
		const $ = cheerio.load(parsed.content || '');
		const text = $.root().text();
		const afinnSentimentScore = sentiment.analyze(text).score;
		console.log(parsed);
		return {
			type: 'Article',
			content: parsed.content || '',
			author: parsed.author,
			title: parsed.title,
			sample: parsed.excerpt,
			publishedAt: parsed.date_published
				? new Date(parsed.date_published).toISOString()
				: null,
			textDirection: parsed.direction,
			wordCount: parsed.word_count,
			originUrl: parsed.url,
			archivedAt: new Date().toISOString(),
			heroImageUrl: parsed.lead_image_url,
			afinnSentimentScore
		};
	}

	static async dataUriFromImageUrl(url: string): Promise<string> {
		const res = await fetch(url);
		const data = await res.arrayBuffer();
		const base64 = new Buffer(data).toString('base64');
		return `data:;base64,${base64}`;
	}

	static async replaceHrefs(html: string): Promise<string> {
		const $ = cheerio.load(html);
		const promises = $('a')
			.toArray()
			.map(async (el, index) => {
				const href = $(el).attr('href');
				if (!href) return;
				$(el).removeAttr('href');
				$(el).attr('web-two-href', href);
			});
		await Promise.all(promises);
		return $.html();
	}

	static async replaceImageUrlsWithDataUrls(html: string): Promise<string> {
		const $ = cheerio.load(html);
		const promises = $('[src], [srcset]')
			.toArray()
			.map(async (el, index) => {
				const src = $(el).attr('src');
				$(el).removeAttr('srcset');
				$(el).removeAttr('src');
				if (!src) return;
				try {
					const dataUri = await this.dataUriFromImageUrl(src);
					$(el).attr('src', dataUri);
				} catch (e) {}
			});
		await Promise.all(promises);
		return $.html();
	}

	static async renderPageFromTemplate(
		parsed: Archive.Article
	): Promise<string> {
		const template = fs.readFileSync(
			path.resolve(__dirname, '../../archive.template.html')
		);
		let archiveHTML = new Function('return `' + template + '`').bind({
			parsed
		})();
		archiveHTML = await this.replaceImageUrlsWithDataUrls(archiveHTML);
		archiveHTML = await this.replaceHrefs(archiveHTML);
		return archiveHTML;
	}
}
