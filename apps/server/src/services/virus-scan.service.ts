import fs from "node:fs";
import path from "node:path";
import FormData from "form-data";
import { env } from "../config/env.js";

export interface VirusScanResult {
	scanId?: string;
	isClean: boolean;
	threat?: string;
	threatSeverity?: "critical" | "high" | "medium" | "low" | "unknown";
	detectionRatio?: string; // e.g. "2/70"
	scanDate?: string;
	error?: string;
}

const VIRUSTOTAL_API_URL = "https://www.virustotal.com/api/v3";

export const scanFileWithVirusTotal = async (filePath: string): Promise<VirusScanResult> => {
	if (!env.virusTotalApiKey) {
		return {
			isClean: true,
			error: "VirusTotal API key not configured"
		};
	}

	if (!env.enableVirusScan) {
		return {
			isClean: true,
			error: "Virus scanning is disabled"
		};
	}

	try {
		// Check if file exists
		if (!fs.existsSync(filePath)) {
			return {
				isClean: false,
				error: "File not found",
				threat: "FILE_NOT_FOUND"
			};
		}

		// Get file size - VirusTotal free tier has 650MB limit
		const fileStats = fs.statSync(filePath);
		if (fileStats.size > 650 * 1024 * 1024) {
			return {
				isClean: false,
				error: "File exceeds VirusTotal size limit (650MB)",
				threat: "FILE_TOO_LARGE"
			};
		}

		// Submit file for scanning
		const scanResult = await submitFileToVirusTotal(filePath);
		
		if (scanResult.error) {
			return scanResult;
		}

		if (!scanResult.scanId) {
			return {
				isClean: false,
				error: "Failed to get scan ID from VirusTotal",
				threat: "SCAN_FAILED"
			};
		}

		// Poll for scan results with timeout
		const analysisResult = await pollScanResults(scanResult.scanId);
		
		return analysisResult;
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			isClean: false,
			error: `Virus scan failed: ${message}`,
			threat: "SCAN_ERROR"
		};
	}
};

const submitFileToVirusTotal = async (filePath: string): Promise<VirusScanResult> => {
	const form = new FormData();
	const fileStream = fs.createReadStream(filePath);
	form.append("file", fileStream);

	try {
		const response = await fetch(`${VIRUSTOTAL_API_URL}/files`, {
			method: "POST",
			headers: {
				"x-apikey": env.virusTotalApiKey!
			},
			body: form
		});

		if (!response.ok) {
			const errorData = await response.json();
			return {
				isClean: false,
				error: `VirusTotal API error: ${response.status}`,
				threat: "API_ERROR"
			};
		}

		const data = await response.json() as any;
		const scanId = data.data?.id;

		if (!scanId) {
			return {
				isClean: false,
				error: "No scan ID returned from VirusTotal",
				threat: "INVALID_RESPONSE"
			};
		}

		return { scanId, isClean: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			isClean: false,
			error: `Failed to submit file to VirusTotal: ${message}`,
			threat: "SUBMISSION_FAILED"
		};
	}
};

