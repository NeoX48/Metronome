/**
 * 辅助函数模块 - 提供通用的工具函数
 * 
 * @module helpers
 * @description 包含各种辅助函数，用于DOM操作、事件处理、数据验证等
 */

import { getConfig } from '../../modules/utils/config.js';

/**
 * 防抖函数 - 限制函数在一定时间内只能执行一次
 * @param {Function} func - 要防抖的函数
 * @param {number} wait - 等待时间（毫秒）
 * @returns {Function} 防抖后的函数
 * 
 * @example
 * // 创建一个防抖的搜索函数
 * const debouncedSearch = debounce((query) => {
 *   console.log('搜索:', query);
 * }, 300);
 * 
 * // 在输入框事件中使用
 * input.addEventListener('input', (e) => debouncedSearch(e.target.value));
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * 节流函数 - 限制函数在一定时间内的执行频率
 * @param {Function} func - 要节流的函数
 * @param {number} limit - 时间限制（毫秒）
 * @returns {Function} 节流后的函数
 * 
 * @example
 * // 创建一个节流的滚动处理函数
 * const throttledScroll = throttle(() => {
 *   console.log('滚动事件处理');
 * }, 200);
 * 
 * // 在滚动事件中使用
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle(func, limit) {
    let inThrottle;
    return function(...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * 格式化BPM值，确保显示为整数
 * @param {number} bpm - BPM值
 * @returns {number} 格式化后的BPM值
 * 
 * @example
 * const formattedBPM = formatBPM(120.5); // 返回 121
 */
export function formatBPM(bpm) {
    return Math.round(Number(bpm) || 0);
}

/**
 * 验证BPM值是否在有效范围内
 * @param {number} bpm - BPM值
 * @returns {boolean} 是否有效
 * 
 * @example
 * const isValid = isValidBPM(150); // 返回 true
 * const isInvalid = isValidBPM(300); // 返回 false
 */
export function isValidBPM(bpm) {
    const minBPM = getConfig('minBPM');
    const maxBPM = getConfig('maxBPM');
    return typeof bpm === 'number' && bpm >= minBPM && bpm <= maxBPM;
}

/**
 * 验证拍号是否有效
 * @param {number} numerator - 拍号分子
 * @param {number} denominator - 拍号分母
 * @returns {boolean} 是否有效
 * 
 * @example
 * const isValid = isValidTimeSignature(3, 4); // 返回 true
 * const isInvalid = isValidTimeSignature(5, 3); // 返回 false
 */
export function isValidTimeSignature(numerator, denominator) {
    const minNumerator = getConfig('minBeatNumerator');
    const maxNumerator = getConfig('maxBeatNumerator');
    const validDenominators = getConfig('validDenominators');
    
    return typeof numerator === 'number' && 
           typeof denominator === 'number' &&
           numerator >= minNumerator && 
           numerator <= maxNumerator &&
           validDenominators.includes(denominator);
}

/**
 * 生成拍号的音符图标
 * @param {number} denominator - 拍号分母
 * @returns {string} 音符图标
 * 
 * @example
 * const icon = getNoteIcon(4); // 返回 '𝅘𝅥'
 */
export function getNoteIcon(denominator) {
    const icons = {
        1: '𝅝',
        2: '𝅗𝅥',
        4: '𝅘𝅥',
        8: '𝅘𝅥𝅮',
        16: '𝅘𝅥𝅯'
    };
    return icons[denominator] || '𝅘𝅥';
}

/**
 * 安全地获取DOM元素
 * @param {string} selector - CSS选择器
 * @param {HTMLElement} parent - 父元素，默认为document
 * @returns {HTMLElement|null} DOM元素或null
 * 
 * @example
 * const element = getElement('#bpm-value');
 */
export function getElement(selector, parent = document) {
    try {
        return parent.querySelector(selector);
    } catch (error) {
        console.error('获取元素失败:', error);
        return null;
    }
}

/**
 * 安全地获取多个DOM元素
 * @param {string} selector - CSS选择器
 * @param {HTMLElement} parent - 父元素，默认为document
 * @returns {NodeList} 元素列表
 * 
 * @example
 * const elements = getElements('.beat-dot');
 */
export function getElements(selector, parent = document) {
    try {
        return parent.querySelectorAll(selector);
    } catch (error) {
        console.error('获取元素列表失败:', error);
        return [];
    }
}

