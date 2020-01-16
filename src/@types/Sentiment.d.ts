module 'sentiment' {
	interface ConstructorOptions {}

	interface AnalyzeOptions {
		extras: any;
		language: string;
	}

	interface AnalyzeResponse {
		score: number;
		comparative: number;
		tokens: Array<string>;
		words: Array<string>;
		positive: Array<string>;
		negative: Array<string>;
	}

	class Sentiment {
		constructor(options?: ConstructorOptions);
		analyze(
			phrase: string,
			opts?: AnalyzeOptions,
			callback?: Function
		): AnalyzeResponse;
		registerLanguage(languageCode: string, language: any): void;
	}

	export = Sentiment;
}
