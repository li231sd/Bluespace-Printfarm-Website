import NodeClam from "clamav.js";
import { env } from "../config/env.js";

let clamscan: any = null;

const initClamav = async () => {
	if (!env.clamavEnabled) {
		return null;
	}

	if (clamscan) {
		return clamscan;
	}

	try {
		clamscan = await new NodeClam().init({
			clamdscan: {
				host: env.clamavHost,
				port: env.clamavPort
			}
		});
		console.log("[ClamAV] Connected to ClamAV daemon");
		return clamscan;
	} catch (error) {
		console.error("[ClamAV] Failed to initialize:", error);
		return null;
	}
};

export interface ScanResult {
	isInfected: boolean;
	threats: string[];
	timestamp: Date;
}

/**
 * Scan a file for viruses/malware
 * Returns null if scanning is disabled or ClamAV is unavailable
 */
export const scanFileForVirus = async (filePath: string): Promise<ScanResult | null> => {
	const scanner = await initClamav();

	if (!scanner) {
		console.warn("[ClamAV] Scanning disabled - ClamAV not available");
		return null;
	}

	try {
		const { isInfected, viruses } = await scanner.scanFile(filePath);

		if (isInfected) {
			console.warn(`[ClamAV] Infected file detected: ${filePath}`, viruses);
		}

		return {
			isInfected,
			threats: viruses || [],
			timestamp: new Date()
		};
	} catch (error) {
		console.error("[ClamAV] Scan error:", error);
		// Return null on error - don't block uploads if scanner fails
		return null;
	}
};

/**
 * Check if ClamAV scanning is healthy
 */
export const getVirusScanningSatus = (): { enabled: boolean; status: string } => {
	if (!env.clamavEnabled) {
		return {
			enabled: false,
			status: "disabled"
		};
	}

	// If we haven't initialized yet or had an error, return pending
	if (!clamscan) {
		return {
			enabled: true,
			status: "pending"
		};
	}

	return {
		enabled: true,
		status: "healthy"
	};
};

/**
 * Check if a file should be blocked based on scan result
 */
export const isScanResultClean = (result: ScanResult | null): boolean => {
	// If scanning is disabled or unavailable, allow the file
	if (result === null) {
		return true;
	}

	// Block if infected
	return !result.isInfected;
};