/**
 * 添加事件监听器，并提供错误处理
 * @param {HTMLElement|Window|Document} element - 目标元素
 * @param {string} event - 事件名称
 * @param {Function} handler - 事件处理函数
 * @param {Object} options - 事件选项
 * @returns {boolean} 是否添加成功
 * 
 * @example
 * addEventListenerSafe(button, 'click', () => {
 *   console.log('按钮被点击');
 * });
 */
export function addEventListenerSafe(element, event, handler, options = {}) {
    try {
        if (!element || typeof element.addEventListener !== 'function') {
            return false;
        }
        
        // 包装处理函数以捕获错误
        const safeHandler = (e) => {
            try {
                return handler(e);
            } catch (error) {
                console.error(`事件处理错误 (${event}):`, error);
            }
        };
        
        element.addEventListener(event, safeHandler, options);
        
        // 存储原始处理函数的引用，便于后续移除
        safeHandler.originalHandler = handler;
        
        return true;
    } catch (error) {
        console.error('添加事件监听器失败:', error);
        return false;
    }
}

/**
 * 移除事件监听器
 * @param {HTMLElement|Window|Document} element - 目标元素
 * @param {string} event - 事件名称
 * @param {Function} handler - 原始事件处理函数
 * @param {Object} options - 事件选项
 * @returns {boolean} 是否移除成功
 * 
 * @example
 * // 先添加事件监听器
 * const handler = () => console.log('点击');
 * addEventListenerSafe(button, 'click', handler);
 * 
 * // 然后移除
 * removeEventListenerSafe(button, 'click', handler);
 */
export function removeEventListenerSafe(element, event, handler, options = {}) {
    try {
        if (!element || typeof element.removeEventListener !== 'function') {
            return false;
        }
        
        // 尝试直接移除原始处理函数
        element.removeEventListener(event, handler, options);
        return true;
    } catch (error) {
        console.error('移除事件监听器失败:', error);
        return false;
    }
}

/**
 * 安全地设置元素的文本内容
 * @param {HTMLElement} element - 目标元素
 * @param {string} text - 要设置的文本
 * @returns {boolean} 是否设置成功
 * 
 * @example
 * setText(element, '新的文本内容');
 */
export function setText(element, text) {
    try {
        if (!element || !('textContent' in element)) {
            return false;
        }
        element.textContent = text;
        return true;
    } catch (error) {
        console.error('设置文本内容失败:', error);
        return false;
    }
}

/**
 * 安全地切换元素的CSS类
 * @param {HTMLElement} element - 目标元素
 * @param {string} className - 类名
 * @param {boolean} force - 可选，强制添加或移除
 * @returns {boolean} 操作是否成功
 * 
 * @example
 * toggleClass(element, 'active'); // 切换类
 * toggleClass(element, 'visible', true); // 强制添加类
 */
export function toggleClass(element, className, force) {
    try {
        if (!element || !('classList' in element)) {
            return false;
        }
        
        if (force === undefined) {
            element.classList.toggle(className);
        } else {
            element.classList.toggle(className, force);
        }
        return true;
    } catch (error) {
        console.error('切换CSS类失败:', error);
        return false;
    }
}

/**
 * 安全地显示元素
 * @param {HTMLElement} element - 目标元素
 * @returns {boolean} 是否显示成功
 * 
 * @example
 * showElement(element);
 */
export function showElement(element) {
    try {
        if (!element || !('style' in element)) {
            return false;
        }
        element.style.display = '';
        return true;
    } catch (error) {
        console.error('显示元素失败:', error);
        return false;
    }
}

/**
 * 安全地隐藏元素
 * @param {HTMLElement} element - 目标元素
 * @returns {boolean} 是否隐藏成功
 * 
 * @example
 * hideElement(element);
 */
export function hideElement(element) {
    try {
        if (!element || !('style' in element)) {
            return false;
        }
        element.style.display = 'none';
        return true;
    } catch (error) {
        console.error('隐藏元素失败:', error);
        return false;
    }
}

/**
 * 创建自定义事件并触发
 * @param {string} eventName - 事件名称
 * @param {Object} detail - 事件详情
 * @param {EventTarget} target - 触发事件的目标，默认为window
 * @returns {boolean} 是否触发成功
 * 
 * @example
 * triggerCustomEvent('metronome:started', { bpm: 120 });
 */
export function triggerCustomEvent(eventName, detail = {}, target = window) {
    try {
        const event = new CustomEvent(eventName, { detail });
        return target.dispatchEvent(event);
    } catch (error) {
        console.error('触发自定义事件失败:', error);
        return false;
    }
}