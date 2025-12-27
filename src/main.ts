import "./style.css";

class GridApp {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private images: (HTMLImageElement | null)[] = new Array(9).fill(null);
	private taintedIndices = new Set<number>();

	private gridWidth = 900;
	private gridHeight = 1200;
	private cellWidth = 300;
	private cellHeight = 400;

	private fileInput: HTMLInputElement;
	private pendingCellIndex: number | null = null;

	constructor() {
		const canvas = document.getElementById("gridCanvas");
		if (!canvas || !(canvas instanceof HTMLCanvasElement)) {
			throw new Error("Canvas element not found");
		}
		this.canvas = canvas;
		const ctx = this.canvas.getContext("2d");
		if (!ctx) {
			throw new Error("Could not get canvas context");
		}
		this.ctx = ctx;

		this.fileInput = document.createElement("input");
		this.fileInput.type = "file";
		this.fileInput.accept = "image/*";
		this.fileInput.style.display = "none";
		document.body.appendChild(this.fileInput);

		this.init();
	}

	private init() {
		this.draw();
		this.setupEventListeners();
	}

	private setupEventListeners() {
		// Prevent default drag behaviors
		["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
			this.canvas.addEventListener(eventName, this.preventDefaults, false);
		});

		this.canvas.addEventListener("drop", this.handleDrop.bind(this), false);

		// Click to upload
		this.canvas.addEventListener("click", this.handleClick.bind(this), false);
		this.fileInput.addEventListener(
			"change",
			this.handleFileSelect.bind(this),
			false,
		);

