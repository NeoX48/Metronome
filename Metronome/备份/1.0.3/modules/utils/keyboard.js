/**
 * 键盘控制模块 - 处理节拍器的键盘输入
 * @module keyboard
 * @description 提供键盘快捷键支持，允许用户通过键盘控制节拍器
 */
import { getElement, addEventListenerSafe, removeEventListenerSafe } from './helpers.js';
import { toggleMetronome, setBPM, getBPM } from '../core/metronome.js';
import { getConfig } from './config.js';
import { eventLockManager } from './eventLock.js';

/**
 * 键盘控制类 - 管理节拍器的键盘快捷键映射与事件处理
 */
class KeyboardController {
  constructor() {
    this.isEnabled = false; // 默认禁用，通过init方法启用
    this.keyBindings = this._getDefaultKeyBindings();
    this._handleKeyDown = this._handleKeyDown.bind(this);
  }

  /**
   * 初始化键盘控制器
   */
  init() {
    if (this.isEnabled) {
      console.warn('⚠️ [keyboard.js] 键盘控制器已经初始化');
      return;
    }
    this.enable();
    console.log('✅ [keyboard.js] 键盘控制器已初始化');
  }

  /**
   * 启用键盘控制（添加事件监听）
   */
  enable() {
    if (this.isEnabled) {
      console.warn('⚠️ [keyboard.js] 键盘控制器已经启用');
      return;
    }

    this.isEnabled = true;
    addEventListenerSafe(document, 'keydown', this._handleKeyDown);
    console.log('✅ [keyboard.js] 键盘事件监听器已添加');
  }

  /**
   * 禁用键盘控制（移除事件监听）
   */
  disable() {
    if (!this.isEnabled) {
      console.warn('⚠️ [keyboard.js] 键盘控制器已经禁用');
      return;
    }

    this.isEnabled = false;
    removeEventListenerSafe(document, 'keydown', this._handleKeyDown);
    console.log('✅ [keyboard.js] 键盘事件监听器已移除');
  }

  /**
   * 切换键盘控制的启用状态
   * @returns {boolean} 切换后的启用状态
   */
  toggle() {
    this.isEnabled ? this.disable() : this.enable();
    return this.isEnabled;
  }

  /**
   * 获取默认的键盘绑定配置
   * @private
   * @returns {Object} 键名到处理函数的映射
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
      'Escape': this._hideModals,
      't': this._tapTempo // TAP 快捷键
    };
  }

  /**
   * 处理键盘按下事件
   * @private
   * @param {KeyboardEvent} event - 键盘事件对象
   */
  _handleKeyDown(event) {
    // 忽略长按重复触发的事件
    if (event.repeat) {
      console.log('🔄 [keyboard.js] 忽略重复事件');
      return;
    }

    // 忽略输入框/编辑区域内的按键
    if (
      event.target.tagName === 'INPUT' ||
      event.target.tagName === 'TEXTAREA' ||
      event.target.isContentEditable
    ) {
      return;
    }

    const keyName = this._getKeyName(event);
    console.log('⌨️ [keyboard.js] 按键:', keyName);

    // 执行绑定的处理函数
    if (this.keyBindings[keyName]) {
      event.preventDefault();
      console.log('✅ [keyboard.js] 执行绑定函数:', keyName);
      try {
        this.keyBindings[keyName].call(this);
      } catch (error) {
        console.error(`❌ [keyboard.js] 执行键盘绑定操作失败 (${keyName}):`, error);
      }
    }
  }

  /**
   * 规范化键名（统一特殊键和普通键的命名格式）
   * @private
   * @param {KeyboardEvent} event - 键盘事件对象
   * @returns {string} 规范化的键名
   */
  _getKeyName(event) {
    // 处理特殊键
    if (event.code === 'Space') return 'Space';
    if (event.code === 'Equal' && event.shiftKey) return '+';
    if (event.code === 'Minus') return '-';
    if (event.code.startsWith('Arrow')) return event.code;

    // 普通键转为小写
    return event.key.toLowerCase();
  }

