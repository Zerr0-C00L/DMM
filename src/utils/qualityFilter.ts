import { SearchResult } from '@/services/mediasearch';
import getReleaseTags from './score';

export interface QualityPreferences {
	minResolution?: string;
	maxFileSizeGB?: number;
	minFileSizeGB?: number;
	preferredKeywords?: string[];
	excludeKeywords?: string[];
	preferredResolutions?: string[];
	preferredCodecs?: string[];
	requireHDR?: boolean;
	requireRemux?: boolean;
}

// Resolution priority mapping
const resolutionPriority: { [key: string]: number } = {
	'2160p': 4,
	'4k': 4,
	'1080p': 3,
	'720p': 2,
	'480p': 1,
	'360p': 0,
};

function getResolutionFromTitle(title: string): string | null {
	const resMatch = title.match(/\b(2160p|4k|1080p|720p|480p|360p)\b/i);
	return resMatch ? resMatch[1].toLowerCase() : null;
}

function meetsResolutionRequirement(title: string, minResolution?: string): boolean {
	if (!minResolution) return true;

	const titleResolution = getResolutionFromTitle(title);
	if (!titleResolution) return false;

	const minPriority = resolutionPriority[minResolution.toLowerCase()] || 0;
	const titlePriority = resolutionPriority[titleResolution] || 0;

	return titlePriority >= minPriority;
}

function meetsFileSizeRequirement(
	fileSizeBytes: number,
	minFileSizeGB?: number,
	maxFileSizeGB?: number
): boolean {
	const fileSizeGB = fileSizeBytes / (1024 * 1024 * 1024);

	if (minFileSizeGB && fileSizeGB < minFileSizeGB) return false;
	if (maxFileSizeGB && fileSizeGB > maxFileSizeGB) return false;

	return true;
}

function containsKeywords(title: string, keywords?: string[]): boolean {
	if (!keywords || keywords.length === 0) return false;

	const lowerTitle = title.toLowerCase();
	return keywords.some((keyword) => lowerTitle.includes(keyword.toLowerCase()));
}

function hasPreferredCodec(title: string, preferredCodecs?: string[]): boolean {
	if (!preferredCodecs || preferredCodecs.length === 0) return true;

	const lowerTitle = title.toLowerCase();
	return preferredCodecs.some((codec) => {
		const codecLower = codec.toLowerCase();
		// Check for codec in title with word boundaries or common separators
		return (
			lowerTitle.includes(codecLower) || lowerTitle.includes(codecLower.replace('x', 'h.'))
		);
	});
}

function hasPreferredResolution(title: string, preferredResolutions?: string[]): boolean {
	if (!preferredResolutions || preferredResolutions.length === 0) return true;

	const titleResolution = getResolutionFromTitle(title);
	if (!titleResolution) return false;

	return preferredResolutions.some((res) => res.toLowerCase() === titleResolution.toLowerCase());
}

/**
 * Filters torrents based on quality preferences
 */
export function filterByQualityPreferences(
	torrents: SearchResult[],
	preferences: QualityPreferences
): SearchResult[] {
	return torrents.filter((torrent) => {
		const title = torrent.title;
		const fileSize = torrent.fileSize || torrent.biggestFileSize || 0;

		// Check excluded keywords first (hard filter)
		if (containsKeywords(title, preferences.excludeKeywords)) {
			return false;
		}

		// Check minimum resolution requirement
		if (!meetsResolutionRequirement(title, preferences.minResolution)) {
			return false;
		}

		// Check file size requirements
		if (
			!meetsFileSizeRequirement(
				fileSize,
				preferences.minFileSizeGB,
				preferences.maxFileSizeGB
			)
		) {
			return false;
		}

		// Check for required HDR
		if (preferences.requireHDR) {
			const tags = getReleaseTags(title, fileSize);
			if (!tags.hdr && !tags.dolby_vision && !tags.hdr10plus) {
				return false;
			}
		}

		// Check for required REMUX
		if (preferences.requireRemux) {
			const tags = getReleaseTags(title, fileSize);
			if (!tags.remux) {
				return false;
			}
		}

		return true;
	});
}

/**
 * Scores torrents based on quality preferences (higher is better)
 */
export function scoreByQualityPreferences(
	torrent: SearchResult,
	preferences: QualityPreferences
): number {
	const title = torrent.title;
	const fileSize = torrent.fileSize || torrent.biggestFileSize || 0;
	let score = 0;

	// Base score from release tags
	const tags = getReleaseTags(title, fileSize);
	score += tags.score;

	// Bonus for preferred keywords
	if (containsKeywords(title, preferences.preferredKeywords)) {
		score += 50;
	}

	// Bonus for preferred codec
	if (hasPreferredCodec(title, preferences.preferredCodecs)) {
		score += 30;
	}

	// Bonus for preferred resolution
	if (hasPreferredResolution(title, preferences.preferredResolutions)) {
		score += 20;
	}

	// Bonus for being cached/available
	if (torrent.rdAvailable) {
		score += 100;
	}

	return score;
}

/**
 * Filters and sorts torrents by quality preferences, returning the best matches
 */
export function getBestQualityTorrents(
	torrents: SearchResult[],
	preferences: QualityPreferences,
	limit: number = 1
): SearchResult[] {
	// First filter by hard requirements
	const filtered = filterByQualityPreferences(torrents, preferences);

	// Then score and sort
	const scored = filtered.map((torrent) => ({
		torrent,
		score: scoreByQualityPreferences(torrent, preferences),
	}));

	scored.sort((a, b) => b.score - a.score);

	return scored.slice(0, limit).map((item) => item.torrent);
}
