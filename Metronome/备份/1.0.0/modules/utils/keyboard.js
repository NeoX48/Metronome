/**
 * 键盘控制模块 - 处理节拍器的键盘输入
 * 
 * @module keyboard
 * @description 提供键盘快捷键支持，允许用户通过键盘控制节拍器
 */

import { getElement, addEventListenerSafe, removeEventListenerSafe } from './helpers.js';
import { toggleMetronome, setBPM, getBPM } from '../core/metronome.js';
import { getConfig } from './config.js';

/**
 * 键盘控制类
 */
class KeyboardController {
    constructor() {
        this.isEnabled = true;
        this.keyBindings = this._getDefaultKeyBindings();
        this._handleKeyDown = this._handleKeyDown.bind(this);
    }
    
    /**
     * 初始化键盘控制器
     * 
     * @example
     * // 初始化键盘控制
     * keyboardController.init();
     */
    init() {
        this.enable();
        console.log('键盘控制器已初始化');
    }
    
    /**
     * 启用键盘控制
     * 
     * @example
     * // 启用键盘控制
     * keyboardController.enable();
     */
    enable() {
        if (!this.isEnabled) {
            this.isEnabled = true;
            addEventListenerSafe(document, 'keydown', this._handleKeyDown);
        }
    }
    
    /**
     * 禁用键盘控制
     * 
     * @example
     * // 禁用键盘控制
     * keyboardController.disable();
     */
    disable() {
        if (this.isEnabled) {
            this.isEnabled = false;
            removeEventListenerSafe(document, 'keydown', this._handleKeyDown);
        }
    }
    
    /**
     * 切换键盘控制的启用状态
     * 
     * @returns {boolean} 切换后的状态
     * 
     * @example
     * // 切换键盘控制
     * const isEnabled = keyboardController.toggle();
     */
    toggle() {
        if (this.isEnabled) {
            this.disable();
        } else {
            this.enable();
        }
        return this.isEnabled;
    }
    
    /**
     * 获取默认的键盘绑定
     * @private
     * @returns {Object} 键盘绑定对象
     */
    _getDefaultKeyBindings() {
        return {
            'Space': this._toggleMetronome,
            '+': this._increaseBPM,
            '-': this._decreaseBPM,
            'ArrowUp': this._increaseBPM,
            'ArrowDown': this._decreaseBPM,
            '1': this._setBPM.bind(null, 60),
            '2': this._setBPM.bind(null, 120),
            '3': this._setBPM.bind(null, 180),
            'Escape': this._hideModals
        };
    }
    
    /**
     * 处理键盘按下事件
     * @private
     * @param {KeyboardEvent} event - 键盘事件
     */
    _handleKeyDown(event) {
        // 忽略在输入框中按下的键
        if (event.target.tagName === 'INPUT' || 
            event.target.tagName === 'TEXTAREA' ||
            event.target.isContentEditable) {
            return;
        }
        
        // 获取键名
        const keyName = this._getKeyName(event);
        
        // 查找并执行对应的绑定函数
        if (this.keyBindings[keyName]) {
            event.preventDefault();
            try {
                this.keyBindings[keyName].call(this);
            } catch (error) {
                console.error(`执行键盘绑定操作失败 (${keyName}):`, error);
            }
        }
    }
    
    /**
     * 获取规范化的键名
     * @private
     * @param {KeyboardEvent} event - 键盘事件
     * @returns {string} 键名
     */
    _getKeyName(event) {
        // 处理特殊键
        if (event.code === 'Space') return 'Space';
        if (event.code === 'Equal' && event.shiftKey) return '+';
        if (event.code === 'Minus') return '-';
        if (event.code.startsWith('Arrow')) return event.code;
        
        // 返回其他键的小写形式
        return event.key.toLowerCase();
    }
    
    /**
     * 切换节拍器
     * @private
     */
    _toggleMetronome() {
        try {
            toggleMetronome();
        } catch (error) {
            console.error('切换节拍器失败:', error);
        }
    }
    
    /**
     * 增加BPM
     * @private
     */
    _increaseBPM() {
        try {
            const currentBPM = getBPM();
            const newBPM = Math.min(currentBPM + 5, getConfig('maxBPM'));
            setBPM(newBPM);
        } catch (error) {
            console.error('增加BPM失败:', error);
        }
    }
    
    /**
     * 减少BPM
     * @private
     */
    _decreaseBPM() {
        try {
            const currentBPM = getBPM();
            const newBPM = Math.max(currentBPM - 5, getConfig('minBPM'));
            setBPM(newBPM);
        } catch (error) {
            console.error('减少BPM失败:', error);
        }
    }
    
    /**
     * 设置指定的BPM
     * @private
     * @param {number} bpm - 要设置的BPM值
     */
    _setBPM(bpm) {
        try {
            setBPM(bpm);
        } catch (error) {
            console.error(`设置BPM为${bpm}失败:`, error);
        }
    }
    
    /**
     * 隐藏所有模态窗口
     * @private
     */
    _hideModals() {
        try {
            // 查找并隐藏所有模态窗口
            const modals = document.querySelectorAll('.modal');
            modals.forEach(modal => {
                if (modal.style.display === 'block') {
                    modal.style.display = 'none';
                }
            });
        } catch (error) {
            console.error('隐藏模态窗口失败:', error);
        }
    }
    
    /**
     * 添加自定义键盘绑定
     * @param {string} key - 键名
     * @param {Function} handler - 处理函数
     * @returns {boolean} 是否添加成功
     * 
     * @example
     * // 添加自定义键盘绑定
     * keyboardController.addBinding('Enter', () => {
     *   console.log('Enter键被按下');
     * });
     */
    addBinding(key, handler) {
        try {
            if (typeof key !== 'string' || typeof handler !== 'function') {
                throw new Error('键名必须是字符串，处理函数必须是函数');
            }
            this.keyBindings[key] = handler;
            return true;
        } catch (error) {
            console.error('添加键盘绑定失败:', error);
            return false;
        }
    }
    
    /**
     * 移除键盘绑定
     * @param {string} key - 键名
     * @returns {boolean} 是否移除成功
     * 
     * @example
     * // 移除键盘绑定
     * keyboardController.removeBinding('Enter');
     */
    removeBinding(key) {
        try {
            if (this.keyBindings[key]) {
                delete this.keyBindings[key];
                return true;
            }
            return false;
        } catch (error) {
            console.error('移除键盘绑定失败:', error);
            return false;
        }
    }
    
    /**
     * 获取所有键盘绑定
     * @returns {Object} 键盘绑定对象的副本
     * 
     * @example
     * // 获取键盘绑定
     * const bindings = keyboardController.getKeyBindings();
     */
    getKeyBindings() {
        return { ...this.keyBindings };
    }
}

/**
 * 键盘控制器实例
 * @type {KeyboardController}
 */
export const keyboardController = new KeyboardController();

/**
 * 导出用于获取当前BPM的函数，供其他模块使用
 * @returns {number} 当前BPM值
 */
export function getCurrentBPM() {
    return getBPM();
}