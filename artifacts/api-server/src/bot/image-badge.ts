import { createCanvas, loadImage } from "@napi-rs/canvas";

/**
 * Fetches a remote image and overlays a numbered badge in the top-left corner.
 * Returns a PNG Buffer ready to be sent as a Discord attachment.
 */
export async function addNumberBadge(imageUrl: string, number: number): Promise<Buffer> {
  const img = await loadImage(imageUrl);

  const canvas = createCanvas(img.width, img.height);
  const ctx = canvas.getContext("2d");

  // Draw the original image
  ctx.drawImage(img, 0, 0);

  // Badge config
  const badgeRadius = Math.round(Math.min(img.width, img.height) * 0.1);
  const margin = Math.round(badgeRadius * 0.5);
  const cx = margin + badgeRadius;
  const cy = margin + badgeRadius;
  const fontSize = Math.round(badgeRadius * 1.1);

  // Shadow for visibility
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 8;

  // Circle background
  ctx.beginPath();
  ctx.arc(cx, cy, badgeRadius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(20, 20, 20, 0.82)";
  ctx.fill();

  ctx.shadowBlur = 0;

  // Circle border
  ctx.lineWidth = Math.round(badgeRadius * 0.12);
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();

  // Number text
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(number), cx, cy);

  return canvas.toBuffer("image/png");
}
