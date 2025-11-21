import { SearchResult } from '@/services/mediasearch';
import { scrapeTorrentio } from '@/services/torrentio';
import { getTraktPopular, getTraktTrending } from '@/services/trakt';
import { handleAddAsMagnetInRd } from '@/utils/addMagnet';
import { instantCheckInRd } from '@/utils/instantChecks';
import { getBestQualityTorrents, QualityPreferences } from '@/utils/qualityFilter';
import fs from 'fs';
import path from 'path';

export interface AutoAddConfig {
	enabled: boolean;
	qualityPreferences: QualityPreferences;
	contentSources: {
		trakt?: {
			enabled: boolean;
			lists: string[];
			maxItemsPerList: number;
			mediaTypes: string[];
		};
	};
	limits: {
		maxTorrentsPerRun: number;
		maxTorrentsPerTitle: number;
	};
	dryRun: boolean;
	logLevel: string;
}

interface MediaItem {
	imdbId: string;
	title: string;
	year: number;
	type: 'movie' | 'show';
}

/**
 * Service for automatically adding quality content to Real-Debrid
 */
export class AutoAddService {
	private config: AutoAddConfig;
	private rdApiKey: string;
	private addedCount: number = 0;
	private logFile: string;

	constructor(rdApiKey: string, configPath: string = './quality-preferences.json') {
		this.rdApiKey = rdApiKey;

		// Load config
		const configFile = fs.readFileSync(configPath, 'utf-8');
		this.config = JSON.parse(configFile);

		// Setup logging
		const logsDir = path.join(process.cwd(), 'logs');
		if (!fs.existsSync(logsDir)) {
			fs.mkdirSync(logsDir, { recursive: true });
		}
		this.logFile = path.join(logsDir, `auto-add-${new Date().toISOString().split('T')[0]}.log`);
	}

	private log(message: string, level: string = 'info') {
		const timestamp = new Date().toISOString();
		const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;

		console.log(logMessage.trim());
		fs.appendFileSync(this.logFile, logMessage);
	}

	/**
	 * Fetch trending/popular content from Trakt
	 */
	private async fetchTraktContent(): Promise<MediaItem[]> {
		const items: MediaItem[] = [];

		if (!this.config.contentSources.trakt?.enabled) {
			return items;
		}

		const { lists, maxItemsPerList, mediaTypes } = this.config.contentSources.trakt;

		try {
			for (const listType of lists) {
				for (const mediaType of mediaTypes) {
					this.log(`Fetching ${listType} ${mediaType}s from Trakt...`);

					let content: any[] = [];
					if (listType === 'trending') {
						content = await getTraktTrending(
							mediaType as 'movie' | 'show',
							maxItemsPerList
						);
					} else if (listType === 'popular') {
						content = await getTraktPopular(
							mediaType as 'movie' | 'show',
							maxItemsPerList
						);
					}

					for (const item of content.slice(0, maxItemsPerList)) {
						const media = item[mediaType];
						if (media?.ids?.imdb) {
							items.push({
								imdbId: media.ids.imdb,
								title: media.title,
								year: media.year,
								type: mediaType as 'movie' | 'show',
							});
						}
					}
				}
			}

			this.log(`Fetched ${items.length} items from Trakt`);
		} catch (error) {
			this.log(`Error fetching Trakt content: ${error}`, 'error');
		}

		return items;
	}

	/**
	 * Search for torrents for a given media item
	 */
	private async searchTorrents(item: MediaItem): Promise<SearchResult[]> {
		try {
			this.log(`Searching torrents for: ${item.title} (${item.year})`);

			// Use Torrentio to search
			const results = await scrapeTorrentio(item.imdbId, item.type);

			// Convert to SearchResult format
			const searchResults: SearchResult[] = results.map((r) => ({
				title: r.title,
				fileSize: r.fileSize,
				hash: r.hash,
				rdAvailable: false,
				adAvailable: false,
				tbAvailable: false,
				files: [],
				noVideos: false,
				medianFileSize: r.fileSize / (1024 * 1024),
				biggestFileSize: r.fileSize,
				videoCount: 1,
				imdbId: item.imdbId,
			}));

			this.log(`Found ${searchResults.length} torrents for ${item.title}`);
			return searchResults;
		} catch (error) {
			this.log(`Error searching torrents for ${item.title}: ${error}`, 'error');
			return [];
		}
	}

