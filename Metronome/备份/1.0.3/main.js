/**
 * 节拍器应用 - 主入口文件
 * 
 * @file main.js
 * @description 整合所有模块并初始化节拍器应用
 */

// 导入错误处理模块
import { errorHandler, handleAudioError, handleUIError, handleTrainingError, handleConfigError } from './modules/utils/errorManager.js';

// 导入核心模块
import { initMetronome, stopMetronome } from './modules/core/metronome.js';
import { initTrainingMode } from './modules/training/trainingCore.js';
import { uiController } from './modules/ui/controls.js';
import { trainingUIController } from './modules/training/trainingUI.js';
import { keyboardController } from './modules/utils/keyboard.js';

/**
 * 应用初始化函数
 * @async
 */
async function initializeApp() {
    try {
        console.log('开始初始化节拍器应用...');
        
        // 注册全局错误订阅者
        registerErrorSubscribers();
        console.log('全局错误订阅者注册完成');
        
        // 1. 初始化核心节拍器功能
        await initMetronome().catch(error => handleAudioError(error, { context: '初始化核心节拍器' }));
        console.log('核心节拍器模块初始化完成');
        
        // 2. 初始化UI控制器
        await uiController.init().catch(error => handleUIError(error, { context: '初始化UI控制器' }));
        console.log('UI控制器初始化完成');
        
        // 3. 初始化训练模式核心逻辑
        try {
            initTrainingMode();
            console.log('训练模式核心逻辑初始化完成');
        } catch (error) {
            handleTrainingError(error, { context: '初始化训练模式' });
        }
        
        // 4. 初始化训练模式UI
        await trainingUIController.init().catch(error => handleUIError(error, { context: '初始化训练UI' }));
        console.log('训练模式UI初始化完成');
        
        // 5. 初始化键盘控制器
        try {
            keyboardController.init();
            console.log('键盘控制器初始化完成');
        } catch (error) {
            handleUIError(error, { context: '初始化键盘控制' });
        }
        
        // 6. 加载应用配置
        const config = await loadAppConfig().catch(error => handleConfigError(error, { context: '加载应用配置' }));
        console.log('应用配置加载完成');
        
        // 7. 绑定全局事件
        bindGlobalEvents();
        console.log('全局事件绑定完成');
        
        // 应用初始化完成
        console.log('节拍器应用初始化完成！');
        
        // 通知应用已完全初始化
        window.dispatchEvent(new CustomEvent('app:initialized'));
        
        // 显示初始化成功消息（可选）
        if (window.location.search.includes('debug=true')) {
            console.log('%c节拍器应用初始化成功', 'color: green; font-weight: bold;');
        }
        
    } catch (error) {
        console.error('初始化节拍器应用失败:', error);
        // 创建标准错误对象并显示错误消息
        const errorMessage = `应用初始化失败: ${error.message || '未知错误'}`;
        console.error('应用错误:', error);
        showErrorMessage(errorMessage);
    }
}

/**
 * 注册错误订阅者
 */
function registerErrorSubscribers() {
    try {
        // 订阅错误事件并记录到控制台
        errorHandler.addListener((error) => {
            console.group('应用错误监控');
            console.log('错误类型:', error.type);
            console.log('错误级别:', error.level);
            console.log('错误消息:', error.message);
            console.log('错误时间:', new Date(error.timestamp).toLocaleString());
            console.groupEnd();
        });
        
        // 初始化全局错误处理器（已在errorHandler模块中完成）
        
    } catch (e) {
        console.error('注册错误订阅者失败:', e);
    }
}

/**
 * 显示错误消息
 * @param {string} message - 错误消息
 */
