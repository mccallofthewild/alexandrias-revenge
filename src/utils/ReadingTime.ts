/*!
 * reading-time
 * Copyright (c) Nicolas Gryman <ngryman@gmail.com>
 * MIT Licensed
 */
// Modified

'use strict';
function ansiWordBound(c: string) {
	return ' ' === c || '\n' === c || '\r' === c || '\t' === c;
}
export class ReadingTime {
	static calculate(
		text: string,
		{
			wordsPerMinute = 200,
			wordBound = ansiWordBound
		}: { wordsPerMinute?: number; wordBound?: (char: string) => boolean } = {}
	): {
		text: string;
		minutes: number;
		time: number;
		words: number;
	} {
		var words = 0,
			start = 0,
			end = text.length - 1,
			i;

		// fetch bounds
		while (wordBound(text[start])) start++;
		while (wordBound(text[end])) end--;

		// calculate the number of words
		for (i = start; i <= end; ) {
			for (; i <= end && !wordBound(text[i]); i++);
			words++;
			for (; i <= end && wordBound(text[i]); i++);
		}

		// reading time stats
		var minutes = words / wordsPerMinute;
		var time = minutes * 60 * 1000;
		var displayed = Math.ceil(+minutes.toFixed(2));

		return {
			text: displayed + ' min read',
			minutes: minutes,
			time: time,
			words: words
		};
	}
}
