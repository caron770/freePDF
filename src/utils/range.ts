/**
 * 解析页码表达式，支持格式：
 * - 单页：1, 3, 5
 * - 范围：1-5, 3-8
 * - 开放范围：5-, -10
 * - 混合：1,3,5-8,10-
 */
export function parsePageExpr(expr: string, maxPage: number): number[] {
  if (!expr.trim()) return [];
  
  const result = new Set<number>();
  
  const parts = expr.split(',').map(s => s.trim()).filter(Boolean);
  
  for (const part of parts) {
    if (part.includes('-')) {
      // 范围表达式
      const [startStr, endStr] = part.split('-').map(s => s.trim());
      
      const start = startStr ? parseInt(startStr, 10) : 1;
      const end = endStr ? parseInt(endStr, 10) : maxPage;
      
      if (isNaN(start) || isNaN(end)) continue;
      
      for (let i = Math.max(1, start); i <= Math.min(maxPage, end); i++) {
        result.add(i);
      }
    } else {
      // 单页
      const page = parseInt(part, 10);
      if (!isNaN(page) && page >= 1 && page <= maxPage) {
        result.add(page);
      }
    }
  }
  
  return Array.from(result).sort((a, b) => a - b);
}

/**
 * 将1基页码数组转换为0基索引数组
 */
export function pages1ToIndices0(pages1: number[]): number[] {
  return pages1.map(p => p - 1);
}

/**
 * 将0基索引数组转换为1基页码数组
 */
export function indices0ToPages1(indices: number[]): number[] {
  return indices.map(i => i + 1);
}

/**
 * 验证页码表达式语法
 */
export function validatePageExpr(expr: string, maxPage: number): { valid: boolean; error?: string } {
  if (!expr.trim()) {
    return { valid: false, error: '页码表达式不能为空' };
  }
  
  try {
    const pages = parsePageExpr(expr, maxPage);
    if (pages.length === 0) {
      return { valid: false, error: '没有找到有效的页码' };
    }
    return { valid: true };
  } catch (error) {
    return { valid: false, error: '页码表达式格式错误' };
  }
}

/**
 * 格式化页码数组为可读字符串
 */
export function formatPageRange(pages: number[]): string {
  if (pages.length === 0) return '';
  
  const sorted = [...pages].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      if (start === end) {
        ranges.push(start.toString());
      } else if (end === start + 1) {
        ranges.push(`${start},${end}`);
      } else {
        ranges.push(`${start}-${end}`);
      }
      start = end = sorted[i];
    }
  }
  
  // 添加最后一个范围
  if (start === end) {
    ranges.push(start.toString());
  } else if (end === start + 1) {
    ranges.push(`${start},${end}`);
  } else {
    ranges.push(`${start}-${end}`);
  }
  
  return ranges.join(',');
}