function showErrorMessage(message) {
    try {
        // 创建错误消息元素
        const errorContainer = document.createElement('div');
        errorContainer.className = 'error-message';
        errorContainer.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background-color: #f44336;
            color: white;
            padding: 15px 25px;
            border-radius: 5px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            font-family: Arial, sans-serif;
            font-size: 16px;
            max-width: 80%;
            text-align: center;
        `;
        
        errorContainer.textContent = message;
        
        // 添加关闭按钮
        const closeButton = document.createElement('button');
        closeButton.textContent = '×';
        closeButton.style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 24px;
            position: absolute;
            right: 10px;
            top: 50%;
            transform: translateY(-50%);
            cursor: pointer;
            padding: 0;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        closeButton.addEventListener('click', () => {
            try {
                if (document.body.contains(errorContainer)) {
                    document.body.removeChild(errorContainer);
                }
            } catch (e) {
                console.error('移除错误消息失败:', e);
            }
        });
        
        errorContainer.appendChild(closeButton);
        
        // 安全地添加到DOM
        if (document.body) {
            document.body.appendChild(errorContainer);
            
            // 30秒后自动移除
            setTimeout(() => {
                try {
                    if (document.body.contains(errorContainer)) {
                        document.body.removeChild(errorContainer);
                    }
                } catch (e) {
                    console.error('移除错误消息失败:', e);
                }
            }, 30000);
        }
        
    } catch (e) {
        console.error('显示错误消息失败:', e);
        // 降级到alert
        try {
            alert(message);
        } catch (e2) {
            // 忽略所有错误
        }
    }
}

/**
 * 注册全局错误处理
 */
function registerGlobalErrorHandlers() {
    // 这些已经在errorHandler模块中实现
    console.log('全局错误处理已由errorHandler模块管理');
}

/**
 * 绑定全局事件
 */
function bindGlobalEvents() {
    try {
        // 窗口聚焦时恢复UI状态
        window.addEventListener('focus', () => {
            try {
                if (uiController && typeof uiController.syncUI === 'function') {
                    uiController.syncUI();
                }
            } catch (e) {
                handleUIError(e, { context: '窗口聚焦同步UI' });
            }
        });
        
        // 页面可见性变化事件处理
        document.addEventListener('visibilitychange', () => {
            try {
                if (!document.hidden && uiController && typeof uiController.syncUI === 'function') {
                    uiController.syncUI();
                }
            } catch (e) {
                handleUIError(e, { context: '页面可见性变化处理' });
            }
        });
        
        // 窗口调整大小时更新UI
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                try {
                    if (uiController && typeof uiController.updateLayout === 'function') {
                        uiController.updateLayout();
                    }
                    if (trainingUIController && typeof trainingUIController.updateLayout === 'function') {
                        trainingUIController.updateLayout();
                    }
                } catch (e) {
                    handleUIError(e, { context: '窗口调整更新布局' });
                }
            }, 100); // 节流处理
        });
        
    } catch (e) {
        console.error('绑定全局事件失败:', e);
    }
}

/**
 * 应用配置加载函数
 * @returns {Promise<Object>}
 */
async function loadAppConfig() {
    try {
        // 从localStorage加载配置
        const savedConfig = localStorage.getItem('metronomeConfig');
        if (savedConfig) {
            try {
                return JSON.parse(savedConfig);
            } catch (e) {
                handleConfigError(e, { context: '解析配置JSON' });
                // 返回空配置，使用默认值
                return {};
            }
        }
        return {};
    } catch (error) {
        handleConfigError(error, { context: '加载配置' });
        return {};
    }
}

/**
 * 应用配置保存函数
 * @param {Object} config - 配置对象
 */
function saveAppConfig(config) {
    try {
        localStorage.setItem('metronomeConfig', JSON.stringify(config));
    } catch (error) {
        handleConfigError(error, { context: '保存配置' });
    }
}

/**
 * 处理页面卸载
 */
function handlePageUnload() {
    try {
        console.log('页面即将卸载，清理资源...');
        
        // 停止节拍器
        if (stopMetronome) {
            try {
                stopMetronome();
            } catch (e) {
                console.error('停止节拍器失败:', e);
            }
        }
        
        // 清理其他资源
        // 取消订阅错误处理
        // 移除事件监听器等
        
    } catch (error) {
        console.error('页面卸载处理失败:', error);
    }
}

/**
 * 性能监控函数
 */
function setupPerformanceMonitoring() {
    try {
        if ('performance' in window && 'mark' in window.performance) {
            // 标记应用启动
            performance.mark('app-start');
            
            // 应用加载完成后测量启动时间
            window.addEventListener('load', () => {
                performance.mark('app-loaded');
                performance.measure('app-startup', 'app-start', 'app-loaded');
                
                const measures = performance.getEntriesByName('app-startup');
                if (measures.length > 0) {
                    const startupTime = measures[0].duration;
                    console.log(`应用启动时间: ${startupTime.toFixed(2)}ms`);
                    
                    // 可以上报性能数据
                    if (startupTime > 3000) {
                        console.warn('应用启动时间较长，可能需要优化');
                    }
                }
            });
        }
    } catch (e) {
        console.warn('性能监控设置失败:', e);
    }
}

/**
 * 主应用对象
 */
export const app = {
    initialize: initializeApp,
    showError: showErrorMessage,
    loadConfig: loadAppConfig,
    saveConfig: saveAppConfig,
    errorHandler // 导出错误处理器供外部使用
};

/**
 * 监听DOM加载完成事件
 */
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOM已经加载完成，直接初始化
    initializeApp();
}

/**
 * 监听页面卸载事件
 */
window.addEventListener('beforeunload', handlePageUnload);

// 设置性能监控
setupPerformanceMonitoring();

// 导出应用实例作为默认导出
export default app;