/** 
 * 数值范围限定器 polyfill 
 */ 
if (!Math.clamp) { 
  Math.clamp = function(value, min, max) { 
    return Math.min(Math.max(value, min), max); // 使用 Math 而不是 this
  }; 
} 

/** 
 * 数值范围限定器 
 * @param {number} value - 输入值 
 * @param {number} min - 最小值 
 * @param {number} max - 最大值 
 * @returns {number} 限定后的值 
 */ 
export function clamp(value, min, max) { 
  return Math.clamp(value, min, max); 
}
