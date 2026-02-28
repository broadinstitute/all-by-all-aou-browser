/**
 * Manhattan Plot Export Utility
 *
 * Exports the Manhattan plot as a high-resolution PNG image,
 * preserving the underlying images, custom label positions, and thresholds.
 */

/**
 * Export a Manhattan plot container as a PNG image.
 *
 * @param container - The DOM element containing the plot (images + SVG overlays)
 * @param filename - The desired filename for the download
 */
export async function exportManhattanPlot(
  container: HTMLElement,
  filename: string = 'manhattan-plot.png'
): Promise<void> {
  // Get all image elements in the container
  const images = container.querySelectorAll('img');
  const svgs = container.querySelectorAll('svg');

  if (images.length === 0) {
    throw new Error('No images found in the container');
  }

  // Use the first image to determine dimensions
  const baseImage = images[0] as HTMLImageElement;
  const rect = baseImage.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();

  // Create a canvas at 2x resolution for high quality
  const scale = 2;
  const width = containerRect.width;
  const height = containerRect.height;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Scale up for high resolution
  ctx.scale(scale, scale);

  // Fill background with white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Draw each image in order, respecting their positions and opacity
  for (const img of Array.from(images)) {
    const imgRect = img.getBoundingClientRect();
    const x = imgRect.left - containerRect.left;
    const y = imgRect.top - containerRect.top;

    // Get computed opacity
    const computedStyle = window.getComputedStyle(img);
    const opacity = parseFloat(computedStyle.opacity) || 1;

    ctx.globalAlpha = opacity;
    try {
      ctx.drawImage(img, x, y, imgRect.width, imgRect.height);
    } catch (err) {
      console.warn('Failed to draw image, may be cross-origin:', err);
    }
    ctx.globalAlpha = 1;
  }

  // Draw each SVG overlay
  for (const svg of Array.from(svgs)) {
    const svgRect = svg.getBoundingClientRect();
    const x = svgRect.left - containerRect.left;
    const y = svgRect.top - containerRect.top;

    try {
      // Clone the SVG and add necessary styles inline
      const svgClone = svg.cloneNode(true) as SVGSVGElement;

      // Add inline styles for proper rendering
      addInlineStyles(svgClone);

      // Serialize to string
      const svgString = new XMLSerializer().serializeToString(svgClone);

      // Create a data URI
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(svgBlob);

      // Load as image and draw to canvas
      const svgImage = await loadImage(url);
      ctx.drawImage(svgImage, x, y, svgRect.width, svgRect.height);

      URL.revokeObjectURL(url);
    } catch (err) {
      console.warn('Failed to render SVG:', err);
    }
  }

  // Convert canvas to blob and trigger download
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/png');
  });

  if (!blob) {
    throw new Error('Failed to create PNG blob');
  }

  // Trigger download
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(downloadUrl);
}

/**
 * Load an image from a URL and return a promise.
 */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Add inline styles to an SVG for proper rendering in canvas.
 * This embeds the essential CSS styles that won't be available in the exported image.
 */
function addInlineStyles(svg: SVGSVGElement): void {
  // Default styles for Manhattan plot elements
  const styleRules = `
    .manhattan-peak-line {
      stroke: #888;
      stroke-width: 1;
      fill: none;
    }
    .manhattan-peak-line-hovered {
      stroke: #333;
      stroke-width: 1.5;
    }
    .manhattan-peak-dot {
      fill: #262262;
      stroke: none;
    }
    .manhattan-peak-dot-hovered {
      fill: #1a1a4e;
      stroke: #fff;
      stroke-width: 1;
    }
    .manhattan-peak-label {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10px;
      fill: #333;
    }
    .manhattan-peak-label-hovered {
      fill: #000;
      font-weight: 600;
    }
    .manhattan-peak-label-burden {
      fill: #262262;
    }
  `;

  // Create a style element and add it to the SVG
  const styleElement = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  styleElement.textContent = styleRules;
  svg.insertBefore(styleElement, svg.firstChild);

  // Also apply computed styles directly to elements for better compatibility
  const textElements = svg.querySelectorAll('text');
  textElements.forEach((text) => {
    const computedStyle = window.getComputedStyle(text);
    text.setAttribute('font-family', computedStyle.fontFamily || 'sans-serif');
    text.setAttribute('font-size', computedStyle.fontSize || '10px');
    if (!text.getAttribute('fill')) {
      text.setAttribute('fill', computedStyle.fill || '#333');
    }
  });

  const lineElements = svg.querySelectorAll('line, path');
  lineElements.forEach((line) => {
    const computedStyle = window.getComputedStyle(line);
    if (!line.getAttribute('stroke')) {
      line.setAttribute('stroke', computedStyle.stroke || '#888');
    }
  });

  const circleElements = svg.querySelectorAll('circle');
  circleElements.forEach((circle) => {
    const computedStyle = window.getComputedStyle(circle);
    if (!circle.getAttribute('fill')) {
      circle.setAttribute('fill', computedStyle.fill || '#262262');
    }
  });
}
