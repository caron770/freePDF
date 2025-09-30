const DEFAULT_ENDPOINT = (import.meta as any).env?.VITE_SVG_CONVERTER_URL ?? 'http://localhost:4000/convert/svg';

export interface SvgConversionOptions {
  endpoint?: string;
  page?: number;
  exportPlain?: boolean;
  vacuumDefs?: boolean;
}

export async function convertPdfToSvg(
  pdfData: ArrayBuffer | Uint8Array,
  options: SvgConversionOptions = {}
): Promise<string> {
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT;
  const form = new FormData();
  const uint8 = pdfData instanceof Uint8Array ? pdfData : new Uint8Array(pdfData);
  const payloadView = new Uint8Array(uint8);
  const payload = payloadView.buffer.slice(payloadView.byteOffset, payloadView.byteOffset + payloadView.byteLength);
  form.append('file', new Blob([payload], { type: 'application/pdf' }), 'page.pdf');
  if (options.page) {
    form.append('page', String(options.page));
  }
  if (options.exportPlain === false) {
    form.append('exportPlain', 'false');
  }
  if (options.vacuumDefs === false) {
    form.append('vacuumDefs', 'false');
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    body: form,
  });

  if (!response.ok) {
    const message = await response.text().catch(() => response.statusText);
    throw new Error(`SVG conversion failed (${response.status}): ${message}`);
  }

  return response.text();
}