		const downloadBtn = document.getElementById("downloadBtn");
		if (downloadBtn) {
			downloadBtn.addEventListener("click", this.downloadImage.bind(this));
		}
	}

	private preventDefaults(e: Event) {
		e.preventDefault();
		e.stopPropagation();
	}

	private handleClick(e: MouseEvent) {
		const { index } = this.getGridPosition(e.clientX, e.clientY);
		if (index >= 0 && index <= 8) {
			this.pendingCellIndex = index;
			this.fileInput.value = ""; // Reset so same file can be selected again
			this.fileInput.click();
		}
	}

	private async handleFileSelect(e: Event) {
		if (this.pendingCellIndex === null) return;

		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			const file = input.files[0];
			await this.loadImageFromFile(file, this.pendingCellIndex);
		}
		this.pendingCellIndex = null;
	}

	private getGridPosition(
		clientX: number,
		clientY: number,
	): { col: number; row: number; index: number } {
		const rect = this.canvas.getBoundingClientRect();
		const scaleX = this.canvas.width / rect.width;
		const scaleY = this.canvas.height / rect.height;

		const x = (clientX - rect.left) * scaleX;
		const y = (clientY - rect.top) * scaleY;

		const col = Math.floor(x / this.cellWidth);
		const row = Math.floor(y / this.cellHeight);
		const index = row * 3 + col;

		return { col, row, index };
	}

	private async handleDrop(e: DragEvent) {
		const dt = e.dataTransfer;
		if (!dt) return;

		const { index } = this.getGridPosition(e.clientX, e.clientY);

		if (index < 0 || index > 8) return;

		// Handle dropped files
		if (dt.files && dt.files.length > 0) {
			const file = dt.files[0];
			if (file.type.startsWith("image/")) {
				await this.loadImageFromFile(file, index);
			}
		}
		// Handle dropped URLs (e.g. from Google Images)
		else {
			const html = dt.getData("text/html");
			const uri = dt.getData("text/uri-list");
			const text = dt.getData("text/plain");

			let src = "";

			// Try to extract src from HTML (often richer)
			if (html) {
				const parser = new DOMParser();
				const doc = parser.parseFromString(html, "text/html");
				const img = doc.querySelector("img");
				if (img) src = img.src;
			}

			if (!src && uri) src = uri;
			if (
				!src &&
				text &&
				(text.startsWith("http") || text.startsWith("data:image"))
			)
				src = text;

			if (src) {
				await this.loadImageFromUrl(src, index);
			}
		}
	}

	private loadImageFromFile(file: File, index: number): Promise<void> {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (e) => {
				const img = new Image();
				img.onload = () => {
					this.setImage(index, img);
					// Local files don't taint canvas
					this.taintedIndices.delete(index);
					this.draw();
					resolve();
				};
				img.onerror = reject;
				img.src = e.target?.result as string;
			};
			reader.readAsDataURL(file);
		});
	}

	private async loadImageFromUrl(url: string, index: number): Promise<void> {
		// 1. Try direct with CORS
		try {
			await this.loadImage(url, index, true);
			this.taintedIndices.delete(index);
			return;
		} catch (_e) {
			console.log("Direct CORS failed, trying proxy...");
		}

		// 2. Try via Proxy (weserv.nl)
		try {
			// Weserv docs: ?url=example.com/image.jpg
			const proxyUrl = `https://images.weserv.nl/?url=${encodeURIComponent(url)}`;
			await this.loadImage(proxyUrl, index, true);
			this.taintedIndices.delete(index);
			return;
		} catch (_e) {
			console.log("Proxy failed, falling back to tainted mode...");
		}

		// 3. Fallback (Tainted)
		try {
			await this.loadImage(url, index, false);
			this.taintedIndices.add(index);
		} catch (e) {
			console.error("All loading attempts failed", e);
		}

		// Always redraw at the end
		this.draw();
	}

	private loadImage(
		src: string,
		index: number,
		useCors: boolean,
	): Promise<void> {
		return new Promise((resolve, reject) => {
			const img = new Image();
			if (useCors) img.crossOrigin = "anonymous";
			img.onload = () => {
				this.images[index] = img;
				resolve();
			};
			img.onerror = reject;
			img.src = src;
		});
	}

	private setImage(index: number, img: HTMLImageElement) {
		this.images[index] = img;
	}

	private draw() {
		// Background
		this.ctx.fillStyle = "#1a1b1e"; // Dark background
		this.ctx.fillRect(0, 0, this.gridWidth, this.gridHeight);

		// Draw images
		for (let i = 0; i < 9; i++) {
			const img = this.images[i];
			if (img) {
				const col = i % 3;
				const row = Math.floor(i / 3);
				const x = col * this.cellWidth;
				const y = row * this.cellHeight;

				// maintain aspect ratio to cover the square (center crop)
				this.drawImageProp(
					this.ctx,
					img,
					x,
					y,
					this.cellWidth,
					this.cellHeight,
				);

				// Draw warning if tainted
				if (this.taintedIndices.has(i)) {
					this.ctx.fillStyle = "rgba(255, 0, 0, 0.7)";
					this.ctx.fillRect(x + this.cellWidth - 40, y + 10, 30, 30);
					this.ctx.fillStyle = "#fff";
					this.ctx.font = "bold 24px Arial";
					this.ctx.textAlign = "center";
					this.ctx.textBaseline = "middle";
					this.ctx.fillText("!", x + this.cellWidth - 25, y + 25);
				}
			}
		}

		// Draw grid lines
		this.ctx.strokeStyle = "#ffffff";
		this.ctx.lineWidth = 4;
		this.ctx.beginPath();

		// Vertical lines
		for (let i = 1; i < 3; i++) {
			this.ctx.moveTo(i * this.cellWidth, 0);
			this.ctx.lineTo(i * this.cellWidth, this.gridHeight);
		}
		// Horizontal lines
		for (let i = 1; i < 3; i++) {
			this.ctx.moveTo(0, i * this.cellHeight);
			this.ctx.lineTo(this.gridWidth, i * this.cellHeight);
		}
		this.ctx.stroke();

		// Draw empty state text if no images
		if (this.images.every((img) => img === null)) {
			this.ctx.fillStyle = "#666";
			this.ctx.font = "30px Inter, sans-serif";
			this.ctx.textAlign = "center";
			this.ctx.textBaseline = "middle";
			for (let i = 0; i < 9; i++) {
				const col = i % 3;
				const row = Math.floor(i / 3);
				const x = col * this.cellWidth + this.cellWidth / 2;
				const y = row * this.cellHeight + this.cellHeight / 2;
				this.ctx.fillText(`Click/Drop`, x, y);
			}
		}
	}

	/**
	 * Helper to draw image cover (like CSS object-fit: cover)
	 */
	private drawImageProp(
		ctx: CanvasRenderingContext2D,
		img: HTMLImageElement,
		x: number,
		y: number,
		w: number,
		h: number,
	) {
		// Default offset is center
		let offsetX = 0.5;
		let offsetY = 0.5;

		// keep bounds [0.0, 1.0]
		if (offsetX < 0) offsetX = 0;
		if (offsetY < 0) offsetY = 0;
		if (offsetX > 1) offsetX = 1;
		if (offsetY > 1) offsetY = 1;

		let iw = img.width,
			ih = img.height,
			r = Math.min(w / iw, h / ih),
			nw = iw * r, // new prop. width
			nh = ih * r, // new prop. height
			cx: number,
			cy: number,
			cw: number,
			ch: number,
			ar = 1;

		// decide which gap to fill
		if (nw < w) ar = w / nw;
		if (Math.abs(ar - 1) < 1e-14 && nh < h) ar = h / nh; // updated
		nw *= ar;
		nh *= ar;

		// calc source rectangle
		cw = iw / (nw / w);
		ch = ih / (nh / h);

		cx = (iw - cw) * offsetX;
		cy = (ih - ch) * offsetY;

		// make sure source rectangle is valid
		if (cx < 0) cx = 0;
		if (cy < 0) cy = 0;
		if (cw > iw) cw = iw;
		if (ch > ih) ch = ih;

		ctx.drawImage(img, cx, cy, cw, ch, x, y, w, h);
	}

	private downloadImage() {
		if (this.taintedIndices.size > 0) {
			alert(`Cannot download: Images marked with '!' are protected by security policies (CORS). 
      
Please save these images to your computer first, then drag the file into the square.`);
			return;
		}

		try {
			const link = document.createElement("a");
			link.download = "3x3-grid.png";
			link.href = this.canvas.toDataURL("image/png");
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
		} catch (e) {
			alert(
				"Cannot download: One or more images may be protected by CORS policies.",
			);
			console.error(e);
		}
	}
}

new GridApp();
