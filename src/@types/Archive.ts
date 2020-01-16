export declare namespace Archive {
	export interface Media {
		type: 'Article' | 'Image';
		originUrl: string;
		archivedAt: string;
	}

	export interface Article extends Media {
		type: 'Article';
		content: string;
		author: string | null;
		title: string | null;
		sample: string | null;
		publishedAt: string | null;
		textDirection: 'ltr' | 'rtl';
		wordCount: number;
		heroImageUrl: string | null;
		afinnSentimentScore: number;
	}
}
