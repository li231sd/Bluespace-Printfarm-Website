declare module "clamav.js" {
	class NodeClam {
		init(options: {
			clamdscan?: {
				host?: string;
				port?: number;
			};
		}): Promise<NodeClam>;
		scanFile(filePath: string): Promise<{
			isInfected: boolean;
			viruses?: string[];
		}>;
	}

	export default NodeClam;
}
