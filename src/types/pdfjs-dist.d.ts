declare module 'pdfjs-dist/legacy/build/pdf' {
  export const GlobalWorkerOptions: any;
  export function getDocument(params: any): any;
  export class SVGGraphics {
    constructor(commonObjs: any, objs: any);
    embedFonts: boolean;
    getSVG(opList: any, viewport: any): Promise<any>;
  }
  const pdfjs: any;
  export default pdfjs;
}

declare module 'pdfjs-dist/legacy/build/pdf.js' {
  export const GlobalWorkerOptions: any;
  export function getDocument(params: any): any;
  export class SVGGraphics {
    constructor(commonObjs: any, objs: any);
    embedFonts: boolean;
    getSVG(opList: any, viewport: any): Promise<any>;
  }
  const pdfjs: any;
  export default pdfjs;
}

declare module 'pdfjs-dist/build/pdf.js' {
  export const GlobalWorkerOptions: any;
  export function getDocument(params: any): any;
  export class SVGGraphics {
    constructor(commonObjs: any, objs: any);
    embedFonts: boolean;
    getSVG(opList: any, viewport: any): Promise<any>;
  }
  const pdfjs: any;
  export default pdfjs;
}
