#!/usr/bin/env node

/**
 * Auto-Add Quality Content Script
 * 
 * This script runs as a standalone Node.js application (not requiring Next.js server)
 * It fetches trending/popular content and adds high-quality torrents to Real-Debrid
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Configuration
const TRAKT_API_URL = 'https://api.trakt.tv';
const RD_API_URL = 'https://api.real-debrid.com';
const TORRENTIO_URL = 'https://torrentio.strem.fun';

class AutoAddService {
	constructor() {
		this.rdApiKey = process.env.REAL_DEBRID_API_KEY;
		this.traktClientId = process.env.TRAKT_CLIENT_ID;
		this.traktAccessToken = process.env.TRAKT_ACCESS_TOKEN;
		
		if (!this.rdApiKey) {
			throw new Error('REAL_DEBRID_API_KEY environment variable is required');
		}

		// Load config
		const configPath = path.join(process.cwd(), 'quality-preferences.json');
		const configFile = fs.readFileSync(configPath, 'utf-8');
		this.config = JSON.parse(configFile);

		// Setup logging
		const logsDir = path.join(process.cwd(), 'logs');
		if (!fs.existsSync(logsDir)) {
			fs.mkdirSync(logsDir, { recursive: true });
		}
		this.logFile = path.join(logsDir, `auto-add-${new Date().toISOString().split('T')[0]}.log`);
		this.addedCount = 0;
	}

	log(message, level = 'info') {
		const timestamp = new Date().toISOString();
		const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
		
		console.log(logMessage.trim());
		fs.appendFileSync(this.logFile, logMessage);
	}

	// Fetch trending content from Trakt
	async fetchTraktTrending(type, limit = 20) {
		if (!this.traktClientId) {
			this.log('Trakt Client ID not configured, skipping Trakt fetch', 'warn');
			return [];
		}

		try {
			const headers = {
				'Content-Type': 'application/json',
				'trakt-api-version': '2',
				'trakt-api-key': this.traktClientId,
			};

			const response = await axios.get(
				`${TRAKT_API_URL}/${type}s/trending?limit=${limit}`,
				{ headers, timeout: 10000 }
			);

			return response.data.map(item => ({
				imdbId: item[type]?.ids?.imdb,
				title: item[type]?.title,
				year: item[type]?.year,
				type: type,
			})).filter(item => item.imdbId);
		} catch (error) {
			this.log(`Error fetching Trakt ${type}s: ${error.message}`, 'error');
			return [];
		}
	}

	// Fetch popular content from Trakt
	async fetchTraktPopular(type, limit = 20) {
		if (!this.traktClientId) {
			return [];
		}

		try {
			const headers = {
				'Content-Type': 'application/json',
				'trakt-api-version': '2',
				'trakt-api-key': this.traktClientId,
			};

			const response = await axios.get(
				`${TRAKT_API_URL}/${type}s/popular?limit=${limit}`,
				{ headers, timeout: 10000 }
			);

			return response.data.map(item => ({
				imdbId: item.ids?.imdb,
				title: item.title,
				year: item.year,
				type: type,
			})).filter(item => item.imdbId);
		} catch (error) {
			this.log(`Error fetching Trakt popular ${type}s: ${error.message}`, 'error');
			return [];
		}
	}

	// Fetch from custom Trakt list
	async fetchTraktList(username, listSlug) {
		if (!this.traktClientId) {
			this.log('Trakt Client ID not configured', 'warn');
			return [];
		}

		try {
			const headers = {
				'Content-Type': 'application/json',
				'trakt-api-version': '2',
				'trakt-api-key': this.traktClientId,
			};

			// Add access token if available for private lists
			if (this.traktAccessToken) {
				headers['Authorization'] = `Bearer ${this.traktAccessToken}`;
			}

			const response = await axios.get(
				`${TRAKT_API_URL}/users/${username}/lists/${listSlug}/items`,
				{ headers, timeout: 15000 }
			);

			return response.data.map(item => {
				const mediaType = item.type === 'movie' ? 'movie' : 'show';
				const media = item[mediaType];
				
				return {
					imdbId: media?.ids?.imdb,
					title: media?.title,
					year: media?.year,
					type: mediaType,
				};
			}).filter(item => item.imdbId);
		} catch (error) {
			this.log(`Error fetching Trakt list ${username}/${listSlug}: ${error.message}`, 'error');
			return [];
		}
	}

	// Fetch from user's watchlist
	async fetchTraktWatchlist(username) {
		if (!this.traktClientId || !this.traktAccessToken) {
			this.log('Trakt authentication not configured for watchlist', 'warn');
			return [];
		}

		try {
			const headers = {
				'Content-Type': 'application/json',
				'trakt-api-version': '2',
				'trakt-api-key': this.traktClientId,
				'Authorization': `Bearer ${this.traktAccessToken}`,
			};

			const response = await axios.get(
				`${TRAKT_API_URL}/users/${username}/watchlist`,
				{ headers, timeout: 15000 }
			);

			return response.data.map(item => {
				const mediaType = item.type === 'movie' ? 'movie' : 'show';
				const media = item[mediaType];
				
				return {
					imdbId: media?.ids?.imdb,
					title: media?.title,
					year: media?.year,
					type: mediaType,
				};
			}).filter(item => item.imdbId);
		} catch (error) {
			this.log(`Error fetching Trakt watchlist: ${error.message}`, 'error');
			return [];
		}
	}

	// Search Torrentio for torrents
	async searchTorrentio(imdbId, mediaType) {
		try {
			const type = mediaType === 'show' ? 'series' : 'movie';
			// Build Torrentio URL with quality filters from config
			const sortBy = this.config.qualityPreferences.torrentioSortBy || 'qualitysize';
			const qualityFilter = this.config.qualityPreferences.torrentioQualityFilter || 'other,scr,cam,unknown';
			const url = `${TORRENTIO_URL}/sort=${sortBy}%7Cqualityfilter=${qualityFilter}/stream/${type}/${imdbId}.json`;
			
			const response = await axios.get(url, { timeout: 15000 });
			
			if (!response.data?.streams) {
				return [];
			}

			return response.data.streams.map(stream => {
				const match = stream.title.match(/\n([^\n]+)\n💾 ([\d.]+\s*[KMGT]?B)/);
				const title = match ? match[1] : stream.title;
				const sizeStr = match ? match[2] : '0';
				
				// Parse size to bytes
				let bytes = 0;
				const sizeMatch = sizeStr.match(/([\d.]+)\s*([KMGT]?B)/);
				if (sizeMatch) {
					const value = parseFloat(sizeMatch[1]);
					const unit = sizeMatch[2];
					const multipliers = { 'B': 1, 'KB': 1024, 'MB': 1024**2, 'GB': 1024**3, 'TB': 1024**4 };
					bytes = value * (multipliers[unit] || 1);
				}

				// Extract hash from infoHash
				const hash = stream.infoHash?.toLowerCase() || '';

				return {
					title,
					fileSize: bytes,
					hash,
					rdAvailable: false,
				};
			}).filter(t => t.hash);
		} catch (error) {
			this.log(`Error searching Torrentio: ${error.message}`, 'error');
			return [];
		}
	}

	// Check if hash is cached in Real-Debrid
	async checkRdAvailability(hashes) {
		if (hashes.length === 0) return {};

		try {
			// Process in smaller batches to avoid rate limits
			const batchSize = 50; // Reduced from 100
			const availability = {};

			for (let i = 0; i < hashes.length; i += batchSize) {
				const batch = hashes.slice(i, i + batchSize);
				const url = `${RD_API_URL}/rest/1.0/torrents/instantAvailability/${batch.join('/')}`;
				
				let retries = 0;
				const maxRetries = 3;
				let success = false;

				while (retries < maxRetries && !success) {
					try {
						const response = await axios.get(url, {
							headers: { 'Authorization': `Bearer ${this.rdApiKey}` },
							timeout: 15000,
						});

						Object.assign(availability, response.data);
						success = true;
					} catch (err) {
						if (err.response?.status === 429) {
							// Rate limited - wait longer
							const waitTime = Math.pow(2, retries) * 2000; // 2s, 4s, 8s
							this.log(`Rate limited, waiting ${waitTime/1000}s before retry ${retries+1}/${maxRetries}...`, 'warn');
							await new Promise(resolve => setTimeout(resolve, waitTime));
							retries++;
						} else {
							throw err;
						}
					}
				}

				if (!success) {
					this.log(`Failed to check batch after ${maxRetries} retries, skipping...`, 'error');
				}
				
				// Longer delay between batches to avoid rate limits
				if (i + batchSize < hashes.length) {
					await new Promise(resolve => setTimeout(resolve, 1000)); // Increased from 300ms
				}
			}

			return availability;
		} catch (error) {
			this.log(`Error checking RD availability: ${error.message}`, 'error');
			return {};
		}
	}

	// Filter torrents by quality preferences
	filterByQuality(torrents) {
		const prefs = this.config.qualityPreferences;

		return torrents.filter(t => {
			const title = t.title.toLowerCase();
			const fileSizeGB = t.fileSize / (1024 ** 3);

			// Exclude bad quality
			if (prefs.excludeKeywords?.some(kw => title.includes(kw.toLowerCase()))) {
				return false;
			}

			// Check file size
			if (prefs.minFileSizeGB && fileSizeGB < prefs.minFileSizeGB) return false;
			if (prefs.maxFileSizeGB && fileSizeGB > prefs.maxFileSizeGB) return false;

			// Check resolution
			const hasResolution = prefs.preferredResolutions?.some(res => 
				title.includes(res.toLowerCase())
			);
			if (prefs.preferredResolutions?.length && !hasResolution) return false;

			return true;
		});
	}

	// Score and sort torrents
	scoreTorrents(torrents) {
		const prefs = this.config.qualityPreferences;

		return torrents.map(t => {
			const title = t.title.toLowerCase();
			let score = t.fileSize / (1024 ** 3); // Base score on file size in GB

			// Bonus for preferred keywords
			prefs.preferredKeywords?.forEach(kw => {
				if (title.includes(kw.toLowerCase())) score += 50;
			});

			// Bonus for preferred codecs
			prefs.preferredCodecs?.forEach(codec => {
				if (title.includes(codec.toLowerCase())) score += 30;
			});

			// Big bonus for being cached
			if (t.rdAvailable) score += 1000;

			return { ...t, score };
		}).sort((a, b) => b.score - a.score);
	}

	// Add magnet to Real-Debrid
	async addMagnetToRd(hash) {
		if (this.config.dryRun) {
			return true;
		}

		let retries = 0;
		const maxRetries = 3;

		while (retries < maxRetries) {
			try {
				const magnet = `magnet:?xt=urn:btih:${hash}`;
				const response = await axios.post(
					`${RD_API_URL}/rest/1.0/torrents/addMagnet`,
					`magnet=${encodeURIComponent(magnet)}`,
					{
						headers: {
							'Authorization': `Bearer ${this.rdApiKey}`,
							'Content-Type': 'application/x-www-form-urlencoded',
						},
						timeout: 15000,
					}
				);

				if (response.status === 201 && response.data.id) {
					// Select all files with retry
					const torrentId = response.data.id;
					await new Promise(resolve => setTimeout(resolve, 500)); // Small delay before selecting files
					
					await axios.post(
						`${RD_API_URL}/rest/1.0/torrents/selectFiles/${torrentId}`,
						'files=all',
						{
							headers: {
								'Authorization': `Bearer ${this.rdApiKey}`,
								'Content-Type': 'application/x-www-form-urlencoded',
							},
							timeout: 10000,
						}
					);
					return true;
				}
				return false;
			} catch (error) {
				if (error.response?.status === 429) {
					const waitTime = Math.pow(2, retries) * 2000;
					this.log(`Rate limited adding magnet, waiting ${waitTime/1000}s...`, 'warn');
					await new Promise(resolve => setTimeout(resolve, waitTime));
					retries++;
				} else {
					this.log(`Error adding magnet: ${error.message}`, 'error');
					return false;
				}
			}
		}

		this.log(`Failed to add magnet after ${maxRetries} retries`, 'error');
		return false;
	}

	// Main execution
	async run() {
		this.log('=== Starting Auto-Add Quality Content ===');
		this.log(`Dry run mode: ${this.config.dryRun}`);

		if (!this.config.enabled) {
			this.log('Auto-add is disabled. Exiting.');
			return;
		}

		try {
			// 1. Fetch content
			const items = [];
			const traktConfig = this.config.contentSources?.trakt;

			if (traktConfig?.enabled) {
				// Fetch from standard lists (trending, popular)
				for (const listType of traktConfig.lists || ['trending']) {
					// Skip custom list formats
					if (listType.includes('/')) continue;
					
					for (const mediaType of traktConfig.mediaTypes || ['movie']) {
						this.log(`Fetching ${listType} ${mediaType}s...`);
						
						let content = [];
						if (listType === 'trending') {
							content = await this.fetchTraktTrending(mediaType, traktConfig.maxItemsPerList);
						} else if (listType === 'popular') {
							content = await this.fetchTraktPopular(mediaType, traktConfig.maxItemsPerList);
						} else if (listType === 'watchlist') {
							if (traktConfig.username) {
								content = await this.fetchTraktWatchlist(traktConfig.username);
							}
						}
						
						items.push(...content);
					}
				}

				// Fetch from custom user lists (format: "username/list-slug")
				if (traktConfig.customLists) {
					for (const listPath of traktConfig.customLists) {
						const [username, listSlug] = listPath.split('/');
						if (username && listSlug) {
							this.log(`Fetching custom list: ${username}/${listSlug}...`);
							const content = await this.fetchTraktList(username, listSlug);
							items.push(...content);
						}
					}
				}
			}

			this.log(`Found ${items.length} items to process`);

			// 2. Process each item
			for (const item of items) {
				if (this.addedCount >= this.config.limits.maxTorrentsPerRun) {
					this.log('Reached max torrents limit. Stopping.');
					break;
				}

				this.log(`Processing: ${item.title} (${item.year})`);

				// Search torrents
				let torrents = await this.searchTorrentio(item.imdbId, item.type);
				this.log(`  Found ${torrents.length} torrents`);

				if (torrents.length === 0) continue;

				// Check availability
				const hashes = torrents.map(t => t.hash);
				const availability = await this.checkRdAvailability(hashes);
				torrents.forEach(t => {
					t.rdAvailable = !!availability[t.hash];
				});

				const cachedCount = torrents.filter(t => t.rdAvailable).length;
				this.log(`  ${cachedCount} torrents are cached`);

				// Filter by quality
				torrents = this.filterByQuality(torrents);
				this.log(`  ${torrents.length} torrents meet quality criteria`);

				if (torrents.length === 0) continue;

				// Score and select best
				const scored = this.scoreTorrents(torrents);
				const best = scored.slice(0, this.config.limits.maxTorrentsPerTitle || 1);

				// Add to RD
				for (const torrent of best) {
					if (this.addedCount >= this.config.limits.maxTorrentsPerRun) break;

					const action = this.config.dryRun ? '[DRY RUN] Would add' : 'Adding';
					this.log(`  ${action}: ${torrent.title} (score: ${torrent.score.toFixed(1)})`);

					const success = await this.addMagnetToRd(torrent.hash);
					if (success) {
						this.addedCount++;
						this.log(`  ✓ Added successfully`, 'success');
					}

					// Longer rate limiting delay to avoid 429 errors
					await new Promise(resolve => setTimeout(resolve, 1500)); // Increased from 500ms
				}
			}

			this.log(`=== Completed: ${this.addedCount} torrents added ===`);
		} catch (error) {
			this.log(`Fatal error: ${error.message}`, 'error');
			console.error(error);
			process.exit(1);
		}
	}
}

// Run the service
(async () => {
	try {
		const service = new AutoAddService();
		await service.run();
	} catch (error) {
		console.error('Failed to start:', error.message);
		process.exit(1);
	}
})();