	/**
	 * Check instant availability in Real-Debrid
	 */
	private async checkAvailability(torrents: SearchResult[]): Promise<SearchResult[]> {
		if (torrents.length === 0) return [];

		try {
			const hashes = torrents.map((t) => t.hash);

			// This will mutate the torrents array to set rdAvailable flag
			await instantCheckInRd(
				'', // dmmProblemKey - not needed for this use case
				'', // solution - not needed
				torrents[0].imdbId || '',
				hashes,
				(results) => {
					torrents.forEach((t, i) => {
						if (results[i]) {
							t.rdAvailable = results[i].rdAvailable;
						}
					});
					return Promise.resolve();
				},
				(results) => results // no sorting needed
			);

			const availableCount = torrents.filter((t) => t.rdAvailable).length;
			this.log(`${availableCount}/${torrents.length} torrents are instantly available`);
		} catch (error) {
			this.log(`Error checking availability: ${error}`, 'error');
		}

		return torrents;
	}

	/**
	 * Add a torrent to Real-Debrid
	 */
	private async addToRealDebrid(hash: string, title: string): Promise<boolean> {
		if (this.config.dryRun) {
			this.log(`[DRY RUN] Would add: ${title} (${hash})`);
			return true;
		}

		try {
			this.log(`Adding to Real-Debrid: ${title}`);
			await handleAddAsMagnetInRd(this.rdApiKey, hash);
			this.addedCount++;
			this.log(`Successfully added: ${title}`, 'success');
			return true;
		} catch (error) {
			this.log(`Failed to add ${title}: ${error}`, 'error');
			return false;
		}
	}

	/**
	 * Main execution method
	 */
	async run(): Promise<void> {
		this.log('=== Starting Auto-Add Quality Content ===');
		this.log(`Dry run mode: ${this.config.dryRun}`);
		this.log(`Max torrents per run: ${this.config.limits.maxTorrentsPerRun}`);
		this.log(`Max torrents per title: ${this.config.limits.maxTorrentsPerTitle}`);

		if (!this.config.enabled) {
			this.log('Auto-add is disabled in config. Exiting.');
			return;
		}

		try {
			// 1. Fetch content from sources
			const mediaItems = await this.fetchTraktContent();

			if (mediaItems.length === 0) {
				this.log('No content found to process. Exiting.');
				return;
			}

			// 2. Process each media item
			for (const item of mediaItems) {
				if (this.addedCount >= this.config.limits.maxTorrentsPerRun) {
					this.log('Reached max torrents per run limit. Stopping.');
					break;
				}

				// Search for torrents
				let torrents = await this.searchTorrents(item);
				if (torrents.length === 0) continue;

				// Check availability
				torrents = await this.checkAvailability(torrents);

				// Filter by quality preferences
				const qualityTorrents = getBestQualityTorrents(
					torrents,
					this.config.qualityPreferences,
					this.config.limits.maxTorrentsPerTitle
				);

				if (qualityTorrents.length === 0) {
					this.log(`No torrents met quality criteria for ${item.title}`);
					continue;
				}

				// Add to Real-Debrid
				for (const torrent of qualityTorrents) {
					if (this.addedCount >= this.config.limits.maxTorrentsPerRun) break;

					await this.addToRealDebrid(torrent.hash, `${item.title} - ${torrent.title}`);

					// Small delay to avoid rate limiting
					await new Promise((resolve) => setTimeout(resolve, 500));
				}
			}

			this.log(`=== Completed: Added ${this.addedCount} torrents ===`);
		} catch (error) {
			this.log(`Fatal error: ${error}`, 'error');
			throw error;
		}
	}
}