  /**
   * 切换节拍器启停状态
   * @private
   */
  _toggleMetronome() {
    try {
      // 使用事件锁防止短时间内重复触发
      if (!eventLockManager.tryLock('toggle-metronome', 300)) {
        return;
      }
      console.log('🎵 [keyboard.js] 调用 toggleMetronome');
      toggleMetronome();
    } catch (error) {
      console.error('❌ [keyboard.js] 切换节拍器失败:', error);
    }
  }

  /**
   * 增加BPM（每次+5，不超过最大值）
   * @private
   */
  _increaseBPM() {
    try {
      const currentBPM = getBPM();
      const newBPM = Math.min(currentBPM + 5, getConfig('maxBPM'));
      setBPM(newBPM);
    } catch (error) {
      console.error('❌ [keyboard.js] 增加BPM失败:', error);
    }
  }

  /**
   * 减少BPM（每次-5，不低于最小值）
   * @private
   */
  _decreaseBPM() {
    try {
      const currentBPM = getBPM();
      const newBPM = Math.max(currentBPM - 5, getConfig('minBPM'));
      setBPM(newBPM);
    } catch (error) {
      console.error('❌ [keyboard.js] 减少BPM失败:', error);
    }
  }

  /**
   * 设置指定的BPM值
   * @private
   * @param {number} bpm - 目标BPM值
   */
  _setBPM(bpm) {
    try {
      setBPM(bpm);
    } catch (error) {
      console.error(`❌ [keyboard.js] 设置BPM为${bpm}失败:`, error);
    }
  }

  /**
   * 隐藏所有模态窗口
   * @private
   */
  _hideModals() {
    try {
      const modals = document.querySelectorAll('.modal');
      modals.forEach(modal => {
        if (modal.style.display === 'block') {
          modal.style.display = 'none';
        }
      });
    } catch (error) {
      console.error('❌ [keyboard.js] 隐藏模态窗口失败:', error);
    }
  }

  /**
   * 触发TAP节拍检测（通过全局事件交由UI处理）
   * @private
   */
  _tapTempo() {
    try {
      window.dispatchEvent(new CustomEvent('metronome:tap', {
        detail: { time: Date.now() },
        bubbles: true,
        cancelable: true
      }));
    } catch (error) {
      console.error('❌ [keyboard.js] TAP 快捷键失败:', error);
    }
  }

  /**
   * 添加自定义键盘绑定
   * @param {string} key - 键名（需符合_getKeyName规范化格式）
   * @param {Function} handler - 按键处理函数
   * @returns {boolean} 添加成功返回true，否则返回false
   */
  addBinding(key, handler) {
    try {
      if (typeof key !== 'string' || typeof handler !== 'function') {
        throw new Error('键名必须是字符串，处理函数必须是函数');
      }
      this.keyBindings[key] = handler;
      return true;
    } catch (error) {
      console.error('❌ [keyboard.js] 添加键盘绑定失败:', error);
      return false;
    }
  }

  /**
   * 移除指定的键盘绑定
   * @param {string} key - 键名
   * @returns {boolean} 移除成功返回true，无对应绑定返回false
   */
  removeBinding(key) {
    try {
      if (this.keyBindings[key]) {
        delete this.keyBindings[key];
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ [keyboard.js] 移除键盘绑定失败:', error);
      return false;
    }
  }

  /**
   * 获取所有当前的键盘绑定
   * @returns {Object} 键名到处理函数的映射副本（防止外部直接修改）
   */
  getKeyBindings() {
    return { ...this.keyBindings };
  }
}

/**
 * 键盘控制器实例 - 单例模式对外提供服务
 */
export const keyboardController = new KeyboardController();

/**
 * 导出获取当前BPM的函数（代理metronome模块的getBPM）
 * @returns {number} 当前BPM值
 */
export function getCurrentBPM() {
  return getBPM();
}