const pollScanResults = async (scanId: string, maxAttempts = 30): Promise<VirusScanResult> => {
	// VirusTotal scan ID format: "file-{hash}"
	const analysisId = scanId.split("-")[1] ? scanId : `file-${scanId}`;

	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			const response = await fetch(`${VIRUSTOTAL_API_URL}/analyses/${analysisId}`, {
				method: "GET",
				headers: {
					"x-apikey": env.virusTotalApiKey!
				}
			});

			if (!response.ok) {
				if (response.status === 404) {
					// Scan ID might be invalid, wait and retry
					await new Promise(resolve => setTimeout(resolve, 2000));
					continue;
				}
				return {
					isClean: false,
					error: `VirusTotal API error: ${response.status}`,
					threat: "API_ERROR"
				};
			}

			const data = await response.json() as any;
			const analysis = data.data?.attributes;

			if (!analysis) {
				return {
					isClean: false,
					error: "Invalid response from VirusTotal",
					threat: "INVALID_RESPONSE"
				};
			}

			const status = analysis.status;

			// Scan still in progress
			if (status === "queued" || status === "running") {
				// Wait before retrying
				await new Promise(resolve => setTimeout(resolve, 2000));
				continue;
			}

			// Scan completed
			if (status === "completed") {
				const stats = analysis.stats || {};
				const maliciousCount = stats.malicious || 0;
				const suspiciousCount = stats.suspicious || 0;
				const harmlessCount = stats.harmless || 0;
				const totalEngines = maliciousCount + suspiciousCount + harmlessCount;

				return {
					scanId,
					isClean: maliciousCount === 0 && suspiciousCount === 0,
					threat: maliciousCount > 0 ? "MALWARE_DETECTED" : (suspiciousCount > 0 ? "SUSPICIOUS" : undefined),
					threatSeverity: maliciousCount > 0 ? "high" : (suspiciousCount > 0 ? "medium" : "low"),
					detectionRatio: `${maliciousCount + suspiciousCount}/${totalEngines}`,
					scanDate: analysis.last_analysis_date ? new Date(analysis.last_analysis_date * 1000).toISOString() : undefined
				};
			}

			// Unexpected status
			return {
				isClean: false,
				error: `Unexpected scan status: ${status}`,
				threat: "UNKNOWN_STATUS"
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : "Unknown error";
			return {
				isClean: false,
				error: `Failed to get scan results: ${message}`,
				threat: "POLL_ERROR"
			};
		}
	}

	return {
		isClean: false,
		error: "Scan result polling timeout",
		threat: "TIMEOUT"
	};
};

/**
 * Get virus scanning service status
 */
export const getVirusScanningSatus = () => {
	return {
		enabled: Boolean(env.enableVirusScan && env.virusTotalApiKey),
		status: env.enableVirusScan ? "active" : "disabled"
	};
};

/**
 * Get scan status for an existing scan ID
 */
export const getVirusScanStatus = async (analysisId: string): Promise<VirusScanResult> => {
	if (!env.virusTotalApiKey) {
		return {
			isClean: true,
			error: "VirusTotal API key not configured"
		};
	}

	try {
		const response = await fetch(`${VIRUSTOTAL_API_URL}/analyses/${analysisId}`, {
			method: "GET",
			headers: {
				"x-apikey": env.virusTotalApiKey
			}
		});

		if (!response.ok) {
			return {
				isClean: false,
				error: `VirusTotal API error: ${response.status}`,
				threat: "API_ERROR"
			};
		}

		const data = await response.json() as any;
		const analysis = data.data?.attributes;

		if (!analysis) {
			return {
				isClean: false,
				error: "Invalid response from VirusTotal",
				threat: "INVALID_RESPONSE"
			};
		}

		const stats = analysis.stats || {};
		const maliciousCount = stats.malicious || 0;
		const suspiciousCount = stats.suspicious || 0;
		const harmlessCount = stats.harmless || 0;
		const totalEngines = maliciousCount + suspiciousCount + harmlessCount;

		return {
			scanId: analysisId,
			isClean: maliciousCount === 0 && suspiciousCount === 0,
			threat: maliciousCount > 0 ? "MALWARE_DETECTED" : (suspiciousCount > 0 ? "SUSPICIOUS" : undefined),
			threatSeverity: maliciousCount > 0 ? "high" : (suspiciousCount > 0 ? "medium" : "low"),
			detectionRatio: `${maliciousCount + suspiciousCount}/${totalEngines}`,
			scanDate: analysis.last_analysis_date ? new Date(analysis.last_analysis_date * 1000).toISOString() : undefined
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		return {
			isClean: false,
			error: `Failed to get scan status: ${message}`,
			threat: "API_ERROR"
		};
	}
};
